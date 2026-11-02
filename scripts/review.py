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
    opening, opening_label = OPENINGS.get(first['label'], ('unit:'+first['label'], first['label'])) if first else ('none', '군사 생산 지시 없음')
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
        add('review' if delta > 0 else 'advantage', STAGES[i], f'{age} 도달 {abs(delta)}초 {"뒤" if delta > 0 else "앞"}',
            f'나 {clock(a)} · 상대 {clock(b)}. 시스템 시대 도달 알림 기준.',
            '다음 판은 같은 오프닝의 시대업 클릭 전 구간부터 복기. 주민 예약·베틀·경제 업그레이드 순서와 군사 투자를 함께 확인.' if delta > 0 else '새 시대에 먼저 도달한 구간에서 첫 병력·관련 업그레이드 지시가 이어졌는지 확인.',1 if i == 0 else 2)
    first,other = mine.get('first_military_seconds'), theirs.get('first_military_seconds')
    if first is not None and other is not None and abs(first-other) >= 20:
        gap = int(first)-int(other)
        evidence = f'첫 군사 생산 지시 나 {clock(first)} · 상대 {clock(other)}.'
        action = '서로 다른 병종·빌드의 첫 생산 시각을 빠르기만으로 평가하지 말고 당시 투자 방향을 함께 확인.'
        phase,priority = phase_at(my_metrics,first),2
        a,b = mine.get('after_feudal_first_military_seconds'), theirs.get('after_feudal_first_military_seconds')
        if mine['opening'] == theirs['opening'] and mine['opening'] in {'scouts','archers','skirmishers','spears','eagles'} and a is not None and b is not None and (reached(my_metrics,'성주') is None or first<reached(my_metrics,'성주')) and (reached(their_metrics,'성주') is None or other<reached(their_metrics,'성주')):
            prep = round(a-b)
            evidence += f' 봉건 도달 후에는 나 {round(a)}초 · 상대 {round(b)}초로 준비 시간 차이 {abs(prep)}초.'
            if gap > 0 and abs(prep) < abs(gap)/2:
                action = '첫 병력 지시 지연의 대부분은 봉건 도달 차이. 마구간 조작보다 암흑 빌드·시대업 클릭 전 구간을 먼저 확인.'
                phase,priority = '암흑',1
            elif prep > 20:
                action = '봉건 도달 뒤 군사 건물 건설 지시와 첫 생산 예약 사이를 복기. 다음 판은 이 준비 구간을 줄이는 것을 목표로 연습.'
                priority=1
        add('review' if gap > 0 else 'advantage',phase,f'첫 군사 생산 지시 {abs(gap)}초 {"뒤" if gap > 0 else "앞"}',evidence,action,priority)
    for gap in sorted(mine.get('villager_command_gaps',[]), key=lambda g:g['seconds'], reverse=True):
        if not gap['review_candidate'] or gap['seconds'] < 90:
            continue
        add('review',gap['stage'],'주민 생산 예약을 다시 확인할 구간',
            f'{clock(gap["start"])}–{clock(gap["end"])} · 주민 생산 지시 사이 {round(gap["seconds"])}초. TC 실제 유휴시간과는 다름.',
            '이 구간의 생산 대기열·인구 제한·교전 집중 여부를 확인. 예약이 실제 비었다면 TC 선택 → 주민 예약을 병력 조작 사이에 넣는 연습.',2)
        break
    if mine.get('opening') == theirs.get('opening'):
        a = next((p['villager_requests'] for p in mine.get('checkpoints',[]) if p['seconds']==900),None)
        b = next((p['villager_requests'] for p in theirs.get('checkpoints',[]) if p['seconds']==900),None)
        if a is not None and b is not None and abs(a-b)>=5:
            add('investment',phase_at(my_metrics,900),'15분까지 주민 생산 지시량 차이',f'나 {a} · 상대 {b} · {abs(a-b)}명분 차이. 생존·실제 생산 주민 수가 아님.',
                '주민 예약을 줄이고 병력에 투자한 것인지, 취소·실패가 많았는지 확인. 경제 우위나 실수로 단정하지 않음.',3)
    castle_mine=next((p for p in mine.get('phases',[]) if p['stage']=='성주'),None)
    castle_other=next((p for p in theirs.get('phases',[]) if p['stage']=='성주'),None)
    a=castle_mine.get('military_requests') if castle_mine else None
    b=castle_other.get('military_requests') if castle_other else None
    if a is not None and b is not None and abs(a-b)>=10:
        add('investment','성주','성주 구간 군사 생산 지시량 차이',
            f'나 {a} ({clock(castle_mine["start"])}–{clock(castle_mine["end"])}) · 상대 {b} ({clock(castle_other["start"])}–{clock(castle_other["end"])}). 각자의 시대 도달 이후 집계이며 구간 길이는 다를 수 있음.',
            '해당 구간에서 생산을 지시한 병종과 실제 전장 투입을 대조. 승패 복기 후보이지만 실제 보유 병력·사상자·교환비나 승리 원인으로 확정하지 않음.',3)
    else:
        a,b=mine.get('military_requests'),theirs.get('military_requests')
        if a is not None and b is not None and abs(a-b)>=10:
            add('investment','전체','전체 군사 생산 지시량 차이',f'나 {a} · 상대 {b} · {abs(a-b)}명분 차이. 현재 병력·사상자·교환비와 다름.',
                '생산 지시가 많았던 병종과 실제로 전장에 투입한 시점을 함께 확인. 물량 투자 차이를 교전 효율로 해석하지 않음.',3)
    upgrades=[]
    for tech, label in TECHS.items():
        a=my_metrics.get('first_research_commands',{}).get(tech)
        b=their_metrics.get('first_research_commands',{}).get(tech)
        if a is not None and b is not None and abs(a-b)>=60:
            upgrades.append((abs(a-b),a-b,label,a,b))
    for _,delta,label,a,b in sorted(upgrades,reverse=True)[:2]:
        add('review' if delta>0 else 'advantage',phase_at(my_metrics,a),f'{label} 지시 {round(abs(delta))}초 {"뒤" if delta>0 else "앞"}',
            f'나 {clock(a)} · 상대 {clock(b)}. 최초 연구 지시이며 완료 시각은 아님.',
            '이 기술이 필요한 병력을 실제로 사용한 구간과 대조. 지시 격차가 있던 시점에 교전했는지 확인.',2)
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
                     ('첫 군사 생산 지시',a['first_military_seconds'],lambda data,s:s['first_military_seconds'])]
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
            practice={'title':'다음 판 연습 · 봉건 도달 20초 단축','current_seconds':own_feudal,'target_seconds':target,
                      'evidence':f'이번 {clock(own_feudal)} → 연습 목표 {clock(target)}. 보편적인 정답 시간이 아닌 개인 연습 목표.',
                      'action':'같은 맵·문명·빌드로 초반을 3회 연습. 주민 예약·베틀·군사 건설 순서를 적고, 봉건 클릭 직전 2분부터 확인.'}
        analysis['review']={'revision':1,'own':a,'opponent':b,'own_findings':own_findings,
                            'opponent_findings':findings(b,a,theirs,mine),'personal_benchmarks':benchmarks,'practice':practice,
                            'benchmark_basis':'same_map_civilization_first_military_order_prior_up_to_10_matches_min_3',
                            'limits':['주민·군사 수량은 생산 지시량. 실제 생산·생존 수가 아님.',
                                      '명령 간격은 TC 실제 유휴시간이 아님. 검증되지 않은 TC 유휴·교전 손실·글로벌 백분위·등급은 생성하지 않음.']}
    return report
