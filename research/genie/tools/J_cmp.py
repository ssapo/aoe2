# usage: python3 J_cmp.py <base prefix e.g. I_ti> <new prefix e.g. J_e>  (reads J_sum_<prefix>_<rep>.txt)
import re,sys,ast
def parse(fn):
    t=open(fn,errors='replace').read().splitlines()
    r={'stop':{},'held':{},'words':{},'r01':{},'r50':{},'900':{}}
    pi=0; ri=0
    for l in t:
        m=re.match(r'player (\d): (.*?); (\d+) checkpoints hold',l)
        if m: r['stop'][int(m.group(1))]=m.group(2)[:70]; r['held'][int(m.group(1))]=int(m.group(3)); continue
        m=re.match(r'P(\d) first word mismatch \(s\): (.*)',l)
        if m: r['words'][int(m.group(1))]=ast.literal_eval(m.group(2)); continue
        m=re.match(r'- first difference > 0.01: ([\d.]+) s, (\w+).*\(diff (.*)\)',l)
        if m: pi+=1; r['r01'][pi]=(float(m.group(1)),m.group(2),m.group(3)); continue
        m=re.match(r'- first difference > 50: ([\d.]+) s, (\w+).*\(diff (.*)\)',l)
        if m: r['r50'][pi]=(float(m.group(1)),m.group(2),m.group(3)); continue
        m=re.match(r'\|(food|wood)\|900\|[^|]*\|[^|]*\|([^|]*)\|',l)
        if m: r['900'].setdefault(pi,{})[m.group(1)]=float(m.group(2))
    return r
b,n=sys.argv[1],sys.argv[2]
earlier=[]
for rep in ('239','161','097'):
    try: A=parse('J_sum_%s_%s.txt'%(b,rep)); B=parse('J_sum_%s_%s.txt'%(n,rep))
    except FileNotFoundError as e: print('missing',e); continue
    print('== %s: %s -> %s'%(rep,b,n))
    for p in (1,2):
        wa,wb=A['words'].get(p,{}),B['words'].get(p,{})
        ch=[]
        for k in sorted(set(wa)|set(wb)):
            x,y=wa.get(k),wb.get(k)
            if x!=y: ch.append('w%d %s->%s'%(k,x,y))
            if y is not None and (x is None or y<x): earlier.append('%s P%d word %d %s->%s'%(rep,p,k,x,y))
        for key in ('r01','r50'):
            x,y=A[key].get(p),B[key].get(p)
            if x!=y: ch.append('%s %s->%s'%(key,x,y))
            if y and (not x or y[0]<x[0]): earlier.append('%s P%d res%s %s->%s'%(rep,p,key[1:],x and x[0],y[0]))
        if rep=='239': ch.append('900 %s->%s'%(A['900'].get(p),B['900'].get(p)))
        print(' P%d words %s | r01 %s | r50 %s'%(p,wb,B['r01'].get(p),B['r50'].get(p)))
        print('    changes:', '; '.join(ch) if ch else 'none')
    for p in (0,1,2):
        if A['stop'].get(p)!=B['stop'].get(p) or A['held'].get(p)!=B['held'].get(p):
            print('  player %d stop: %s (held %s) -> %s (held %s)'%(p,A['stop'].get(p),A['held'].get(p),B['stop'].get(p),B['held'].get(p)))
print('EARLIER:', earlier if earlier else 'none')
