import json,re,sys
# res_at.py <err> <player> <t_s>: resources at the checkpoints around t, and resource changes between them
f,p,t=sys.argv[1],int(sys.argv[2]),float(sys.argv[3])*1000
res={}; cps=[]
for l in open(f,errors='replace'):
    if l.startswith('RES'):
        o=json.loads(l[4:])
        if o['player']==p: res[o['ms']]=o['res']
    elif l.startswith('CPWORDS'):
        m=re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\] eng=\[(.*?)\]',l)
        if int(m.group(3))==p: cps.append((int(m.group(2)),int(m.group(4).split(',')[1]),int(m.group(5).split(',')[1])))
ks=sorted(res); sel=[c for c in cps if t-7000<c[0]<t+7000]
for c in sel:
    k=max(x for x in ks if x<=c[0]); print('CP',c,'res',[round(x,4) for x in res[k]])
if len(sel)>=2:
    prev=None
    for k in ks:
        if sel[0][0]<k<=sel[-1][0]:
            if prev is not None and res[k]!=prev: print(' ',k,[round(b-a,4) for a,b in zip(prev,res[k])],[round(x,4) for x in res[k]])
            prev=res[k]
        elif k<=sel[0][0]: prev=res[k]
