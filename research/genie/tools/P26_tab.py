import re,sys,glob
# tab.py <prefix> : per game: stop, per player first mismatch (time, {word:eng-rec}), first word1, site span
civ={40:'Dravidians',45:'Georgians',25:'Ethiopians',58:'Mapuche',16:'Maya',62:'Danes',38:'Poles',3:'Goths',4:'Teutons',27:'Berbers',36:'Burgundians',50:'Wu',28:'Khmer',5:'Japanese',12:'Mongols',26:'Malians',19:'Italians',51:'Wei',60:'Saxons',30:'Burmese',13:'Celts',10:'Turks',34:'Cumans',17:'Huns',61:'Varangians'}
pre=sys.argv[1]; picks=[l.split() for l in open('P26_out/picks.txt')]
def fmt(t): return '%d:%04.1f'%(t//60,t%60)
for g,pid,name in picks:
    f='%s_%s'%(pre,g); cps={}
    for l in open(f+'.err',errors='replace'):
        if not l.startswith('CPWORDS'): continue
        m=re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\] eng=\[(.*?)\]',l)
        if not m: continue
        p=int(m.group(3)); r=m.group(4).split(','); e=m.group(5).split(',')
        d={i:int(e[i])-int(r[i]) for i in range(len(r)) if r[i].strip()!=e[i].strip()}
        cps.setdefault(p,[]).append((int(m.group(2))/1000,d,int(m.group(1))))
    out=open(f+'.out',errors='replace').read()
    stops=re.findall(r'player (\d): (stops at update \d+: [^;]*|no stop)',out)
    last=None
    for t in sorted({c[0] for p in cps for c in cps[p]}):
        if any(1 in c[1] for p in cps for c in cps[p] if c[0]==t): break
        last=t
    print('%s %s'%(g,name), 'site', fmt(last) if last else 'none')
    for p in sorted(cps):
        bad=[c for c in cps[p] if c[1]]; w1=[c for c in cps[p] if 1 in c[1]]
        st=[s for q,s in stops if int(q)==p]
        print('  P%d first %s %s | w1 %s | %s'%(p, ('%.1f'%bad[0][0]) if bad else 'none', bad[0][1] if bad else '', ('%.1f %+d'%(w1[0][0],w1[0][1][1])) if w1 else 'none', st[0][:90] if st else ''))
