# usage: python E6_fit.py <err with OBJECT traces> : fits "these units run faster by rate r since update t0 in the
# recording" against P2's checkpoint word-7 differences of replay 520592057 (engine minus recording).
import json, sys, math
tr = {}
for line in open(sys.argv[1], encoding='utf-8', errors='replace'):
    if not line.startswith('OBJECT '): continue
    o = json.loads(line[7:])
    tr.setdefault(o['id'], {})[o['tick']] = o['position']
def w7(p): return sum(int(a * 100.0) for a in p)
def at(t, x):
    lo = math.floor(x); f = x - lo
    a = t.get(lo); b = t.get(lo + 1, a)
    if a is None:
        m = max(t); a0, a1 = t[m - 1], t[m]
        return [a1[k] + (a1[k] - a0[k]) * (x - m) for k in range(3)]
    return [a[k] + (b[k] - a[k]) * f for k in range(3)]
cps = [44499, 44999, 45499, 45999, 46499]
want = [132, 101, 155, 166, 266]
def model(ids, r, t0):
    out = []
    for c in cps:
        d = 0
        for i in ids:
            p = at(tr[i], c + max(0, c - t0) * r)
            if p is None: return None
            d += w7(tr[i][c]) - w7(p)
        out.append(d)
    return out
for name, ids in (('militia x3', (4796, 4803, 4804)), ('4804', (4804,)), ('six shepherds', (3850, 3854, 4722, 4724, 4740, 4753))):
    best = []
    for t0 in range(43999, 44500, 4):
        for k in range(-300, 301, 2):
            r = k / 1000.0
            if r == 0: continue
            m = model(ids, r, t0)
            if m is None: continue
            best.append((sum(abs(a - b) for a, b in zip(m, want)), t0, r, m))
    best.sort()
    print(name)
    for b in best[:4]: print('  ', b)
