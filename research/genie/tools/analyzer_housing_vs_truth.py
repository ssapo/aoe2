import sys,io,glob,json,bisect
sys.path.insert(0,'aoe2-main/scripts')
from collect import decode_replay
from mgz.model import parse_match
import housing as H
from state_curve import read_checkpoints
VILL={83,293,118,212,120,354,122,216,123,218,124,220,156,222,579,581,590,592,259,214,56,57}
POPM=VILL|{448,751,1755,74,93,4,7,13,1103}
def truth_series(jsonl,until_ms):
    out=[]  # (ms,{p:(pop,cap,houses_all)})
    step=0
    with open(jsonl,'rb') as f:
        for line in f:
            i=line.find(b'"ms":')
            if i<0: continue
            ms=int(line[i+5:line.find(b',',i)])
            if ms>until_ms: break
            if ms<step: continue
            step=ms+2000
            d=json.loads(line); row={}
            for p in d['players']:
                pop=sum(1 for o in p['o'] if o[1] in POPM and o[2]==2)
                h2=sum(1 for o in p['o'] if o[1]==70 and o[2]==2)
                hall=sum(1 for o in p['o'] if o[1]==70)
                row[p['p']]=(pop,5+5*h2,hall)
            out.append((ms,row))
    return out
for rep,jsonl in (('518239882','truth/truth4.jsonl'),('518470161','truth/truth5.jsonl'),('517426097','truth/truth6.jsonl')):
    d=decode_replay(open(glob.glob(rep+'/*.aoe2record')[0],'rb').read())
    m=parse_match(io.BytesIO(d))
    orders=H.read_orders(d,0.0)
    cps=read_checkpoints(d)
    objects={o.instance_id:(o.name,o.position.x,o.position.y) for o in list(m.gaia)+[o for p in m.players for o in p.objects]}
    res={}
    mx=0
    for p in m.players:
        click=H.feudal_click(orders,p.number)
        c=[(ms/1000,row[p.number][0]) for ms,row in cps if p.number in row]
        r=H.player_housing(orders,p,p.civilization,click,c,objects)
        res[p.number]=(p.name,click,r); mx=max(mx,click)
    T=truth_series(jsonl,int(mx*1000))
    for n,(name,click,r) in res.items():
        tl=r['timeline']; ts=[x[0] for x in tl]
        npop=ncap=tot=0; first=None; bad=[]
        for ms,row in T:
            t=ms/1000
            if t>=click or n not in row: continue
            k=max(0,bisect.bisect_right(ts,t)-1)
            ap,ac=tl[k][1],tl[k][2]; tp,tc,_=row[n]
            tot+=1
            if ap!=tp:
                npop+=1; bad.append((round(t),'pop',ap,tp))
            if ac!=tc:
                ncap+=1; bad.append((round(t),'cap',ac,tc))
        print(rep,'P%d'%n,name,'feudal click %.1f'%click,'samples',tot,'pop differs',npop,'cap differs',ncap)
        print('   blocks',[(b['from_seconds'],b['to_seconds'],b['population']) for b in r['blocks']],'blocked',r['blocked_seconds'])
        # truth pop/cap around blocks
        for b in r['blocks']:
            seg=[(round(ms/1000),)+row[n][:2] for ms,row in T if b['from_seconds']-6<=ms/1000<=b['to_seconds']+6 and n in row]
            print('   truth around block',seg)
        # truth housed periods: pop>=cap
        housed=[round(ms/1000) for ms,row in T if n in row and ms/1000<click and row[n][0]>=row[n][1]]
        print('   truth pop>=cap at',housed[:40])
        print('   first diffs',bad[:12])
        segs=[];prev=None
        for ms,row in T:
            t=ms/1000
            if t>=click or n not in row: continue
            k=max(0,bisect.bisect_right(ts,t)-1)
            dlt=tl[k][1]-row[n][0]
            if dlt!=prev: segs.append((round(t),dlt)); prev=dlt
        print('   pop analyzer-truth segments',segs[:30])
        print('   refused',json.dumps(r['refused_queue'],ensure_ascii=False)[:400], 'civ',[p.civilization for p in m.players if p.number==n])
