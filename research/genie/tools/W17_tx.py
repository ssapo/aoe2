import json,re,sys
tf,a,b,outp=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4]; ids=set(int(x) for x in sys.argv[5:])
out={}
with open(tf,'rb') as f:
    for line in f:
        m=re.search(rb'"ms":\s*(\d+)',line[:100])
        if not m: continue
        ms=int(m.group(1))
        if ms<a: continue
        if ms>b: break
        d=json.loads(line)
        for p in d['players']:
            for o in p['o']:
                if o[0] in ids: out.setdefault(ms,{})[o[0]]=o
json.dump(out,open(outp,'w'))
print(len(out))
