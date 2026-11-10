import json,struct,re,sys
def h(x): return struct.pack('>f',x).hex()
S={1:[],2:[]}
for l in open('runs/sp.err',errors='replace'):
    m=re.match(r'SPAWN188329 player=PlayerId\((\d)\) found=Ok\(Point\(\[([-\d.e]+), ([-\d.e]+)\]\)\)',l)
    if m: S[int(m.group(1))].append((float(m.group(2)),float(m.group(3))))
seen=set();F={1:[],2:[]};n=0
with open('truth/truth4.jsonl','rb') as fh:
    for l in fh:
        try: r=json.loads(l)
        except Exception: continue
        ms=r['ms']
        if ms>330000: break
        for p in r['players']:
            for o in p['o']:
                if o[0] in seen: continue
                seen.add(o[0])
                if n and p['p'] in (1,2) and len(o)>4: F[p['p']].append((ms,o[0],o[1],o[4],o[5]))
        n+=1
for pl in (1,2):
    print('player',pl,'engine spawns',len(S[pl]),'truth new objects',len(F[pl]))
    for t in F[pl][:40]:
        # nearest engine spawn
        best=min(S[pl],key=lambda s:(s[0]-t[3])**2+(s[1]-t[4])**2) if S[pl] else None
        ex = best and h(best[0])==h(t[3]) and h(best[1])==h(t[4])
        d = ((best[0]-t[3])**2+(best[1]-t[4])**2)**.5 if best else -1
        print(' ',t,'engine',best,'EXACT' if ex else 'd=%.4f'%d)
