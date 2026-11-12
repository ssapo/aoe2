# usage: cd runs && python3 M4_cmp.py <base prefix> <new prefix>
# Six default runs (<prefix>_p_239/161/097 with truth, <prefix>_n_894/090/670 without). Per replay and player:
# "first mismatch" by the CONTINUE 13.3 rule = min(earliest checkpoint word mismatch, first resource difference > 0.01),
# checkpoints held, stop line; marks EARLIER / LATER.
import re,sys,subprocess,os
R=[('p_239','../truth/analysis'),('p_161','../truth/analysis5'),('p_097','../truth/analysis6'),('n_894',''),('n_090',''),('n_670','')]
def load(name,td):
    w={1:{},2:{}}
    for l in open(name+'.err','rb'):
        if l.startswith(b'CPWORDS'):
            m=re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\] eng=\[(.*?)\]',l.decode('latin1'))
            if not m: continue
            p=int(m.group(3)); rec=m.group(4).split(','); eng=m.group(5).split(',')
            for i,(a,b) in enumerate(zip(rec,eng)):
                if a.strip()!=b.strip() and p in w: w[p].setdefault(i,int(m.group(2))/1000)
    res={1:None,2:None}; big={1:None,2:None}
    if td:
        o=subprocess.run(['python3','grade_res.py',name+'.err','--truth-dir',td,'--out',os.path.expanduser('~/g_'+name)],capture_output=True,text=True).stdout
        cur=None
        for l in o.splitlines():
            m=re.match(r'## Player (\d)',l)
            if m: cur=int(m.group(1))
            m=re.search(r'first difference > 0\.01: ([\d.]+) s',l)
            if m and cur in res and res[cur] is None: res[cur]=float(m.group(1))
    out=open(name+'.out',errors='replace').read().splitlines()
    held={}; stop={}
    for l in out:
        m=re.match(r'player (\d): (.*?); (\d+) checkpoints hold',l)
        if m: held[int(m.group(1))]=int(m.group(3)); stop[int(m.group(1))]=m.group(2)[:110]
    return w,res,held,stop,out[0] if out else ''
b,n=sys.argv[1],sys.argv[2]
for suf,td in R:
    A=load('%s_%s'%(b,suf),td); B=load('%s_%s'%(n,suf),td)
    print('== %s  (%s)'%(suf,B[4][:60]))
    for p in (1,2):
        def first(X):
            c=[v for v in X[0][p].values()]+([X[1][p]] if X[1][p] is not None else [])
            return min(c) if c else None
        fa,fb=first(A),first(B)
        tag='' if fa==fb else ('LATER' if fb is None or (fa is not None and fb>fa) else 'EARLIER')
        wa=min(A[0][p].values()) if A[0][p] else None; wb=min(B[0][p].values()) if B[0][p] else None
        print(' P%d first %s -> %s %s | word %s -> %s (words %s) | res %s -> %s | held %s -> %s'%(p,fa,fb,tag,wa,wb,
            sorted(k for k,v in B[0][p].items() if v==wb),A[1][p],B[1][p],A[2].get(p),B[2].get(p)))
    for p in (0,1,2):
        if A[3].get(p)!=B[3].get(p) or (B[3].get(p) and B[3][p]!='no stop'): print('   stop P%d: %s -> %s'%(p,A[3].get(p),B[3].get(p)))
