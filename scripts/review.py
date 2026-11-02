"""Evidence-linked coaching from recorded orders, not a game-state simulation."""
from statistics import median

AGES = ('봉건', '성주', '왕정')
STAGES = ('암흑', '봉건', '성주', '왕정')
CIVILIAN = {'Villager', 'Fishing Ship', 'Trade Cart', 'Trade Cog', 'Transport Ship', 'Fishing Boat'}
TC_RESEARCH = {'Loom', 'Wheelbarrow', 'Hand Cart', 'Town Watch', 'Town Patrol', 'Feudal Age', 'Castle Age', 'Imperial Age'}
OPENINGS = {
    'Scout Cavalry': ('scouts', '정찰 기병'), 'Camel Scout': ('scouts', '정찰 기병'),
    'Archer': ('archers', '궁사'), 'Skirmisher': ('skirmishers', '척후병'),
    'Militia': ('militia', '민병대'), 'Man-at-Arms': ('militia', '보병'),
    'Spearman': ('spears', '창병'), 'Knight': ('knights', '기사'),
    'Eagle Scout': ('eagles', '독수리 정찰병'), 'Eagle Warrior': ('eagles', '독수리 전사'),
}
TECHS = {'Double-Bit Axe': '이중날 도끼', 'Bow Saw': '활톱', 'Wheelbarrow': '외바퀴 수레',
         'Hand Cart': '손수레', 'Scale Barding Armor': '기병 방어 1단계', 'Chain Barding Armor': '기병 방어 2단계',
         'Forging': '근접 공격 1단계', 'Iron Casting': '근접 공격 2단계', 'Fletching': '궁사 공격 1단계',
         'Bodkin Arrow': '궁사 공격 2단계', 'Bloodlines': '혈통', 'Husbandry': '사육술', 'Ballistics': '탄도학'}


def clock(t):
    return f'{int(t)//60}:{int(t)%60:02d}'


def reached(metrics, age):
    return (metrics.get('age_checkpoints') or {}).get(age, {}).get('reached_seconds')


def summarize(metrics, duration):
    timeline = metrics.get('full_timeline')
    if timeline is None:
        return {'available': False}
    queue = [e for e in timeline if e['kind'] in {'QUEUE', 'DE_QUEUE', 'MULTIQUEUE'}
             and isinstance(e.get('amount'), int) and not isinstance(e['amount'], bool) and e['amount'] > 0]
    military = [e for e in queue if e['label'] not in CIVILIAN and not e['label'].startswith('Unit ')]
    villagers = [e for e in queue if e['label'] == 'Villager']
    unknown = {e['label'] for e in timeline if e['kind'] in {'QUEUE', 'DE_QUEUE', 'MULTIQUEUE'} and (not isinstance(e.get('amount'), int) or isinstance(e.get('amount'), bool))}
    unknown_military = any(k not in CIVILIAN for k in unknown) or any(e['label'].startswith('Unit ') for e in queue)
    first = min(military, key=lambda e: e['seconds']) if military else None
    opening, opening_label = OPENINGS.get(first['label'], ('unit:'+first['label'], first['label'])) if first else ('none', '병력 생산 요청 없음')
    restored = bool(metrics.get('recording_restored'))
    record_start = min((e['seconds'] for e in timeline),default=0) if restored else 0
    if restored:opening_label='재개 기록 · '+opening_label
    starts = [(record_start, '기록 구간' if restored else '암흑')] + [(reached(metrics, age), age) for age in AGES if reached(metrics, age) is not None]
    starts.sort()
    def stage_at(t):
        return next((name for at, name in reversed(starts) if at <= t), '암흑')
    def amount(events, stop=None):
        return sum(e['amount'] for e in events if stop is None or e['seconds'] <= stop)
    checkpoints = [{'seconds': t, 'villager_requests': None if 'Villager' in unknown else amount(villagers, t),
                    'military_requests': None if unknown_military else amount(military, t)}
                   for t in (300, 600, 900, 1200, 1500, 1800) if record_start <= t <= duration]
    phases = []
    for i, (at, name) in enumerate(starts):
        end = starts[i+1][0] if i+1 < len(starts) else duration
        if end <= at:
            continue
        def in_phase(e):
            return at <= e['seconds'] and (e['seconds'] < end or i==len(starts)-1 and e['seconds']==end)
        subset = [e for e in timeline if in_phase(e)]
        phases.append({'stage': name, 'start': at, 'end': end,
                       'villager_requests': None if 'Villager' in unknown else sum(e['amount'] for e in villagers if in_phase(e)),
                       'military_requests': None if unknown_military else sum(e['amount'] for e in military if in_phase(e)),
                       'research_kinds': len({e['label'] for e in subset if e['kind'] == 'RESEARCH'}),
                       'building_commands': sum(e['kind'] == 'BUILD' for e in subset)})
    research = [e for e in timeline if e['kind'] == 'RESEARCH' and e['label'] in TC_RESEARCH]
    transition = [(metrics.get('age_commands', {}).get(age), reached(metrics, age)) for age in AGES]
    gaps = []
    for left, right in zip(villagers, villagers[1:]):
        start, end = left['seconds'], right['seconds']
        if end-start < 60:
            continue
        overlaps_age = any(a is not None and b is not None and a < end and b > start for a,b in transition)
        nearby_research = any(start-120 <= e['seconds'] <= end for e in research)
        gaps.append({'start': start, 'end': end, 'seconds': round(end-start, 2), 'stage': stage_at(start),
                     'review_candidate': start < 1200 and left['amount'] == 1 and not overlaps_age and not nearby_research})
    feudal = reached(metrics, '봉건')
    return {'available': True, 'opening': opening, 'opening_label': opening_label,
            'opening_basis': 'first_positive_military_queue_family_not_strategy_confirmation',
            'first_military_seconds': first['seconds'] if first else None,
            'first_military_unit': first['label'] if first else None,
            'after_feudal_first_military_seconds': round(first['seconds']-feudal,2) if first and feudal is not None and first['seconds'] >= feudal else None,
            'villager_requests': None if 'Villager' in unknown else amount(villagers),
            'military_requests': None if unknown_military else amount(military),
            'military_types': len({e['label'] for e in military}),
            'research_kinds': len({e['label'] for e in timeline if e['kind'] == 'RESEARCH'}),
            'additional_tc_build_commands': metrics.get('building_orders', {}).get('Town Center', {}).get('commands', 0),
            'checkpoints': checkpoints, 'phases': phases, 'villager_command_gaps': gaps,
            'restored': bool(metrics.get('recording_restored'))}


