# usage: python E6r_cmp.py <engine .err with OBJECT lines> <truth.jsonl> [player] : per object, the first lasting difference
# (3 samples in a row; the truth has torn single samples) of position bits, held amount, state, master; and ids only on one side.
import json,struct,sys
from E6r_tr import rows
def h(x): return struct.pack('<f',x)
E={}
for l in open(sys.argv[1],errors='replace'):
    if l.startswith('OBJECT'):
        try: r=json.loads(l[7:])
        except Exception: continue
        E.setdefault(r['ms'],{})[r['id']]=r
pl=int(sys.argv[3]) if len(sys.argv)>3 else None
lo,hi=min(E),max(E); print('engine ms',len(E),lo,hi)
run={};cand={};first={};only={}
n=0
for r in rows(sys.argv[2],lo,hi):
    ms=r['ms']
    if ms not in E: continue
    n+=1
    for p in r['players']:
        if pl is not None and p['p']!=pl: continue
        tid=set()
        for o in p['o']:
            tid.add(o[0]); e=E[ms].get(o[0])
            if e is None:
                only.setdefault(('truth only',o[0]),(ms,p['p'],o[1],o[4],o[5])); continue
            for key,t,v in (('pos',h(o[4])+h(o[5]),h(e['position'][0])+h(e['position'][1])),('held',h(o[3]),h(e['held'] or 0)),('state',o[2],e['state']),('master',o[1],e['master'])):
                k=(key,o[0])
                if t!=v:
                    run[k]=run.get(k,0)+1
                    if run[k]==1: cand[k]=(ms,p['p'],o[1],'T',o[2],o[3],o[4],o[5],'E',e['state'],e['held'],e['position'][0],e['position'][1],e.get('action_kind'),e.get('action_state'))
                    if run[k]>=3 and k not in first: first[k]=cand[k]
                else: run[k]=0
        for i,e in E[ms].items():
            if e['player']==p['p'] and i not in tid: only.setdefault(('engine only',i),(ms,p['p'],e['master'],e['position'][0],e['position'][1]))
print('samples compared',n)
for k,v in sorted(first.items(), key=lambda kv: kv[1][0])[:40]: print(k,v)
for k,v in sorted(only.items(), key=lambda kv: kv[1][0])[:20]: print(k,v)
