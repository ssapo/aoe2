# FM (ENG-31): per-object state transitions from OBJECT trace lines.
# usage: python runs/FM_obj.py runs/<name>.err [player] [id,id,...]
import json, sys, re
f = sys.argv[1]; pl = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] != '-' else None
ids = set(int(x) for x in sys.argv[3].split(',')) if len(sys.argv) > 3 else None
last = {}; first = {}; lastpos = {}
for l in open(f, 'rb'):
    if not l.startswith(b'OBJECT '): continue
    o = json.loads(l[7:])
    if pl is not None and o['player'] != pl: continue
    if ids and o['id'] not in ids: continue
    k = (o['state'], o['master'], o['action_kind'], o['action_state'], re.sub(r'idle=\S+ ','',o.get('ai') or ''))
    i = o['id']
    if i not in first: first[i] = o['tick']
    if last.get(i) != k:
        print('%6d %7.3f id%-5d m%-4d st%d act=%s/%s held=%.2f pos=(%.4f,%.4f) %s' % (o['tick'], o['ms'] / 1000, i, o['master'], o['state'], o['action_kind'], o['action_state'], o['held'], o['position'][0], o['position'][1], o.get('ai')))
        last[i] = k