def findings(mine, theirs, my_metrics, their_metrics):
    result = []
    def add(kind, stage, title, evidence, action, priority=2):
        result.append({'kind': kind, 'stage': stage, 'title': title, 'evidence': evidence,
                       'action': action, 'priority': priority})
    def phase_at(metrics,t):
        return next((age for age in reversed(AGES) if reached(metrics,age) is not None and reached(metrics,age)<=t),'암흑')
    for i, age in enumerate(AGES):
        a,b = reached(my_metrics,age), reached(their_metrics,age)
        if a is None or b is None or abs(a-b) < 20:
            continue
        delta = int(a)-int(b)
        add('review' if delta > 0 else 'advantage', STAGES[i], f'{age} {abs(delta)}초 {"늦음" if delta > 0 else "빠름"}',
            f'나 {clock(a)} · 상대 {clock(b)}.',
            '시대업을 누르기 전 2분을 먼저 돌려보세요. 주민 생산이 끊겼는지, 베틀이나 건물 순서가 달랐는지 살펴보면 좋아요.' if delta > 0 else '시대를 먼저 올린 뒤 병력과 업그레이드도 바로 준비했는지 살펴보세요.',1 if i == 0 else 2)
    first,other = mine.get('first_military_seconds'), theirs.get('first_military_seconds')
    if first is not None and other is not None and abs(first-other) >= 20:
        gap = int(first)-int(other)
        evidence = f'첫 병력 생산 요청 · 나 {clock(first)} · 상대 {clock(other)}.'
        action = '첫 병종이나 빌드가 다르면 준비 시간도 달라져요. 어떤 병력을 먼저 준비했는지 함께 보세요.'
        phase,priority = phase_at(my_metrics,first),2
        a,b = mine.get('after_feudal_first_military_seconds'), theirs.get('after_feudal_first_military_seconds')
        if mine['opening'] == theirs['opening'] and mine['opening'] in {'scouts','archers','skirmishers','spears','eagles'} and a is not None and b is not None and (reached(my_metrics,'성주') is None or first<reached(my_metrics,'성주')) and (reached(their_metrics,'성주') is None or other<reached(their_metrics,'성주')):
            prep = round(a-b)
            evidence += f' 봉건이 된 뒤 첫 요청까지 나 {round(a)}초 · 상대 {round(b)}초로 {abs(prep)}초 차이예요.'
            if gap > 0 and abs(prep) < abs(gap)/2:
                action = '봉건이 늦었던 영향이 커 보여요. 생산 건물 조작보다 봉건을 누르기 전 빌드를 먼저 살펴보세요.'
                phase,priority = '암흑',1
            elif prep > 20:
                action = '봉건이 된 뒤 첫 병력을 요청하기까지 시간이 걸렸어요. 군사 건물을 언제 짓고 생산을 눌렀는지 돌려보세요.'
                priority=1
        add('review' if gap > 0 else 'advantage',phase,f'첫 병력 요청 {abs(gap)}초 {"늦음" if gap > 0 else "빠름"}',evidence,action,priority)
    for gap in sorted(mine.get('villager_command_gaps',[]), key=lambda g:g['seconds'], reverse=True):
        if not gap['review_candidate'] or gap['seconds'] < 90:
            continue
        add('review',gap['stage'],'주민 생산을 다시 볼 구간',
            f'{clock(gap["start"])}–{clock(gap["end"])} · 주민 생산 요청이 {round(gap["seconds"])}초 동안 없었어요. TC가 그만큼 쉬었다는 뜻은 아니에요.',
            '당시 생산 대기열과 인구 제한을 확인해 보세요. 대기열이 비어 있었다면 병력을 움직인 뒤 TC에서 주민을 예약하는 습관을 들여보세요.',2)
        break
    if mine.get('opening') == theirs.get('opening'):
        a = next((p['villager_requests'] for p in mine.get('checkpoints',[]) if p['seconds']==900),None)
        b = next((p['villager_requests'] for p in theirs.get('checkpoints',[]) if p['seconds']==900),None)
        if a is not None and b is not None and abs(a-b)>=5:
            add('investment',phase_at(my_metrics,900),'15분까지 주민 생산 요청 비교',f'나 {a} · 상대 {b} · {abs(a-b)} 차이.',
                '주민 대신 병력을 준비한 건지, 생산 요청이 취소됐거나 실행되지 않은 건지 살펴보세요.',3)
    castle_mine=next((p for p in mine.get('phases',[]) if p['stage']=='성주'),None)
    castle_other=next((p for p in theirs.get('phases',[]) if p['stage']=='성주'),None)
    a=castle_mine.get('military_requests') if castle_mine else None
    b=castle_other.get('military_requests') if castle_other else None
    if a is not None and b is not None and abs(a-b)>=10:
        add('investment','성주','성주 때 병력 생산 요청 비교',
            f'나 {a} ({clock(castle_mine["start"])}–{clock(castle_mine["end"])}) · 상대 {b} ({clock(castle_other["start"])}–{clock(castle_other["end"])}). 각자 성주가 된 뒤의 기록이라 집계 구간은 달라요.',
            '요청한 병력이 언제 전장에 도착했는지 돌려보세요. 많이 요청한 것과 교전에서 잘 싸운 것은 따로 봐야 해요.',3)
    else:
        a,b=mine.get('military_requests'),theirs.get('military_requests')
        if a is not None and b is not None and abs(a-b)>=10:
            add('investment','전체','병력 생산 요청 비교',f'나 {a} · 상대 {b} · {abs(a-b)} 차이.',
                '어떤 병력을 많이 요청했고 언제 싸움에 투입했는지 살펴보세요.',3)
    for age, point in my_metrics.get('age_checkpoints', {}).items():
        trades = point.get('market_previous_120s', [])
        if not trades:
            continue
        totals = {}
        for e in trades:
            key = (e['kind'], e['label'])
            totals[key] = totals.get(key, 0) + e['amount']
        summary = ' · '.join(f'{resource} {amount} {"구매" if kind == "BUY" else "판매"}' for (kind,resource),amount in totals.items())
        at = point['command_seconds']
        add('investment', phase_at(my_metrics,at), f'{age} 누르기 전 시장 이용',
            f'{clock(max(0,at-120))}–{clock(at)} · {summary} 요청.',
            '부족한 자원을 시장에서 채웠는지 볼 구간이에요. 거래가 시대업을 앞당겼는지, 이후 병력이나 TC에 쓸 자원이 부족해졌는지 함께 살펴보세요.',2)
    upgrades=[]
    for tech, label in TECHS.items():
        a=my_metrics.get('first_research_commands',{}).get(tech)
        b=their_metrics.get('first_research_commands',{}).get(tech)
        if a is not None and b is not None and abs(a-b)>=60:
            upgrades.append((abs(a-b),a-b,label,a,b))
    for _,delta,label,a,b in sorted(upgrades,reverse=True)[:2]:
        add('review' if delta>0 else 'advantage',phase_at(my_metrics,a),f'{label} 요청 {round(abs(delta))}초 {"늦음" if delta>0 else "빠름"}',
            f'나 {clock(a)} · 상대 {clock(b)}. 연구를 누른 시각이에요.',
            '이 업그레이드가 필요한 병력으로 언제 싸웠는지 보세요. 연구가 끝나기 전에 교전했는지도 확인해 보세요.',2)
    return sorted(result,key=lambda f:f['priority'])


