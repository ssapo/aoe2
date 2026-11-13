# usage: python E6r_side.py <engine .err> <truth.jsonl> <ms from> <ms to> <id> [all] : truth samples and the engine rows of one object side by side
# (engine rows only at the truth's sample times unless "all").
import json,sys
from E6r_tr import rows
err,tp,a,b,i=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5]); al=len(sys.argv)>6
E={}
for l in open(err,errors='replace'):
    if l.startswith('OBJECT') and '"id":%d,'%i in l:
        r=json.loads(l[7:])
        if a<=r['ms']<=b: E[r['ms']]=r
T={}
for r in rows(tp,a,b):
    for p in r['players']:
        for o in p['o']:
            if o[0]==i: T[r['ms']]=o
for ms in sorted(set(E)|set(T)) if al else sorted(T):
    e=E.get(ms); t=T.get(ms)
    print(ms, 'T', (t[2],t[3],t[4],t[5],t[6:]) if t else '-', '| E', (e['tick'],e['state'],e['held'],round(e['position'][0],5),round(e['position'][1],5),e['action_kind'],e['action_state'],(e.get('ai') or '')[:50]) if e else '-')
