#!/usr/bin/env python3
"""Python port of 188329 0xd19f60 (the tile search behind ClosestResourceObject, unit AI slot 0x80
= 0xd23bf0) and of its helper 0xd1c390, plus the no-site wrapper path of 0xd23bf0.
World callbacks: passable(x,y) (0x12426a0 == 1), explored(x,y) (0x17324e0), resource(x,y) -> obj or
None (0xd1bfa0: first object on the tile that is a resource of the kind), reach(obj) (unit slot
0x408 != 0).  obj: dict(id=, workers=)  (workers = dword obj+0x18c)."""
import struct
DIRS = [(0, -1), (-1, 0), (0, 1), (1, 0)]            # 0x324a1c0
def f32(x): return struct.unpack('<f', struct.pack('<f', x))[0]
def pass_distance(px, py, x, y):                      # 0xd1ab36..0xd1aba0
    dx, dy = abs(x - px), abs(y - py)
    if dx > dy: return int(f32(f32(dy) * f32(1.4) + f32(0.61))) - dy + dx
    return int(f32(f32(dx) * f32(1.4) + f32(0.61))) - dx + dy

def search_d19f60(cur, point, seed_lo, seed_hi, box_lo, box_hi, rng, per_side, max_tests,
                  mapw, maph, passable, explored, resource, reach, still_good=lambda o: False,
                  corners=True, log=None):
    clamp = lambda v, hi: 0 if v < 0 else (hi if v > hi else v)
    x0, y0 = clamp(box_lo[0], mapw - 1), clamp(box_lo[1], maph - 1)
    x1, y1 = clamp(box_hi[0], mapw - 1), clamp(box_hi[1], maph - 1)
    W = x1 - x0 + 1
    if (y1 - y0 + 1) * W <= 1: return None
    inbox = lambda x, y: x0 <= x <= x1 and y0 <= y <= y1
    idx = lambda x, y: (y - y0) * W - x0 + x
    seen = set(); cnt = {}; mask = {}                 # 0x42c47c0 bitset; 0x42c47e8 (count, mask) bytes
    seeds = []
    for y in range(seed_lo[1], seed_hi[1] + 1):
        for x in range(seed_lo[0], seed_hi[0] + 1):
            if inbox(x, y) and passable(x, y):
                seen.add(idx(x, y)); seeds.append((x, y))
    # stable sort by squared tile distance from the point... NOTE: the sort key is the unit's own
    # tile (obj+0x170/+0x178 truncated), 0xd1a7f0..0xd1a92a
    ux, uy = point if isinstance(point, tuple) and len(point) == 2 else point[:2]
    seeds.sort(key=lambda s: (s[0] - search_d19f60.unit[0]) ** 2 + (s[1] - search_d19f60.unit[1]) ** 2)
    px, py = point
    queue = [(sx, sy, 0, abs(py - sy) < abs(px - sx)) for sx, sy in seeds]   # 0xd0ac80
    best = None; best_score = 1000000; best_d = 10000; tested = 0; head = 0

    def sides(nx, ny, d):                             # 0xd1c390
        k = idx(nx, ny); b = (d - 2) & 3
        mask[k] = mask.get(k, 0) | (1 << b)
        cnt[k] = (cnt.get(k, 0) + per_side) & 0xff
        if corners:
            for b2 in ((b + 1) & 3, (b - 1) & 3):
                cx, cy = nx + DIRS[b][0] + DIRS[b2][0], ny + DIRS[b][1] + DIRS[b2][1]
                if not passable(cx, cy):
                    if (not inbox(cx, cy)) or cnt.get(idx(cx, cy), 0) != 0:
                        cnt[k] = (cnt[k] - 1) & 0xff
                elif mask[k] & (1 << b2):
                    cnt[k] = (cnt[k] + 1) & 0xff
        return cnt[k]

    while head < len(queue) and tested < max_tests:
        tx, ty, steps, flag = queue[head]; head += 1
        order = (0, 2, 1, 3) if flag else (1, 3, 0, 2)                # 0x42c482c
        for k in range(4):
            if tested >= max_tests: break
            d = order[k]; nx, ny = tx + DIRS[d][0], ty + DIRS[d][1]
            if not inbox(nx, ny): continue
            dist = pass_distance(px, py, nx, ny)
            if dist > rng: continue
            if not explored(nx, ny): continue
            o = resource(nx, ny); ps = passable(nx, ny)
            if o is not None:
                if not ps:
                    c = sides(nx, ny, d)
                else:
                    c = 0
                    for b in order:
                        ax, ay = tx + DIRS[b][0], ty + DIRS[b][1]
                        if inbox(ax, ay) and resource(ax, ay) is None and passable(ax, ay):
                            c += per_side
                cap = (1 if cur == o['id'] else 0) - o['workers'] + c
                if log: log('tile', (nx, ny), 'from', (tx, ty), 'steps', steps, 'id', o['id'], 'sides', c, 'cap', cap)
                good = False; skip = False
                if cap > 0:
                    tested += 1
                    if reach(o):
                        if cur == o['id'] and still_good(o): good = True       # 0x107af40
                        else: return o['id'], dist                            # "Found a target"
                    else: skip = True
                if not skip:
                    score = (steps & 0xffff) - cap
                    if score < best_score:
                        ok = True
                        if not good:
                            tested += 1; ok = reach(o)                        # 0xd19ea0
                        if ok: best, best_score, best_d = o['id'], score, dist  # "potential low priority"
            k2 = idx(nx, ny)
            if k2 not in seen:
                seen.add(k2)
                if ps: queue.append((nx, ny, steps + 1, nx != tx))            # 0xd0ab20
    return (best, best_d) if best is not None else None
