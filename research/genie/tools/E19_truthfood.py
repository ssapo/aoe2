# usage: python3 E19_truthfood.py <truth.jsonl> <id...> : per id, its master/state/held changes (ms, owner p, master, state, held)
import json,sys
ids=set(int(x) for x in sys.argv[2:]); prev={}; out={i:[] for i in ids}
for line in open(sys.argv[1],'rb'):
    r=json.loads(line)
    for P in r['players']:
        for o in P['o']:
            i=o[0]
            if i in ids:
                k=(P['p'],o[1],o[2])
                v=(r['ms'],P['p'],o[1],o[2],o[3])
                if prev.get(i,(None,))[0]!=k: out[i].append(v)
                prev[i]=(k,v)
for i in sorted(ids):
    last=prev.get(i,(None,None))[1]
    print(i,'changes',out[i][:6],'last',last)
