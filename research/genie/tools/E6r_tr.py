# usage: python E6r_tr.py <truth.jsonl> <ms from> <ms to> [id ...] : truth samples in a time window (binary search by file offset).
# Without ids: prints the top-level keys and one object row; with ids: one line per sample and id.
import json,sys,os
def seek_ms(fh,target):
    lo,hi=0,os.path.getsize(fh.name)
    while hi-lo>1<<16:
        mid=(lo+hi)//2; fh.seek(mid); fh.readline(); l=fh.readline()
        if not l: hi=mid; continue
        i=l.find(b'"ms":'); ms=int(l[i+5:l.find(b',',i)])
        if ms<target: lo=mid
        else: hi=mid
    fh.seek(lo); fh.readline()
def rows(path,a,b):
    with open(path,'rb') as fh:
        seek_ms(fh,a)
        for l in fh:
            i=l.find(b'"ms":'); ms=int(l[i+5:l.find(b',',i)])
            if ms<a: continue
            if ms>b: break
            try: yield json.loads(l)
            except Exception: continue
if __name__=='__main__':
    path,a,b=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]); ids=set(int(x) for x in sys.argv[4:])
    first=True
    for r in rows(path,a,b):
        if not ids:
            if first:
                print({k:(v if not isinstance(v,list) else '[%d]'%len(v)) for k,v in r.items()})
                for p in r['players']: print({k:(v if k!='o' else v[:2]) for k,v in p.items()})
                first=False
            continue
        for p in r['players']:
            for o in p['o']:
                if o[0] in ids: print(r['ms'],r.get('t'),p['p'],o)
