import json,sys,struct
T={17355:(66.65552,96.9563751),17372:(66.76127,96.74833),17381:(struct.unpack('<f',bytes.fromhex('0CA28542'))[0],struct.unpack('<f',bytes.fromhex('8547C142'))[0]),17394:(66.90155,96.47288)}
f32=lambda x: struct.unpack('<f',struct.pack('<f',x))[0]
bits=lambda x: struct.unpack('<I',struct.pack('<f',x))[0]
for fn in sys.argv[1:]:
    pos={}
    for l in open(fn,errors='replace'):
        if l.startswith('OBJECT') and '"id":2976,' in l:
            d=json.loads(l[7:]); pos[d['tick']]=d['position'][:2]
    print(fn)
    for t,(x,y) in T.items():
        e=pos.get(t)
        if not e: print(' ',t,'missing'); continue
        ex,ey=f32(e[0]),f32(e[1]); tx,ty=f32(x),f32(y)
        print('  %d engine (%.7f, %.7f) truth (%.7f, %.7f) ulp (%d, %d) dist %.2e'%(t,ex,ey,tx,ty,bits(ex)-bits(tx),bits(ey)-bits(ty),((ex-tx)**2+(ey-ty)**2)**.5))
