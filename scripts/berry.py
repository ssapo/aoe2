"""Estimate berry-worker reassignment windows from explicit commands, not depletion."""
import io
import math


def estimate_berry_switches(raw, match):
    from mgz import fast
    from mgz.fast.header import parse
    objects={o.instance_id:o for o in match.gaia}
    for p in match.players:objects.update({o.instance_id:o for o in p.objects})
    berries={i:o for i,o in objects.items() if o.name in {'Fruit Bush','Forage Bush','Berry Bush'}}
    parent={i:i for i in berries}
    def root(i):
        while parent[i]!=i:i=parent[i]
        return i
    for i,a in berries.items():
        for j,b in berries.items():
            if i<j and math.hypot(a.position.x-b.position.x,a.position.y-b.position.y)<=6:
                parent[root(j)]=root(i)
    clusters={i:root(i) for i in berries}
    eco_buildings={a.payload.get('building_id') for a in match.actions if a.type.name=='BUILD' and a.payload.get('building') in {'Farm','House','Mill','Lumber Camp','Mining Camp','Town Center'}}
    workers={p.number:{o.instance_id for o in p.objects if o.name=='Villager'} for p in match.players}
    commands=[];h=io.BytesIO(raw);parse(h);fast.meta(h);clock=0
    while True:
        try:kind,value=fast.operation(h)
        except EOFError:break
        if kind is fast.Operation.SYNC:clock+=value[0]
        elif kind is fast.Operation.ACTION:
            action,payload=value;pid=payload.get('player_id')
            if pid not in workers:continue
            ids=payload.get('object_ids') or []
            if action is fast.Action.BUILD and payload.get('building_id') in eco_buildings:
                workers[pid].update(ids)
            if action in (fast.Action.ORDER,fast.Action.BUILD):
                commands.append((round(clock/1000+match.restored_at.total_seconds(),2),pid,action.name,payload))
    active={p.number:{} for p in match.players};seen={p.number:{} for p in match.players};events={p.number:[] for p in match.players}
    for at,pid,kind,payload in commands:
        ids=set(payload.get('object_ids') or [])&workers[pid]
        target=payload.get('target_id')
        if kind=='ORDER' and target in berries:
            cluster=clusters[target]
            for iid in ids:
                active[pid][iid]=(cluster,at)
                seen[pid].setdefault(cluster,set()).add(iid)
            continue
        obj=objects.get(target)
        resource=obj and (obj.name or '').startswith(('Tree','Gold Mine','Stone Mine'))
        building=kind=='BUILD' and payload.get('building_id') in eco_buildings
        if not (resource or building):continue
        for iid in ids:
            previous=active[pid].pop(iid,None)
            if previous is not None and at-previous[1]>=30:
                events[pid].append({'worker':iid,'cluster':previous[0],'seconds':at,'task':'건설' if building else obj.name})
    return summarize_switches(events,seen,berries,clusters)


def summarize_switches(events,seen,berries,clusters):
    result={}
    for pid,items in events.items():
        windows=[]
        for cluster,assigned in seen[pid].items():
            subset=sorted([e for e in items if e['cluster']==cluster],key=lambda e:e['seconds'])
            candidates=[]
            for start in subset:
                group=[e for e in subset if start['seconds']<=e['seconds']<=start['seconds']+45]
                unique={e['worker'] for e in group}
                # Require several workers and a majority of those observed at this cluster.
                if len(unique)>=2 and len(unique)/len(assigned)>=0.6:
                    candidates.append((group,len(unique)))
            if not candidates:continue
            # Prefer the largest observed reassignment; use the latest on equal counts.
            group,count=max(candidates,key=lambda x:(x[1],x[0][-1]['seconds']))
            bushes=[o for i,o in berries.items() if clusters[i]==cluster]
            windows.append({'start_seconds':group[0]['seconds'],'end_seconds':group[-1]['seconds'],
                            'workers':count,'observed_berry_workers':len(assigned),
                            'position':{'x':round(sum(o.position.x for o in bushes)/len(bushes),1),'y':round(sum(o.position.y for o in bushes)/len(bushes),1)},
                            'tasks':sorted({e['task'] for e in group})})
        result[pid]={'windows':windows,'confirmed_reassignments':len(items),'method':'explicit_worker_ids_cluster_majority_45s','depletion_confirmed':False}
    return result
