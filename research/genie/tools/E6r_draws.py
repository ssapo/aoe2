# usage: python E6r_draws.py <err with DRAW / DRAWS_UPDATE_DONE / FARMSPOT lines> : draws per update by stream and caller
import re,collections,sys
per=collections.OrderedDict(); cur=[]
for l in open(sys.argv[1],errors='replace'):
    if l.startswith('DRAWS_ON'): cur=[]
    elif l.startswith('DRAWS_UPDATE_DONE'):
        per[int(l.split()[1])]=cur; cur=[]
    elif l.startswith('DRAW '):
        m=re.match(r'DRAW stream=(\d+) n=(\d+) value=(\d+) at=(.*)',l.strip())
        cur.append((int(m.group(1)),m.group(4).replace(chr(92),'/').split('genie-core/src/')[-1]))
    elif l.startswith('FARMSPOT'): cur.append(('FARMSPOT',l.strip()[9:60]))
ks=list(per)
print('updates',ks[0],ks[-1])
c=collections.Counter()
for k,v in per.items():
    for e in v:
        if e[0]!='FARMSPOT': c[e]+=1
for e,n in c.most_common(25): print(n,e)
show=set(int(x) for x in sys.argv[2:])
for k in ks:
    v=per[k]
    if any(e[0]=='FARMSPOT' for e in v) or k in show:
        print('== update',k)
        for e in v:
            if e[0]=='FARMSPOT' or e[0]==0 or k in show: print('   ',e)
