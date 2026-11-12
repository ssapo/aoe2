import sys,io,glob,json,bisect,csv
sys.path.insert(0,'aoe2-main/scripts')
from collect import decode_replay
from mgz.model import parse_match
import housing as H
from state_curve import read_checkpoints
orig_pay=H.Economy.pay
LOG=[]
def pay(self,cost,count=1):
    before=dict(self.stock)
    got=orig_pay(self,cost,count)
    if 'food' in cost and cost.get('food',0)<100: LOG.append((self._now,count,got,{k:round(v) for k,v in before.items()}))
    return got
H.Economy.pay=pay
orig_adv=H.Economy.advance
def adv(self,t):
    self._now=t; return orig_adv(self,t)
H.Economy.advance=adv
for rep,ad in (('518239882','truth/analysis'),('518470161','truth/analysis5'),('517426097','truth/analysis6')):
    T=[[float(x) for x in r] for r in csv.reader(open(ad+'/cache_res.csv'))]; ts=[r[0] for r in T]
    d=decode_replay(open(glob.glob(rep+'/*.aoe2record')[0],'rb').read())
    m=parse_match(io.BytesIO(d)); orders=H.read_orders(d,0.0); cps=read_checkpoints(d)
    objects={o.instance_id:(o.name,o.position.x,o.position.y) for o in list(m.gaia)+[o for p in m.players for o in p.objects]}
    for p in m.players:
        LOG.clear()
        click=H.feudal_click(orders,p.number)
        c=[(ms/1000,row[p.number][0]) for ms,row in cps if p.number in row]
        r=H.player_housing(orders,p,p.civilization,click,c,objects)
        print(rep,'P%d'%p.number,p.civilization,'refused',r['refused_queue'])
        for t,count,got,st in LOG:
            i=min(len(T)-1,bisect.bisect_left(ts,t*1000)); tr=T[i][1+4*(p.number-1):5+4*(p.number-1)]
            if got<count or abs(st['food']-tr[0])>40:
                print('   t=%6.1f asked %d paid %d  est food %4d wood %4d | truth food %6.1f wood %6.1f stone %5.1f gold %5.1f'%(t,count,got,st['food'],st['wood'],tr[0],tr[1],tr[2],tr[3]))
