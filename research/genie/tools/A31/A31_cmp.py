# usage: A31_cmp.py <engine err> <truth jsonl> [ms0 ms1]  -- first per-object difference of
# retarget timer (AI +0x1d4), look-around (+0x178), limit (+0x17c), position, state
import json,sys,struct
f32=lambda v: struct.pack('<f',v)
ef,tf=sys.argv[1],sys.argv[2]; a=int(sys.argv[3]) if len(sys.argv)>3 else 0; b=int(sys.argv[4]) if len(sys.argv)>4 else 10**9
E={}
for line in open(ef,encoding='utf-8',errors='replace'):
    if line.startswith('OBJECT '):
        d=json.loads(line[7:])
        if a<=d['ms']<=b: E.setdefault(d['ms'],{})[d['id']]=d
first={}; seen=set()
for line in open(tf,'rb'):
    d=json.loads(line); ms=d['ms']
    if ms<a or ms>b or ms not in E: continue
    for p in d['players']:
        for o in p['o']:
            i=o[0]; e=E[ms].get(i)
            if e is None: continue
            seen.add(i)
            if i in first: continue
            diffs=[]
            if o[6]!=-1 and o[6]!=e['retarget_ms']: diffs.append(('retarget',o[6],e['retarget_ms']))
            if o[8]!=-1 and o[8]!=e['look']: diffs.append(('look',o[8],e['look']))
            if o[9]!=-1 and o[9]!=e['limit']: diffs.append(('limit',o[9],e['limit']))
            if (f32(o[4]),f32(o[5]))!=(f32(e['position'][0]),f32(e['position'][1])): diffs.append(('pos',(o[4],o[5]),tuple(e['position'][:2])))
            if diffs: first[i]=(ms,p['p'],o[1],diffs,e['ai'][:90])
for i,(ms,p,m,df,ai) in sorted(first.items(),key=lambda x:x[1][0]):
    print(ms,'p%d'%p,i,'m%d'%m,df,'|',ai)
print('objects compared',len(seen),'differ',len(first))
