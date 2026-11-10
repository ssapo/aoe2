import json,struct,re,sys
def f(h,i): return struct.unpack('<f',bytes.fromhex(h[i*8:i*8+8]))[0]
lim=int(sys.argv[1]) if len(sys.argv)>1 else 60000
eng=set()
for l in open('runs/steer.err',errors='replace'):
    if l.startswith('WALKWP'):
        pts=re.findall(r'BVector\(\[([-\d.e]+), [-\d.e]+, ([-\d.e]+)\]\)',l)
        eng.add(tuple((struct.pack('<f',float(a)),struct.pack('<f',float(b))) for a,b in pts))
print('engine lists',len(eng))
seen={};n=0;bad=0;out=[]
with open('truth/truth4.jsonl','rb') as fh:
    for l in fh:
        try: r=json.loads(l)
        except Exception: continue
        if r['ms']>lim: break
        for p in r['players']:
            for o in p['o']:
                if isinstance(o[-1],dict) and 'wp' in o[-1]:
                    d=o[-1]
                    if seen.get(o[0])==d['wp'] or d['nw']>8: continue
                    seen[o[0]]=d['wp']; n+=1
                    k=tuple((bytes.fromhex(d['wp'][24*i:24*i+8]),bytes.fromhex(d['wp'][24*i+16:24*i+24])) for i in range(d['nw']))
                    if k not in eng:
                        bad+=1
                        if len(out)<14: out.append((r['ms'],p['p'],o[0],o[1],[(round(f(d['wp'],3*i),5),round(f(d['wp'],3*i+2),5)) for i in range(d['nw'])]))
print('truth paths',n,'not in engine',bad)
for x in out: print(*x)
