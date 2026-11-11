# usage: extract_truth.py <truth.jsonl> <outdir>   (same delta cache as truth/analysis/s1_extract.py, any truth file)
import json,sys,time
t0=time.time(); src,out=sys.argv[1],sys.argv[2]
ev=open(out+'/cache_events.csv','w'); rs=open(out+'/cache_res.csv','w')
last={}; bad=0; n=0
for l in open(src,'rb'):
    try: d=json.loads(l)
    except Exception: bad+=1; continue
    n+=1; ms=d['ms']; seen=set(); res={}
    for p in d['players']:
        pn=p['p']; res[pn]=p['res']
        for o in p['o']:
            k=(pn,o[1],o[2],o[3],o[4],o[5]); i=o[0]; seen.add(i)
            if last.get(i)!=k:
                last[i]=k
                ev.write('%d,%d,%d,%d,%d,%r,%r,%r\n'%(ms,pn,i,o[1],o[2],o[3],o[4],o[5]))
    for i in [i for i in last if i not in seen]:
        ev.write('%d,-1,%d,0,0,0,0,0\n'%(ms,i)); del last[i]
    rs.write('%d,%s,%s\n'%(ms,','.join(repr(x) for x in res.get(1,[0]*4)),','.join(repr(x) for x in res.get(2,[0]*4))))
open(out+'/extract.done','w').write('lines %d bad %d sec %.0f\n'%(n,bad,time.time()-t0))
