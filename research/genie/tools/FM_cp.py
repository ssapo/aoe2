# FM (full-match, ENG-31): every checkpoint of one run with its word differences {word: eng-rec}
# usage: python runs/FM_cp.py runs/<name>.err [from_s] [to_s]
import re, sys
f = sys.argv[1]; a = float(sys.argv[2]) if len(sys.argv) > 2 else 0; b = float(sys.argv[3]) if len(sys.argv) > 3 else 1e9
rows = {}
for l in open(f, 'rb'):
    if not l.startswith(b'CPWORDS'): continue
    m = re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\] eng=\[(.*?)\]', l.decode('latin1'))
    if not m: continue
    t = int(m.group(2)) / 1000; p = int(m.group(3)); r = m.group(4).split(','); e = m.group(5).split(',')
    d = {i: int(e[i]) - int(r[i]) for i in range(len(r)) if r[i].strip() != e[i].strip()}
    rows.setdefault((t, int(m.group(1))), {})[p] = (d, r)
for (t, u), v in sorted(rows.items()):
    if t < a or t > b: continue
    print('%7.1f u%-6d' % (t, u), '  '.join('P%d %s' % (p, v[p][0] or 'ok') for p in sorted(v)))
