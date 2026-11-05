# usage: hud_compare.py <census stderr with GENIE_DUMP_MS>... ; compares player 1 DUMP attrs with original-game-518239882.json
import re,sys,json
orig=json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','original-game-518239882.json')))['hud_series']
o={}
for x in orig:
    h,m,s=map(int,x['time'].split(':')); o[(h*3600+m*60+s)*1000]=x
def parse(f):
    r={}
    for l in open(f):
        if not l.startswith('DUMP') or ' player=1 ' not in l: continue
        mk=int(re.search(r'mark_ms=(\d+)',l).group(1))
        a=dict((int(k),float(v)) for k,v in re.findall(r'(\d+)=Amount\(([-0-9.e]+)\)',l))
        g=lambda i:a.get(i,0.0)
        r[mk]=(g(0),g(1),g(3),g(2),int(g(11)),int(g(11)+g(4)),int(g(37)))
    return r
fs=sys.argv[1:]
rs=[parse(f) for f in fs]
print('time | original F/W/G/S pop vils | '+' | '.join(fs))
for mk in sorted(rs[0]):
    x=o.get(mk) or o.get(mk-1000)
    t='%d:%02d'%(mk//60000,mk//1000%60)
    ov='%s/%s/%s/%s %s %s'%(x['food'],x['wood'],x['gold'],x['stone'],x['pop'],x['villagers']) if x else '-'
    cols=[]
    for r in rs:
        v=r.get(mk)
        cols.append('%.0f/%.0f/%.0f/%.0f %d/%d civ%d'%v if v else '-')
    print(t,'|',ov,'|',' | '.join(cols))
