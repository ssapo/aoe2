"""Daily public RM 1v1 name index; never publishes Steam identities."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json,time,urllib.request
from collect import ROOT,fetch,read_json,write_json,now


def normalize(payload):
    stats={s['statgroup_id']:s for s in payload.get('leaderboardStats',[])}
    rows=[]
    for g in payload.get('statGroups',[]):
        s=stats.get(g['id'])
        if not s:continue
        for p in g.get('members',[]):
            if isinstance(p.get('profile_id'),int) and p.get('alias'):
                rows.append({'id':p['profile_id'],'name':p['alias'],'rank':s.get('rank'),'rating':s.get('rating'),'country':p.get('country')})
    return rows


def page(start):
    url=f'https://aoe-api.worldsedgelink.com/community/leaderboard/getLeaderBoard2?title=age2&leaderboard_id=3&start={start}&count=200'
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ssapo-aoe2/1.0'}),timeout=15) as h:
        raw=h.read(10*1024*1024+1)
    if len(raw)>10*1024*1024:raise ValueError('Index response too large')
    r=json.loads(raw)
    if r.get('result',{}).get('code')!=0 or not r.get('leaderboardStats'):raise ValueError('No ladder page')
    return r


def main():
    path=ROOT/'site/data/players.json';old=read_json(path,{})
    try:
        age=(datetime.now(timezone.utc)-datetime.fromisoformat(old['updated_at'])).total_seconds()
        if age<86400 and old.get('complete'):print('Player index already current');return
    except (KeyError,ValueError):pass
    first=page(1);total=max(s.get('ranktotal',0) for s in first['leaderboardStats']);total=min(total,100000)
    fresh=old.get('updated_at') and (datetime.now(timezone.utc)-datetime.fromisoformat(old['updated_at'])).total_seconds()<86400
    players={p['id']:p for p in old.get('players',[])} if fresh else {}
    players.update({p['id']:p for p in normalize(first)})
    completed=set(old.get('completed_pages',[])) if fresh else set();completed.add(1)
    starts=set(range(1,total+1,200));errors=0
    def save(complete=False):
        result={'schema_version':1,'updated_at':now(),'scope':'ranked_rm_1v1','complete':complete,'expected_players':total,'completed_pages':sorted(completed),'players':sorted(players.values(),key=lambda p:p.get('rank') or 100001)}
        if not complete and len(old.get('players',[]))>len(players):return
        write_json(path,result)
    save()
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs={pool.submit(page,start):start for start in sorted(starts-completed)}
        for n,job in enumerate(as_completed(jobs),1):
            try:
                for p in normalize(job.result()):players[p['id']]=p
                completed.add(jobs[job])
            except Exception:errors+=1
            if n%12==0:save();print(f'Index progress: {len(players)} names',flush=True)
    save(starts<=completed);print(f'Player index: {len(players)} names; failed pages: {errors}',flush=True)



if __name__=='__main__':main()
