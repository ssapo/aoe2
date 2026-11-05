# usage: checkpoint_words.py <census stderr with GENIE_PRINT_CHECKPOINTS=1> [player]; rec/eng per checkpoint
import re,sys
names=['sleep','res','mast','state','held','wp','live','pos','pid','act','ids']
pl=sys.argv[2] if len(sys.argv)>2 else '1'
for l in open(sys.argv[1]):
    if not l.startswith('CPWORDS'): continue
    m=re.search(r'syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[([^\]]*)\] eng=\[([^\]]*)\]',l)
    s,t,p,r,e=m.groups()
    r=list(map(int,r.split(', '))); e=list(map(int,e.split(', ')))
    if p!=pl: continue
    d=' '.join('%s:%d/%d'%(names[i],r[i],e[i]) for i in (1,2,4,6,10) )
    print('%6.1f P%s %s %s'%(int(t)/1000,p,d, 'DIFF '+','.join(names[i] for i in range(11) if r[i]!=e[i] and i not in (7,9)) ))
