# usage: interact_points.py <interacts.tsv: world_ms player target x y> <census stderr with GENIE_DUMP_ALL=1 GENIE_DUMP_UNITS=1>
import re,sys,math
pos={}
for l in open(sys.argv[2]):
    m=re.search(r'mark_ms=(\d+) player=(\d+) id=(\d+) master=(\d+) pos=\[([-0-9.]+), ([-0-9.]+)',l)
    if m: pos[(int(m.group(1)),int(m.group(3)))]=(int(m.group(2)),int(m.group(4)),float(m.group(5)),float(m.group(6)))
for l in open(sys.argv[1]):
    t,p,tg,x,y=l.split(); t=int(t); tg=int(tg); x=float(x); y=float(y)
    e=pos.get((t,tg))
    if e:
        d=math.hypot(e[2]-x,e[3]-y)
        print('%6.1f P%s -> %s (owner %d master %d) rec=(%.1f,%.1f) eng=(%.1f,%.1f) d=%.1f %s'%(t/1000,p,tg,e[0],e[1],x,y,e[2],e[3],d,'<<' if d>1.5 and e[1] not in (109,) else ''))
    else:
        print('%6.1f P%s -> %s MISSING rec=(%.1f,%.1f)'%(t/1000,p,tg,x,y))
