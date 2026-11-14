import re,sys,math
for f in sys.argv[1:]:
    n=0;odd=[]
    upd=0
    for l in open(f,errors='replace'):
        if l.startswith('CPWORDS'):
            m=re.search(r'syncs=(\d+) world_ms=(\d+)',l); upd=(int(m.group(1)),int(m.group(2)))
        if not l.startswith('ANIMAL_EVADE188329'): continue
        v=[float(x) for x in re.findall(r'-?\d+\.\d+|-?\d+(?=[,\]])',l)]
        fx,fy,_,ox,oy,_,ax,ay,px,py=v[:10]
        n+=1
        aw=math.atan2(fy-oy,fx-ox); pw=math.atan2(py-fy,px-fx); d=abs((pw-aw+math.pi)%(2*math.pi)-math.pi)
        if d>0.05 or (ax,ay)!=(px,py) and math.hypot(px-fx,py-fy)>math.hypot(ax-fx,ay-fy)+0.01:
            odd.append((upd,round(fx,2),round(fy,2),'other',round(ox,2),round(oy,2),'first',round(ax,2),round(ay,2),'pt',round(px,2),round(py,2),'dev',round(math.degrees(d),1)))
    print(f,n,len(odd))
    for o in odd[:6]: print('  ',o)
