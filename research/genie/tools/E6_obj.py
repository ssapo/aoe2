# usage: python E6_obj.py <err file> <id[,id..]> <tick from> <tick to> [every]
# Prints the OBJECT trace lines of the ids in the tick range, one short line each.
import sys, json
f, ids, a, b = sys.argv[1], {int(x) for x in sys.argv[2].split(',')}, int(sys.argv[3]), int(sys.argv[4])
every = int(sys.argv[5]) if len(sys.argv) > 5 else 1
last = {}
for line in open(f, encoding='utf-8', errors='replace'):
    if not line.startswith('OBJECT '): continue
    o = json.loads(line[7:])
    if o['id'] not in ids or not (a <= o['tick'] <= b): continue
    key = (o['master'], o['action_kind'], o['action_state'], o['state'], o['ai'])
    ch = last.get(o['id']) != key
    last[o['id']] = key
    if ch or (o['tick'] - a) % every == 0:
        p = o['position']
        print(f"{o['tick']} {o['id']} m{o['master']} st{o['state']} held={o['held']:.3f} ({p[0]:.4f},{p[1]:.4f}) {o['action_kind']}/{o['action_state']} {o['ai']}{' *' if ch else ''}")