def enrich_report(report):
    matches=report.get('matches',[])
    for match in matches:
        analysis=match.get('analysis')
        if not analysis:
            continue
        duration=analysis.get('duration_game_seconds',0)
        mine=analysis.get('metrics',{})
        other=analysis.get('opponents',[])
        if len(other)!=1:
            continue
        theirs=other[0].get('metrics',{})
        a,b=summarize(mine,duration),summarize(theirs,duration)
        if not a['available'] or not b['available']:
            continue
        own_findings=findings(a,b,mine,theirs)
        benchmarks=[]
        # Personal historical samples only; never manufacture global percentiles.
        earlier=[]
        for row in sorted(matches,key=lambda row:row.get('started_at') or 0,reverse=True):
            data=row.get('analysis') or {}
            if row['id']==match['id'] or (row.get('started_at') or 0)>=(match.get('started_at') or 0):
                continue
            if data.get('civilization')!=analysis.get('civilization') or data.get('map')!=analysis.get('map'):
                continue
            summary=summarize(data.get('metrics',{}),data.get('duration_game_seconds',0))
            if summary.get('available') and summary.get('opening')==a.get('opening') and not summary.get('restored'):
                earlier.append((data,summary))
        earlier=earlier[:10]
        descriptors=[('봉건 도달',reached(mine,'봉건'),lambda data,s:reached(data.get('metrics',{}),'봉건')),
                     ('성주 도달',reached(mine,'성주'),lambda data,s:reached(data.get('metrics',{}),'성주')),
                     ('첫 병력 생산 요청',a['first_military_seconds'],lambda data,s:s['first_military_seconds'])]
        if not a.get('restored'):
            for label,value,get in descriptors:
                values=[get(data,s) for data,s in earlier if get(data,s) is not None]
                if value is None or len(values)<3:
                    continue
                typical=round(median(values),2)
                benchmarks.append({'label':label,'current_seconds':value,'median_seconds':typical,'samples':len(values),'delta_seconds':round(value-typical,2)})
        practice=None
        own_feudal,other_feudal=reached(mine,'봉건'),reached(theirs,'봉건')
        if own_feudal is not None and other_feudal is not None and own_feudal-other_feudal>=20:
            target=max(0,own_feudal-20)
            practice={'title':'다음 판은 봉건 20초 빠르게','current_seconds':own_feudal,'target_seconds':target,
                      'evidence':f'이번 {clock(own_feudal)} → 연습 목표 {clock(target)}. 이번 기록에서 20초 줄여보는 연습 목표예요.',
                      'action':'같은 맵과 빌드로 초반만 세 번 연습해 보세요. 주민 생산, 베틀, 건물 순서를 적어두면 어디서 늦어지는지 찾기 쉬워요.'}
        analysis['review']={'revision':1,'own':a,'opponent':b,'own_findings':own_findings,
                            'opponent_findings':findings(b,a,theirs,mine),'personal_benchmarks':benchmarks,'practice':practice,
                            'benchmark_basis':'same_map_civilization_first_military_order_prior_up_to_10_matches_min_3',
                            'limits':['주민·군사 수량은 생산 지시량. 실제 생산·생존 수가 아님.',
                                      '명령 간격은 TC 실제 유휴시간이 아님. 검증되지 않은 TC 유휴·교전 손실·글로벌 백분위·등급은 생성하지 않음.']}
    return report
