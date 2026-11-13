# usage: python site_until.py <runs dir> <prefix> [<prefix> ...] : the site's rule on each run's .err
# (verified until = the last checkpoint before either player's first word-1 mismatch), plus stops from .out
import re, sys, os
R=['p_239','p_161','p_097','n_894','n_090','n_670','q_411','q_236','q_901','q_921','q_057']
def until(err):
    v={}
    for l in open(err,'rb'):
        if not l.startswith(b'CPWORDS'): continue
        m=re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\] eng=\[(.*?)\]',l.decode('latin1'))
        p=int(m.group(3)); ms=int(m.group(2)); rec=m.group(4).split(','); eng=m.group(5).split(',')
        st=v.setdefault(p,[0,False])
        if st[1]: continue
        if rec[1].strip()==eng[1].strip(): st[0]=ms
        else: st[1]=True
    return {p:st[0] for p,st in v.items()}, {p:st[1] for p,st in v.items()}
def stops(out):
    s={}
    for l in open(out,errors='replace'):
        m=re.match(r'player (\d): (no stop|stops at update (\d+): (.*?));',l)
        if m: s[int(m.group(1))]=(m.group(3), (m.group(4) or '')[:60])
    return s
d=sys.argv[1]
def mmss(ms): s=ms/1000; return '%d:%04.1f'%(s//60, s%60)
for r in R:
    row=[r]
    for pre in sys.argv[2:]:
        e=os.path.join(d,'%s_%s.err'%(pre,r))
        if not os.path.exists(e): row.append('-'); continue
        u,br=until(e); st=stops(os.path.join(d,'%s_%s.out'%(pre,r)))
        both=min(u.get(1,0),u.get(2,0))
        row.append('%s until %s (P1 %s%s, P2 %s%s) stops %s'%(pre,mmss(both),mmss(u.get(1,0)),'' if br.get(1) else '+',mmss(u.get(2,0)),'' if br.get(2) else '+',
            ' '.join('P%d@%s'%(p,st[p][0]) for p in sorted(st) if st[p][0]) or 'none'))
    print(' | '.join(row))
