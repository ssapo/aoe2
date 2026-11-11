import json,struct,sys
def h(x): return struct.pack('>f',x).hex()
E={}
for l in open(sys.argv[1] if len(sys.argv)>1 else 'runs/pos2.err',errors='replace'):
    if l.startswith('OBJECT'):
        
        try: r=json.loads(l[7:])
        except Exception: continue
        E.setdefault(r['ms'],{})[r['id']]=(h(r['position'][0]),h(r['position'][1]))
print('engine ms',len(E),max(E))
first={};cnt={};tot=0
with open(__import__('os').environ.get('TRUTH','truth/truth4.jsonl'),'rb') as fh:
    for l in fh:
        try: r=json.loads(l)
        except Exception: continue
        ms=r['ms']
        if ms not in E: continue
        if ms>max(E): break
        for p in r['players']:
            for o in p['o']:
                e=E[ms].get(o[0])
                if e is None: continue
                tot+=1
                t=(h(o[4]),h(o[5]))
                if t!=e:
                    cnt[o[0]]=cnt.get(o[0],0)+1
                    if o[0] not in first: first[o[0]]=(ms,p['p'],o[1],t,e)
print('compared',tot,'objects with any diff',len(first))
for k,v in sorted(first.items(), key=lambda kv: kv[1][0])[:25]: print(k,v,'ndiff',cnt[k])
