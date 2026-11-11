import json,sys
ids={int(x) for x in sys.argv[2:]}; E={}
for l in open(sys.argv[1],errors='replace'):
 if not l.startswith('OBJECT '):continue
 try:r=json.loads(l[7:])
 except ValueError:continue
 if r['id'] in ids:E[r['ms'],r['id']]=r
lo=min(ms for ms,i in E);hi=max(ms for ms,i in E)
for l in open('truth/truth4.jsonl'):
 i=l.find('"ms":');ms=int(l[i+5:l.find(',',i)])
 if ms<lo:continue
 if ms>hi:break
 r=json.loads(l)
 for p in r['players']:
  for o in p['o']:
   e=E.get((ms,o[0]))
   if e:print(ms,o[0],'T',o[3:6],'E',e['held'],e['position'][:2],e['action_kind'],e['action_state'])
