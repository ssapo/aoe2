import json,struct,sys
# usage: cmp_held.py <engine err> : first difference of held amount (and state) per object vs truth
E={}
for l in open(sys.argv[1],errors='replace'):
    if l.startswith('OBJECT'):
        try: r=json.loads(l[7:])
        except Exception: continue
        E.setdefault(r['ms'],{})[r['id']]=(r.get('held'),r.get('state'))
print('engine ms',len(E),min(E),max(E))
first={};cnt={};run={};cand={}
with open(__import__('os').environ.get('TRUTH','truth/truth4.jsonl'),'rb') as fh:
    for l in fh:
        i=l.find(b'"ms":'); ms=int(l[i+5:l.find(b',',i)])
        if ms<min(E): continue
        if ms>max(E): break
        if ms not in E: continue
        r=json.loads(l)
        for p in r['players']:
            for o in p['o']:
                e=E[ms].get(o[0])
                if e is None or e[0] is None: continue
                th=struct.unpack('<f',struct.pack('<f',o[3]))[0]; eh=struct.unpack('<f',struct.pack('<f',e[0]))[0]
                if th!=eh or o[2]!=e[1]:
                    cnt[o[0]]=cnt.get(o[0],0)+1
                    run[o[0]]=run.get(o[0],0)+1
                    if run[o[0]]==1: cand[o[0]]=(ms,p['p'],o[1],'T',o[2],o[3],'E',e[1],e[0])
                    # the truth has torn single samples: only 3 mismatching samples in a row count
                    if run[o[0]]>=3 and o[0] not in first: first[o[0]]=cand[o[0]]
                else:
                    run[o[0]]=0
for k,v in sorted(first.items(), key=lambda kv: kv[1][0])[:25]: print(k,v,'n',cnt[k])
