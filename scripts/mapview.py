"""Initial terrain and recorded building targets; never reconstructed game state."""
import math


def point(pos, size):
    if pos is None:
        return None
    x,y=getattr(pos,'x',None),getattr(pos,'y',None)
    if not all(isinstance(v,(int,float)) and math.isfinite(v) and 0<=v<size for v in (x,y)):
        return None
    return {'x':round(x,3),'y':round(y,3)}


def building_map(match, own):
    size=match.map.dimension
    if not isinstance(size,int) or not 1<=size<=512:
        return None
    tiles=[None]*(size*size)
    for t in match.map.tiles:
        p=point(t.position,size)
        if p and float(p['x']).is_integer() and float(p['y']).is_integer():
            tiles[int(p['y'])*size+int(p['x'])]=[t.terrain,t.elevation]
    if any(t is None for t in tiles):
        return None
    runs=[]
    for terrain,height in tiles:
        if runs and runs[-1][:2]==[terrain,height]:runs[-1][2]+=1
        else:runs.append([terrain,height,1])
    initial=[]
    for p in match.players:
        side='mine' if p.number==own.number else 'theirs'
        for o in p.objects:
            # A TC has several auxiliary sprites/objects. Only the main 109 is shown.
            if o.class_id==80 and o.name and o.object_id not in {618,619,620}:
                pos=point(o.position,size)
                if pos:initial.append(dict(pos,label=o.name,side=side,seconds=0,initial=True))
    resources=[]
    for o in getattr(match,'gaia',[]):
        name=o.name or ''
        kind=next((k for k,terms in [('gold',('Gold Mine',)),('stone',('Stone Mine',)),('berries',('Forage Bush','Berry Bush'))] if any(t in name for t in terms)),None)
        pos=point(o.position,size)
        if kind and pos:resources.append(dict(pos,kind=kind))
    # Labels come from the same installed reference dataset as mgz.
    import aocref
    from pathlib import Path
    import json
    terrain=json.loads((Path(aocref.__file__).parent/'data/datasets/100.json').read_text(encoding='utf-8'))['terrain']
    names={str(t):terrain.get(str(t),str(t)) for t in {v[0] for v in runs}}
    return {'size':size,'terrain_runs':runs,'terrain_names':names,'initial_buildings':initial,
            'resources':resources,'basis':'initial_terrain_and_recorded_build_targets'}
