import sys,json,re,os
# usage: tseek.py truth ms_from ms_to id[,id] -> prints compact rows for those ids
fn=sys.argv[1]; a=int(sys.argv[2]); b=int(sys.argv[3]); ids=[int(x) for x in sys.argv[4].split(',')]
f=open(fn,'rb'); size=os.path.getsize(fn)
def ms_at(off):
    f.seek(off); f.readline(); l=f.readline()
    m=re.match(rb'\{"ms":(\d+)',l); return (int(m.group(1)) if m else None)
lo,hi=0,size
while hi-lo>2000000:
    mid=(lo+hi)//2; m=ms_at(mid)
    if m is None or m<a: lo=mid
    else: hi=mid
f.seek(lo); f.readline()
for l in f:
    m=re.match(rb'\{"ms":(\d+)',l)
    if not m: continue
    ms=int(m.group(1))
    if ms<a: continue
    if ms>b: break
    d=json.loads(l)
    for p in d['players']:
        for o in p['o']:
            if o[0] in ids:
                ex=[x for x in o[10:] if isinstance(x,dict)]
                k=ex[0] if ex else {}
                print(ms,p['p'],o[:10],'ai=',k.get('ai'),'an=',k.get('an'))
