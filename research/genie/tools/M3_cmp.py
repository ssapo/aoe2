# usage: cd runs && python3 M3_cmp.py <base prefix> <new prefix> <suffix>...   e.g. M3_cmp.py M2 M3 p_239 n_090
# Per replay and player: first mismatch of each checkpoint word (s), checkpoints held, stop line; says whether
# the two stderr files are the same apart from TIMING lines. Works without a truth recording.
import re,sys,hashlib
def load(name):
    first={}; h=hashlib.md5()
    for l in open(name+'.err','rb'):
        if l.startswith(b'TIMING'): continue
        h.update(l)
        if l.startswith(b'CPWORDS'):
            m=re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\] eng=\[(.*?)\]',l.decode('latin1'))
            if not m: continue
            p=int(m.group(3)); rec=m.group(4).split(','); eng=m.group(5).split(',')
            for i,(a,b) in enumerate(zip(rec,eng)):
                if a.strip()!=b.strip(): first.setdefault(p,{}).setdefault(i,int(m.group(2))/1000)
    out=open(name+'.out',errors='replace').read().splitlines()[-3:]
    return first,h.hexdigest(),out
b,n=sys.argv[1],sys.argv[2]
for suf in sys.argv[3:]:
    fa,ha,oa=load('%s_%s'%(b,suf)); fb,hb,ob=load('%s_%s'%(n,suf))
    print('== %s: stderr %s'%(suf,'identical (TIMING aside)' if ha==hb else 'differs'))
    for p in (1,2):
        wa,wb=fa.get(p,{}),fb.get(p,{})
        ea=min(wa.values()) if wa else None; eb=min(wb.values()) if wb else None
        print(' P%d earliest %s -> %s %s'%(p,ea,eb,'' if ea==eb else ('LATER' if (eb is None or (ea is not None and eb>ea)) else 'EARLIER')))
        if wa!=wb: print('    words', {k:round(v,1) for k,v in sorted(wa.items())}, '->', {k:round(v,1) for k,v in sorted(wb.items())})
    for x,y in zip(oa,ob):
        if x!=y: print('   out:',x[:150]); print('     ->',y[:150])
