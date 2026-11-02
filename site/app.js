'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const repo = 'ssapo/aoe2';
  let report = {profile:null, matches:[]}, filter = 'all', visible = 12;
  let toastTimer;
  const fmtTime = (s) => Number.isFinite(s) ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` : '—';
  const date = (stamp) => stamp ? new Date(typeof stamp === 'number' ? stamp*1000 : stamp).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '아직 수집 전';
  const number = (n) => Number.isFinite(n) ? n.toLocaleString('ko-KR') : '—';
  const names = {
    'Villager':'주민','Scout Cavalry':'정찰 기병','Knight':'기사','Cavalier':'고급 기병','Paladin':'팔라딘',
    'Archer':'궁사','Crossbowman':'석궁병','Arbalester':'철석궁병','Skirmisher':'척후병',
    'Elite Skirmisher':'정예 척후병','Spearman':'창병','Pikeman':'장창병','Halberdier':'미늘창병',
    'Cavalry Archer':'기마 궁사','Monk':'수도사','Mangonel':'망고넬','Battering Ram':'공성추',
    'Town Center':'마을 회관','House':'집','Farm':'농장','Mill':'제분소','Lumber Camp':'제재목 캠프',
    'Mining Camp':'채광 캠프','Barracks':'보병 양성소','Archery Range':'궁사 양성소','Stable':'기병 양성소',
    'Blacksmith':'대장간','Market':'시장','Monastery':'수도원','Siege Workshop':'공성 무기 제조소',
    'Castle':'성','University':'대학','Dock':'항구','Loom':'베틀',
    'Double-Bit Axe':'이중날 도끼','Bow Saw':'활톱','Two-Man Saw':'2인용 톱',
    'Horse Collar':'말 목장','Heavy Plow':'중형 쟁기','Crop Rotation':'윤작',
    'Wheelbarrow':'외바퀴 수레','Hand Cart':'손수레','Gold Mining':'금 채광','Stone Mining':'석재 채광',
    'Fletching':'궁사 공격 1단계','Bodkin Arrow':'궁사 공격 2단계','Bracer':'궁사 공격 3단계',
    'Forging':'근접 공격 1단계','Iron Casting':'근접 공격 2단계','Blast Furnace':'근접 공격 3단계',
    'Scale Barding Armor':'기병 방어 1단계','Chain Barding Armor':'기병 방어 2단계',
    'Plate Barding Armor':'기병 방어 3단계','Bloodlines':'혈통','Husbandry':'사육술','Ballistics':'탄도학',
    'Feudal Age':'봉건 시대','Castle Age':'성주 시대','Imperial Age':'왕정 시대'
  };
  const label = value => names[value] || value;
  const ageList = ['봉건','성주','왕정'];
  const quantities = counts => Object.entries(counts||{}).filter(([,v])=>v>0).map(([k,v])=>`${label(k)} ${number(v)}`).join(' · ') || '지시 없음';
  function compareTable(rows, other) {
    return `<div class="table-scroll"><table class="timeline comparison"><thead><tr><th scope="col">항목</th><th scope="col">나 (${esc(report.profile?.name||'ssapo')})</th><th scope="col">상대 (${esc(other?.name||'정보 없음')}${other?.civilization?' · '+esc(other.civilization):''})</th></tr></thead><tbody>${rows.map(([title,left,right])=>`<tr><th scope="row">${esc(title)}</th><td>${esc(left)}</td><td>${esc(right)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderExpandedComparison(mine, theirs, other) {
    if(!mine.age_checkpoints && !theirs.age_checkpoints)return '';
    let html='<h3 class="detail-heading">시대업 클릭 당시 기록</h3><p class="detail-note">아래 주민 수량은 <strong>누적 생산 지시량</strong>이며 실제 일꾼 수가 아님. 실제 주민 수는 현재 데이터로 복원할 수 없어 표시하지 않음.</p>';
    for(const age of ageList){
      const left=mine.age_checkpoints?.[age],right=theirs.age_checkpoints?.[age];
      if(!left&&!right)continue;
      const requests=p=>p&&Number.isFinite(p.command_seconds)&&!p.unknown_unit_request_amounts?.includes('Villager')?number(p.unit_requests_before_click?.Villager??0):'—';
      const recent=p=>p&&Number.isFinite(p.command_seconds)?quantities(p.unit_requests_previous_120s):'—';
      const prior=p=>p&&Number.isFinite(p.command_seconds)?quantities(Object.fromEntries(Object.entries(p.unit_requests_before_click||{}).filter(([k])=>k!=='Villager'))):'—';
      html+=`<h4 class="checkpoint-title">${age}</h4>`+compareTable([
        ['첫 시대업 클릭',fmtTime(left?.command_seconds),fmtTime(right?.command_seconds)],
        ['실제 시대 도달',fmtTime(left?.reached_seconds),fmtTime(right?.reached_seconds)],
        ['주민 생산 지시량 (누적)',requests(left),requests(right)],
        ['다른 유닛 생산 지시량 (누적)',prior(left),prior(right)],
        ['클릭 전 2분 생산 지시량',recent(left),recent(right)]
      ],other);
    }
    html+='<p class="detail-note">시작 주민 제외. 생산 대기·취소·실패·사망·전향 미반영. 시대 도달은 시스템 알림 기준. 클릭은 최초 지시이므로 취소·재지시 시 실제 연구 시작과 다를 수 있음.</p>';
    if(mine.recording_restored||theirs.recording_restored)html+='<p class="detail-note">재개된 리플: 누적량은 기록 시작 이후 명령만 포함.</p>';
    const sections=[
      ['유닛별 생산 지시','unit_orders',v=>`${fmtTime(v.first_seconds)} 첫 지시 · 수량 ${number(v.requested_amount)} · ${v.commands}회${v.negative_amount?' · 음수 수량 '+number(v.negative_amount):''}${v.unknown_amount_commands?' · 일부 수량 판독 불가':''}`],
      ['경제·군사 업그레이드 지시','research_orders',v=>`${fmtTime(v.first_seconds)} · ${v.commands}회`],
      ['건물별 건설 지시','building_orders',v=>`${fmtTime(v.first_seconds)} 첫 지시 · ${v.commands}회`]
    ];
    for(const [title,key,format] of sections){
      const keys=[...new Set([...Object.keys(mine[key]||{}),...Object.keys(theirs[key]||{})])]
        .filter(k=>key!=='research_orders'||!['Feudal Age','Castle Age','Imperial Age'].includes(k))
        .sort((x,y)=>Math.min(mine[key]?.[x]?.first_seconds??Infinity,theirs[key]?.[x]?.first_seconds??Infinity)-Math.min(mine[key]?.[y]?.first_seconds??Infinity,theirs[key]?.[y]?.first_seconds??Infinity));
      if(!keys.length)continue;
      html+=`<details><summary>${title} (${keys.length}종)</summary>`+compareTable(keys.map(k=>[label(k),mine[key]?.[k]?format(mine[key][k]):'—',theirs[key]?.[k]?format(theirs[key][k]):'—']),other)+'</details>';
    }
    return html+'<p class="detail-note">수량은 생산 명령의 양수 수량 합. 횟수는 반복·실패 지시도 포함. 실제 보유 병력·완공 건물·업그레이드 완료 수와 다름. —는 명령 미확인으로, 문명 무료 기술이나 기본 제공 여부까지 판단하지 않음.</p>';
  }
  function renderTimelines(mine, theirs, other) {
    const types={QUEUE:'생산 지시',BUILD:'건설 지시',RESEARCH:'연구 지시'};
    return [[mine,'나'],[theirs,`상대 (${other?.name||'정보 없음'})`]].map(([metrics,who])=>{
      const events=metrics.full_timeline||metrics.timeline||[];
      if(!events.length)return '';
      const legacy=!metrics.full_timeline?' · 기존 분석 최대 100개':'';
      return `<details><summary>${esc(who)} 명령 타임라인 (${events.length}개${legacy})</summary><div class="timeline-window" tabindex="0" aria-label="${esc(who)} 명령 기록"><table class="timeline"><thead><tr><th scope="col">게임 시간</th><th scope="col">명령</th><th scope="col">종류</th></tr></thead><tbody>${events.map(e=>`<tr><td>${fmtTime(e.seconds)}</td><td>${esc(label(e.label))}${Number.isFinite(e.amount)?' × '+number(e.amount):''}</td><td class="type">${esc(types[e.kind]||e.kind)}</td></tr>`).join('')}</tbody></table></div></details>`;
    }).join('');
  }
  function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4000); }
  function render() {
    const matches = Array.isArray(report.matches) ? report.matches : [];
    const known = matches.filter(m=>['win','loss'].includes(m.result));
    const wins = known.filter(m=>m.result==='win').length;
    const latestRated = matches.find(m=>Number.isFinite(m.rating_after));
    $('#player-name').textContent = report.profile?.name || 'ssapo';
    $('#stat-games').textContent = number(matches.length);
    $('#stat-win').textContent = known.length ? `${Math.round(wins/known.length*100)}%` : '—';
    $('#stat-record').textContent = known.length ? `${wins}승 ${known.length-wins}패 · 저장된 경기 기준` : '결과 확인 경기 기준';
    $('#stat-rating').textContent = number(latestRated?.rating_after);
    const delta = latestRated && Number.isFinite(latestRated.rating_before) ? latestRated.rating_after-latestRated.rating_before : null;
    $('#stat-delta').textContent = delta !== null ? `직전 경기 ${delta>0?'+':''}${delta} · 경기 유형별 차이 있음` : '레이팅 없음';
    $('#stat-analysis').textContent = number(matches.filter(m=>m.analysis_status==='complete').length);
    $('#match-count').textContent=number(matches.length);
    $('#updated').textContent = `최근 수집 · ${date(report.updated_at)}`;
    const c = $('#connection');
    c.className = 'connection'+(report.sync_error?' error':'');
    if(report.sync_error) c.innerHTML=`<div class="text"><strong>수집 실패</strong><p>${esc(report.sync_error)} 마지막 확인: ${esc(date(report.last_checked_at))}</p></div><button class="connect">연결 확인</button>`;
    else if(report.profile?.id) c.innerHTML=`<div class="text"><strong>${esc(report.profile.name)}</strong><p>수집 주기 약 30분. 새로고침은 저장된 결과 조회.</p></div><button class="connect">계정 정보</button>`;
    else c.innerHTML='<div class="text"><strong>계정 연결 대기</strong><p>ssapo · 최초 수집 필요.</p></div><button class="connect">계정 정보</button>';
    c.querySelector('.connect')?.addEventListener('click',openSettings);
    $('#source-link').href=`https://github.com/${repo}`;
    renderMatches();
  }
  function renderMatches() {
    const matches=(report.matches||[]).filter(m=>filter==='all'||m.result===filter);
    const list=$('#matches');
    if(!matches.length) {
      list.innerHTML = `<div class="empty"><h3>${filter==='all'?'경기 기록 없음':'해당 경기 없음'}</h3></div>`;
    } else {
      const labels={complete:'명령 기록 분석 완료',unavailable:'리플 확보 안 됨',parser_error:'분석 호환 확인 필요',pending:'다음 수집에서 분석'};
      list.innerHTML=matches.slice(0,visible).map(m=>{
        const opponent=(m.players||[]).filter(p=>!p.is_self).map(p=>p.name).join(', ');
        const status=Object.hasOwn(labels,m.analysis_status)?m.analysis_status:'pending';
        return `<button class="match" data-match="${Number(m.id)}" aria-label="${esc(m.map)} ${m.result==='win'?'승리':m.result==='loss'?'패배':'결과 미확인'} 경기 복기"><span class="result ${m.result==='loss'?'loss':m.result==='win'?'':'unknown'}">${m.result==='win'?'W':m.result==='loss'?'L':'?'}</span><span><h3>${esc(m.map)} <span style="color:#a0a88f;font-weight:400">/</span> ${esc(m.civilization)}</h3><p>vs ${esc(opponent||'상대 정보 없음')} · ${esc(date(m.started_at))}</p></span><span class="match-right"><span class="rating" title="경기 전 → 경기 후">${number(m.rating_before)} → ${number(m.rating_after)}</span><span class="tag ${status}">${labels[status]}</span></span></button>`;
      }).join('');
      list.querySelectorAll('[data-match]').forEach(b=>b.addEventListener('click',()=>openMatch(Number(b.dataset.match))));
    }
    $('#pagination').hidden=matches.length<=visible;
  }
  function openSettings() { $('#settings-dialog').showModal(); }
  function reviewSignals(match) {
    const a=match.analysis, other=a?.opponents?.length===1?a.opponents[0]:null;
    if(!other)return [];
    const mine=a.metrics||{}, theirs=other.metrics||{}, signals=[];
    const add=(positive,title,evidence,meaning)=>signals.push({positive,title,evidence,meaning});
    const ages=['봉건','성주','왕정'];
    for(const age of ages){
      const hasArrival=Number.isFinite(mine.age_checkpoints?.[age]?.reached_seconds)&&Number.isFinite(theirs.age_checkpoints?.[age]?.reached_seconds);
      const left=hasArrival?mine.age_checkpoints[age].reached_seconds:mine.age_commands?.[age],right=hasArrival?theirs.age_checkpoints[age].reached_seconds:theirs.age_commands?.[age];
      if(!Number.isFinite(left)||!Number.isFinite(right)||Math.abs(right-left)<10)continue;
      const lead=right-left;
      add(lead>0,`${age} ${hasArrival?'도달':'전환 명령'} ${Math.round(Math.abs(lead))}초 ${lead>0?'앞섬':'늦음'}`,
        `나 ${fmtTime(left)} · 상대 ${fmtTime(right)}`,
        hasArrival?(lead>0?'시스템 알림에서 시대 도달이 빨랐음. 그 뒤 병력 생산·기술 활용·실제 교전을 확인.':'상대가 새 시대에 먼저 도달. 그 시간 동안의 병력 생산·업그레이드·교전을 확인.'):(lead>0?'상대보다 전환을 먼저 지시. 실제 시대 도달과 병력 투입도 빨랐는지 확인.':'상대가 전환을 먼저 지시. 앞선 시점을 상대가 활용했는지 확인.'));
    }
    const compareArrivals=['봉건','성주'].every(age=>[mine,theirs].every(p=>Number.isFinite(p.age_checkpoints?.[age]?.reached_seconds)));
    const comparisonTime=(p,age)=>compareArrivals?p.age_checkpoints[age].reached_seconds:p.age_commands?.[age];
    const f1=comparisonTime(mine,'봉건'),f2=comparisonTime(theirs,'봉건');
    const c1=comparisonTime(mine,'성주'),c2=comparisonTime(theirs,'성주');
    if([f1,f2,c1,c2].every(Number.isFinite)&&f1>f2+10&&c1<c2){
      add(true,`봉건 ${compareArrivals?'도달':'전환 명령'} 열세를 성주에서 역전`,
        `봉건 ${Math.round(f1-f2)}초 뒤 → 성주 ${Math.round(c2-c1)}초 앞`,
        `${compareArrivals?'시대 도달 알림':'전환 명령'} 기준. 상대의 병력·경제 투자 차이와 함께 복기.`);
    }
    const combatTechs={'Scale Barding Armor':'기병 방어 1단계','Chain Barding Armor':'기병 방어 2단계','Plate Barding Armor':'기병 방어 3단계','Fletching':'궁사 공격 1단계','Bodkin Arrow':'궁사 공격 2단계','Bracer':'궁사 공격 3단계','Forging':'근접 공격 1단계','Iron Casting':'근접 공격 2단계','Blast Furnace':'근접 공격 3단계','Bloodlines':'혈통','Ballistics':'탄도학'};
    const upgrades=[];
    for(const [tech,label] of Object.entries(combatTechs)){
      const left=mine.first_research_commands?.[tech],right=theirs.first_research_commands?.[tech];
      if(!Number.isFinite(left)||!Number.isFinite(right)||Math.abs(right-left)<30)continue;
      upgrades.push({label,left,right,gap:right-left});
    }
    upgrades.sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap));
    for(const u of upgrades.slice(0,2))add(u.gap>0,`${u.label} 명령 ${Math.round(Math.abs(u.gap))}초 ${u.gap>0?'앞섬':'늦음'}`,
      `나 ${fmtTime(u.left)} · 상대 ${fmtTime(u.right)}`,
      u.gap>0?'상대의 동일 업그레이드 지시가 늦었음. 연구 완료 전후 실제 교전이 있었는지 확인.':'상대가 동일 업그레이드를 먼저 지시. 그 차이가 있던 구간의 교전 확인.');
    return signals;
  }
  function renderReview(match) {
    const signals=reviewSignals(match);
    const good=signals.filter(s=>s.positive),bad=signals.filter(s=>!s.positive);
    const card=s=>`<article class="insight ${s.positive?'strength':'review'}"><h3>${esc(s.title)}</h3><p>${esc(s.evidence)}</p><p class="action">${esc(s.meaning)}</p></article>`;
    const title=match.result==='win'?'승리 요인 · 상대 실수 후보':match.result==='loss'?'패배 복기 · 상대 우위':'양측 복기';
    let html=`<h3 style="font-size:15px;margin:20px 0 10px">${title}</h3>`;
    if(match.result==='win'){
      html+=good.length?good.slice(0,4).map(card).join(''):'<p class="detail-note">명령 기록에서 뚜렷한 우위 근거를 찾지 못함. 이겼다는 이유만으로 상대 실수를 추정하지 않음.</p>';
      if(bad.length)html+='<h4 style="font-size:13px;margin:18px 0 8px">승리해도 개선할 점</h4>'+bad.slice(0,2).map(card).join('');
    }else{
      html+=bad.length?bad.slice(0,4).map(card).join(''):'<p class="detail-note">비교할 명령 차이 부족. 패인 미확정.</p>';
      if(good.length)html+='<h4 style="font-size:13px;margin:18px 0 8px">내가 앞선 기록</h4>'+good.slice(0,2).map(card).join('');
    }
    return html+'<p class="detail-note">시대 도달 알림과 명령 시점을 비교한 복기 후보. 교전 결과·주민 피해·실제 자원 상태는 재현하지 않으므로 상대의 실수나 승패 원인으로 확정할 수 없음. eAPM과 농장 건설 명령 수 차이는 승리 원인으로 사용하지 않음.</p>';
  }
  function openMatch(id) {
    const m = (report.matches||[]).find(m=>m.id===id); if(!m)return;
    const a=m.analysis;
    $('#match-subtitle').textContent=`경기 #${m.id}`;
    let content=`<h2 class="review-title">${esc(m.map)} · ${esc(m.civilization)}</h2><div class="review-meta">${esc(date(m.started_at))} · ${m.result==='win'?'승리':m.result==='loss'?'패배':'결과 미확인'} · 레이팅 ${number(m.rating_before)} → ${number(m.rating_after)}</div>`;
    if(!a) {
      content+=`<article class="insight"><h3>상세 분석 없음</h3><p>${esc(m.analysis_note||'리플 미확보 또는 분석 대기.')}</p></article>`;
    } else {
      content+=`<div class="review-stats"><article><small>게임 시간</small><strong>${fmtTime(a.duration_game_seconds)}</strong></article><article><small>파서 eAPM</small><strong>${number(a.metrics?.eapm)}</strong></article><article><small>분석 범위</small><strong style="font-size:15px">명령·시대 알림</strong></article></div>`;
      content+=renderReview(m);
      const other=a.opponents?.length===1?a.opponents[0]:null;
      const mine=a.metrics||{}, theirs=other?.metrics||{};
      const controlled=metrics=>{
        const e=metrics.food_evidence?.livestock_control;
        return e?`${number(e.observed_targets)}개체 조작 확인`:'추가 분석 대기';
      };
      const berryTime=metrics=>(metrics.berry_switches?.windows||[]).map(w=>`${fmtTime(w.start_seconds)}${w.end_seconds>w.start_seconds?'–'+fmtTime(w.end_seconds):''} (${w.workers}/${w.observed_berry_workers}명)`).join('; ')||'단체 전환 근거 부족';
      const hasBerryWindow=(mine.berry_switches?.windows?.length||0)+(theirs.berry_switches?.windows?.length||0)>0;
      const rows=[
        ['eAPM',number(mine.eapm),number(theirs.eapm)],
        ...['봉건','성주','왕정'].map(age=>[`${age} 전환 명령`,fmtTime(mine.age_commands?.[age]),fmtTime(theirs.age_commands?.[age])]),
        ['첫 농장 건설 명령',fmtTime(mine.first_build_commands?.Farm),fmtTime(theirs.first_build_commands?.Farm)],
        ['농장 건설 명령 수',number(mine.command_counts?.Farm),number(theirs.command_counts?.Farm)],
        ['직접 조작한 가축 수 (누적)',controlled(mine),controlled(theirs)],
        ...(hasBerryWindow?[['열매 작업 전환 (추정)',berryTime(mine),berryTime(theirs)]]:[]),
      ];
      content+=`<h3 style="font-size:14px;margin:25px 0 8px">상대 비교</h3><table class="timeline"><thead><tr><th scope="col">항목</th><th scope="col">나 (${esc(report.profile?.name||'ssapo')})</th><th scope="col">상대 (${esc(other?.name||'정보 없음')})</th></tr></thead><tbody>${rows.map(([label,left,right])=>`<tr><th scope="row">${esc(label)}</th><td>${esc(left)}</td><td>${esc(right)}</td></tr>`).join('')}</tbody></table><p class="detail-note">시간은 게임 내 명령 시점. 농장 건설 명령에는 재지시·취소가 포함될 수 있으며, 실제 유지 농장 수가 아님. —는 기록 미확인. 직접 조작한 가축 수는 가축을 선택해 이동·대상·경유 지시한 개체 ID를 중복 제거한 누적 수. 발견·현재 보유·본진 도착·섭취 완료 수와 다르며, 빼앗긴 가축은 양측에 포함될 수 있음. 자동 채집이나 생략된 선택은 모두 복원하지 않음. 열매 시각은 같은 군락으로 지시받은 주민들의 후속 작업 지시가 모인 구간. 괄호는 전환 지시 인원/확인된 열매 작업자 수. 실제 고갈·채집 종료 시각이 아니며, 중간의 자동 작업·이동은 누락될 수 있음.</p>`;
      content+=renderExpandedComparison(mine,theirs,other);
      content+=renderTimelines(mine,theirs,other);
      content+=(a.limitations||[]).map(t=>`<p class="detail-note">${esc(t)}</p>`).join('');

    }
    content+=`<a class="source-button" href="https://aoe.ms/replay/?gameId=${Number(m.id)}&amp;profileId=26260702" target="_blank" rel="noopener noreferrer">리플 다운로드</a> · <a class="source-button" href="https://www.aoe2insights.com/match/${Number(m.id)}/" target="_blank" rel="noopener noreferrer">AoE2 Insights</a>`;
    $('#match-detail').innerHTML=content;
    $('#match-dialog').showModal();
  }
  async function load() {
    $('#refresh').disabled=true;
    try {
      if(window.SSAPO_BOOTSTRAP) {
        report=structuredClone(window.SSAPO_BOOTSTRAP);render();return true;
      }
      const response=await fetch(`data/report.json?t=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const incoming=await response.json();
      if(incoming.schema_version!==1||!Array.isArray(incoming.matches))throw Error('결과 파일 형식이 맞지 않습니다.');
      report=incoming;render();return true;
    } catch(error) {
      // Keep the last successfully loaded report. Never substitute fictional data.
      report={...report,sync_error:location.protocol==='file:'?'로컬 데이터 조회 제한. GitHub Pages에서 실행.':'결과 파일을 읽지 못했습니다. 잠시 후 다시 확인해 주세요.'};
      render();
      console.warn('Report loading failed:',error.message);
      return false;
    } finally {$('#refresh').disabled=false;}
  }
  $('#open-settings').addEventListener('click',openSettings);
  $('#refresh').addEventListener('click',()=>{filter='all';visible=12;syncFilter();load().then(ok=>toast(ok?'새로고침 완료':'조회 실패. 연결 상태 확인.'));});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  function syncFilter(){document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('selected',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});}
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;visible=12;syncFilter();renderMatches();}));
  $('#load-more').addEventListener('click',()=>{visible+=12;renderMatches();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  setInterval(()=>{if(!document.hidden)load();},120000);
  render();load();
})();
