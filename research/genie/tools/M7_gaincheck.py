# usage: python3 runs/M7_gaincheck.py runs/<name>.err  : last GAIN line per player vs positive RES increases up to the same ms
import sys, json
stock={}; gain={}
for l in open(sys.argv[1], encoding='utf-8', errors='replace'):
    if l.startswith('RES '):
        r=json.loads(l[4:]); stock.setdefault(r['player'],[]).append((r['ms'],r['res'][:4]))
    elif l.startswith('GAIN '):
        r=json.loads(l[5:]); gain[r['p']]=r
def tot(v): return sum(v.values()) if isinstance(v,dict) else v
for p,g in sorted(gain.items()):
    t=[0.0]*4; prev=None
    for ms,res in stock[p]:
        if ms>g['ms']: break
        if prev:
            for i in range(4):
                if res[i]>prev[i]: t[i]+=res[i]-prev[i]
        prev=res
    print('P%d ms=%d'%(p,g['ms']))
    for name,i in (('food',0),('wood',1),('gold',3),('stone',2)):
        print('  %-5s gain=%9.1f res+=%9.1f diff=%7.1f %s'%(name,tot(g[name]),t[i],tot(g[name])-t[i], json.dumps(g[name]) if isinstance(g[name],dict) else ''))
