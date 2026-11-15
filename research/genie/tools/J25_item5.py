# ENG-25: per run, ITEM5 lines before each player's first mismatching CPWORDS line (stderr order)
import sys,re,glob
for f in sorted(glob.glob(sys.argv[1]+'_*.err')):
    first={}; hits=[]; n=0
    for line in open(f,errors='replace'):
        if line.startswith('CPWORDS'):
            m=re.search(r'player=(\d+) rec=(\[.*?\]) eng=(\[.*?\])',line)
            if m and m.group(2)!=m.group(3) and m.group(1) not in first: first[m.group(1)]=n
        elif line.startswith('ITEM5'):
            hits.append((n,line.strip()))
        n+=1
    out={}
    for i,h in hits:
        tag=h.split()[1]; pm=re.search(r'player=PlayerId\((\d+)\)',h) or re.search(r'player=(\d+)',h)
        p=pm.group(1) if pm else None
        before = (i < first.get(p,10**12)) if p else ('P1' if i<first.get('1',10**12) else '')+('P2' if i<first.get('2',10**12) else '')
        k=(tag,p); a=out.setdefault(k,[0,0]); a[0]+=1
        if before is True or (isinstance(before,str) and before): a[1]+=1
    print(f.split('/')[-1], {f'{t}/p{p}':f'{a[1]}/{a[0]} before' for (t,p),a in out.items()})