search_d19f60.unit = (0, 0)

def closest_resource_no_site(unit_xy, los, cur, **w):
    """0xd23bf0 with dropsiteID -1 and point (-1,-1): 0xd242f0.."""
    px, py = int(unit_xy[0]), int(unit_xy[1])
    r = int(los) + 5; half = (r * 3) // 2
    search_d19f60.unit = (px, py)
    return search_d19f60(cur, (px, py), (px, py), (px, py), (px - half, py - half), (px + half, py + half),
                         r, 2, 30, **w)

def old_engine(unit_xy, los, cur, cap, passable, resource):
    """the engine's closest_resource_at without a site, reduced (all explored, all reached)."""
    ux, uy = unit_xy; px, py = int(ux), int(uy)
    q = [(px, py, 0)]; seen = {(px, py)}; i = 0; fb = None; fbs = 10**6
    key = lambda c: (uy - (c[1] + 0.5)) ** 2 + (ux - (c[0] + 0.5)) ** 2
    while i < len(q):
        x, y, s = q[i]; i += 1
        if pass_distance(px, py, x, y) > int(los) + 5: continue
        if passable(x, y):
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                if (x + dx, y + dy) not in seen:
                    seen.add((x + dx, y + dy)); q.append((x + dx, y + dy, s + 1))
            q[i:] = sorted(q[i:], key=key)
        o = resource(x, y)
        if o is None or o['id'] == cur: continue
        if o['workers'] < cap: return o['id']
        if s < fbs: fb, fbs = o['id'], s
    return fb

if __name__ == '__main__':
    # replay 518470161, P1 lumberjacks around tree 9397 (97.5,50.5); truth objects at 407095 ms
    blocked = set()
    for x in range(98, 102):
        for y in range(53, 57): blocked.add((x, y))                       # town centre 9352 at (100,55)
    trees = {(97, 50): 9397, (97, 60): 9396}
    blocked |= set(trees)
    blocked |= {(106, 47), (107, 47), (106, 48), (107, 48)}               # gold 9455..9458
    blocked |= {(91, 50), (90, 50), (90, 49), (90, 51)}                   # stone 9482..9485
    blocked |= {(x, y) for x in (93, 94, 95) for y in (63, 64, 65)}       # bushes
    blocked |= {(x, y) for x in (91, 92) for y in (54, 55, 56, 57)}       # houses 10400, 10401
    passable = lambda x, y: 0 <= x < 120 and 0 <= y < 120 and (x, y) not in blocked
    # (unit, truth sample ms at which its load is gone, truth position at/just before the drop, workers of 9397 before, after)
    cases = [(10444, 407173, (99.94621, 52.8), 2, 3), (10430, 409331, (101.010147, 52.77646), 3, 4),
             (10426, 411216, (99.59144, 52.80007), 4, 5), (10463, 414375, (99.7913055, 52.7390137), 5, 6)]
    for uid, ms, pos, wb, wa in cases:
        workers = {9397: wb, 9396: 0}
        res = lambda x, y: ({'id': trees[(x, y)], 'workers': workers[trees[(x, y)]]} if (x, y) in trees else None)
        lines = []
        new = closest_resource_no_site(pos, 4, -1, mapw=120, maph=120, passable=passable,
                                       explored=lambda x, y: True, resource=res, reach=lambda o: True,
                                       log=lambda *a: lines.append(' '.join(str(v) for v in a)))
        old = old_engine(pos, 4, -1, 2, passable, res)
        print('unit', uid, 'ms', ms, 'workers(9397) before', wb, '-> 188329 port:', new, '| engine rule (cap 2):', old,
              '| truth: 9397 (workers ->', wa, ')')
        for l in lines: print('    ', l)
