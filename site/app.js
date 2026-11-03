'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const repo = 'ssapo/aoe2';
  let report = {profile:null, matches:[]}, filter = 'all', visible = 12;
  let toastTimer;
  let selectedProfile=window.SSAPOPlayers.profileId(new URL(location.href).searchParams.get('profile'))||26260702;
  let selectedName=selectedProfile===26260702?'ssapo':selectedProfile===199325?'Hera':`프로필 ${selectedProfile}`;
  let catalog=null,searchSequence=0,collectBusy=false,collectionRequestSerial=0;
  const liveReports=new Map();
  const dataPath=(id,file)=>id===26260702?`data/${file}`:`data/profiles/${id}/${file}`;
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
    return `<div class="table-scroll"><table class="timeline comparison"><thead><tr><th scope="col">항목</th><th scope="col" title="${esc(report.profile?.name||'ssapo')}">나</th><th scope="col" title="${esc(other?.name||'정보 없음')}${other?.civilization?' · '+esc(other.civilization):''}">상대</th></tr></thead><tbody>${rows.map(([title,left,right])=>`<tr><th scope="row">${esc(title)}</th><td>${esc(left)}</td><td>${esc(right)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const agesIn = (mine,theirs) => ageList.filter(age=>mine.age_checkpoints?.[age]||theirs.age_checkpoints?.[age]||Number.isFinite(mine.age_commands?.[age])||Number.isFinite(theirs.age_commands?.[age]));
  const checkpoint = (metrics,age) => metrics.age_checkpoints?.[age] || {command_seconds:metrics.age_commands?.[age]};
  function ageDifference(mine,theirs,age) {
    const left=checkpoint(mine,age),right=checkpoint(theirs,age);
    const reached=[left.reached_seconds,right.reached_seconds].every(Number.isFinite);
    const a=reached?left.reached_seconds:left.command_seconds,b=reached?right.reached_seconds:right.command_seconds;
    const delta=Number.isFinite(a)&&Number.isFinite(b)?Math.floor(a)-Math.floor(b):null;
    return {a,b,reached,delta,text:delta===null?'비교 기록 부족':delta===0?'같은 시각':`${Math.abs(delta)}초 ${delta<0?'빠름':'늦음'}`};
  }
  function renderAgePanel(mine,theirs,other) {
    const available=agesIn(mine,theirs);
    if(!available.length)return '<p class="panel-empty">시대 전환 기록 없음</p>';
    return `<div class="panel-toolbar"><div class="segments" role="group" aria-label="비교할 시대">${available.map((age,i)=>`<button data-age="${age}" aria-pressed="${i===0}">${age}</button>`).join('')}</div><span class="toolbar-note">나 / 상대 비교</span></div><p class="data-caution">주민 항목은 <b>생산 요청량</b>이에요. 실제 일꾼 수와는 달라요.</p>`+available.map((age,i)=>{
      const left=checkpoint(mine,age),right=checkpoint(theirs,age),diff=ageDifference(mine,theirs,age);
      const requests=p=>Number.isFinite(p.command_seconds)&&p.unit_requests_before_click&&!p.unknown_unit_request_amounts?.includes('Villager')?number(p.unit_requests_before_click.Villager??0):'—';
      const recent=p=>p.unit_requests_previous_120s?quantities(p.unit_requests_previous_120s):'—';
      const prior=p=>p.unit_requests_before_click?quantities(Object.fromEntries(Object.entries(p.unit_requests_before_click).filter(([k])=>k!=='Villager'))):'—';
      return `<section data-age-panel="${age}" ${i?'hidden':''}><div class="panel-title"><h3>${age} ${diff.reached?'도달':'클릭'}</h3><span class="difference ${diff.delta===null||diff.delta===0?'':diff.delta<0?'ahead':'behind'}">${esc(diff.text)}</span></div>`+compareTable([
        ['시대업을 누른 시각',fmtTime(left.command_seconds),fmtTime(right.command_seconds)],
        ['시대가 바뀐 시각',fmtTime(left.reached_seconds),fmtTime(right.reached_seconds)],
        ['주민 생산 요청 · 누적',requests(left),requests(right)],
        ['다른 유닛 생산 요청 · 누적',prior(left),prior(right)],
        ['누르기 전 2분간 생산 요청',recent(left),recent(right)]
      ],other)+'</section>';
    }).join('')+'<details class="method-note"><summary>기록 기준</summary><p>주민은 시작 인원을 제외한 생산 요청 수량이에요. 취소·실패·사망은 반영하지 않아요. 시대가 바뀐 시각은 시스템 알림으로 확인해요. 처음 버튼을 누른 시각과 연구가 시작된 시각은 다를 수 있어요. —는 기록이 없다는 뜻이에요.</p>'+((mine.recording_restored||theirs.recording_restored)?'<p>재개된 리플의 누적량은 기록 시작 이후만 포함.</p>':'')+'</details>';
  }
  function renderProductionPanel() {
    return `<div class="panel-toolbar"><div class="segments" role="group" aria-label="기록 종류"><button data-category="unit_orders" aria-pressed="true">유닛</button><button data-category="research_orders" aria-pressed="false">업그레이드</button><button data-category="building_orders" aria-pressed="false">건물</button></div></div><div class="search-row"><input id="production-search" type="search" aria-label="생산·연구 기록 검색" placeholder="이름 검색 · 한글 / 영문" autocomplete="off"><span id="production-count" class="toolbar-note" role="status"></span></div><div id="production-table"></div><p id="production-note" class="compact-note"></p>`;
  }
  function timelineRows(events) {
    const rows=new Map();
    for(const e of events){const second=Math.floor(e.seconds);if(!rows.has(second))rows.set(second,{second,mine:[],theirs:[]});rows.get(second)[e.side].push(e);}
    return [...rows.values()];
  }
  function splitTimeline(rows,civs=[],randoms=[]) {
    const types={QUEUE:'생산',DE_QUEUE:'생산',MULTIQUEUE:'생산',BUILD:'건설',RESEARCH:'연구',BUY:'시장 구매',SELL:'시장 판매'};
    const cell=events=>events.length?[...events].sort((a,b)=>a.seconds-b.seconds).map(e=>`<div class="timeline-order"><span>${esc(label(e.label))}${Number.isFinite(e.amount)?' × '+number(e.amount):''}</span><small>${esc(types[e.kind]||e.kind)}</small></div>`).join(''):'<span class="no-order" aria-label="이 시간에 기록 없음">—</span>';
    return `<table class="timeline event-table split-timeline"><colgroup><col class="time-col"><col><col></colgroup><thead><tr><th scope="col">시간</th><th scope="col" class="mine-col">${civBadge(civs[0],'나',randoms[0])}</th><th scope="col" class="theirs-col">${civBadge(civs[1],'상대',randoms[1])}</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${fmtTime(r.second)}</th><td class="mine-col">${cell(r.mine)}</td><td class="theirs-col">${cell(r.theirs)}</td></tr>`).join('')}</tbody></table>`;
  }
  function renderTimelinePanel() {
    return `<div class="timeline-workspace">
      <div class="timeline-dock" role="group" aria-label="기록 재생 조작">
        <div class="player-controls"><button id="record-play" aria-label="재생" title="재생" aria-pressed="false"><svg class="play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 20 12 9 19Z"/></svg><svg class="pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z"/></svg></button><button id="record-prev" aria-label="이전 기록으로">이전</button><button id="record-next" aria-label="다음 기록으로">다음</button><label>배속 <select id="record-speed"><option value="1">1×</option><option value="4">4×</option><option value="16" selected>16×</option><option value="64">64×</option></select></label><output id="record-clock" aria-label="현재 시간 / 전체 시간"></output></div>
        <input id="record-seek" type="range" min="0" step="0.01" value="0" aria-label="기록 재생 시간">
      </div>
      <div class="timeline-stage"><div id="building-map-host"></div></div>
      <section class="timeline-history" aria-labelledby="timeline-history-title"><h3 id="timeline-history-title">전체 기록</h3><div class="panel-toolbar"><div class="segments" role="group" aria-label="타임라인 선수"><button data-side="both" aria-pressed="true">양측</button><button data-side="mine" aria-pressed="false">나</button><button data-side="theirs" aria-pressed="false">상대</button></div><label class="select-label">명령<select id="timeline-kind"><option value="all">전체</option><option value="QUEUE">생산</option><option value="BUILD">건설</option><option value="RESEARCH">연구</option><option value="BUY">시장 구매</option><option value="SELL">시장 판매</option></select></label><label class="select-label">시간<select id="timeline-range"></select></label></div><div class="timeline-pagination"><span id="timeline-count" role="status"></span><div><button id="timeline-prev" aria-label="이전 명령 페이지">이전</button><span id="timeline-page"></span><button id="timeline-next" aria-label="다음 명령 페이지">다음</button></div></div><div id="timeline-table"></div><p class="compact-note">생산·건설·연구·시장 거래를 요청한 시각이에요. 완료 시각과는 달라요.</p></section>
    </div>`;
  }
  function renderBasics(mine,theirs,other) {
    const controlled=p=>p.food_evidence?.livestock_control?`${number(p.food_evidence.livestock_control.observed_targets)}개체`:'—';
    const berry=p=>(p.berry_switches?.windows||[]).map(w=>`${fmtTime(w.start_seconds)}${w.end_seconds>w.start_seconds?'–'+fmtTime(w.end_seconds):''} (${w.workers}/${w.observed_berry_workers}명)`).join('; ')||'전환 시점을 찾지 못했어요.';
    const hasBerry=(mine.berry_switches?.windows?.length||0)+(theirs.berry_switches?.windows?.length||0)>0;
    const rows=[['eAPM',number(mine.eapm),number(theirs.eapm)],['첫 농장 건설 요청',fmtTime(mine.first_build_commands?.Farm),fmtTime(theirs.first_build_commands?.Farm)],['농장 건설 요청 횟수',number(mine.building_orders?.Farm?.commands??mine.command_counts?.Farm),number(theirs.building_orders?.Farm?.commands??theirs.command_counts?.Farm)],['직접 조작한 가축 · 누적',controlled(mine),controlled(theirs)],...(hasBerry?[['열매 작업을 바꾼 시점 · 추정',berry(mine),berry(theirs)]]:[])];
    return `<details class="basic-comparison"><summary>경제·조작 기록 비교</summary>${compareTable(rows,other)}</details>`;
  }
  function renderMethods() {
    return `<details class="method-note"><summary>분석에 포함된 기록</summary><p>시대가 바뀐 시각과 건설·생산·연구를 누른 기록을 비교해요. 생산 요청에는 취소되거나 실행되지 않은 것도 포함돼요. 실제 보유 병력이나 완성된 건물 수와는 달라요.</p><p>기술 기록이 없어도 문명 특성으로 무료 지급됐을 수 있어요. eAPM이나 생산 요청이 많다는 이유만으로 더 잘했다고 판단하지는 않아요.</p><p>가축은 직접 이동 등을 명령한 개체를 중복 없이 셌어요. 현재 소유하거나 먹은 수는 아니며, 빼앗긴 가축은 양쪽에 잡힐 수 있어요.</p><p>열매 작업 전환은 같은 군락에 있던 주민에게 다른 일을 시킨 기록으로 추정해요. 괄호는 확인된 작업자 중 전환 요청을 받은 인원이에요. 열매가 다 떨어진 시각이나 모든 자동 채집을 알 수 있는 것은 아니에요.</p><p>실제 주민 수, TC가 쉰 시간, 보유 자원, 교전 손실은 아직 계산하지 않아요. 아래 기록은 리플에서 살펴볼 구간을 찾는 데 써주세요.</p></details>`;
  }
  function bindWorkspace(root,mine,theirs,other,review,mapData,match) {
    const body=root.querySelector('.review-body');
    const tabs=[...root.querySelectorAll('[role="tab"]')];
    const activate=id=>{
      tabs.forEach(t=>{const selected=t.dataset.panel===id;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;});
      root.querySelectorAll('[role="tabpanel"]').forEach(p=>p.hidden=p.id!==`panel-${id}`);
      body.classList.toggle('timeline-active',id==='timeline');
      body.scrollTop=0;
    };
    tabs.forEach((tab,i)=>{
      tab.addEventListener('click',()=>activate(tab.dataset.panel));
      tab.addEventListener('keydown',e=>{
        let next;
        if(e.key==='ArrowRight')next=(i+1)%tabs.length;
        else if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;
        else if(e.key==='Home')next=0;
        else if(e.key==='End')next=tabs.length-1;
        if(next!==undefined){e.preventDefault();activate(tabs[next].dataset.panel);tabs[next].focus();}
      });
    });
    root.querySelectorAll('[data-open-panel]').forEach(b=>b.addEventListener('click',()=>{
      activate(b.dataset.openPanel);
      if(b.dataset.openAge)root.querySelector(`[data-age="${b.dataset.openAge}"]`)?.click();
      tabs.find(t=>t.dataset.panel===b.dataset.openPanel)?.focus();
    }));
    root.querySelectorAll('[data-review-stage]').forEach(b=>b.addEventListener('click',()=>{
      root.querySelectorAll('[data-review-stage]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));
      const select=items=>items.filter(f=>b.dataset.reviewStage==='전체'||f.stage===b.dataset.reviewStage);
      root.querySelector('#own-findings').innerHTML=findingSide('나',select(review.own_findings));
      root.querySelector('#opponent-findings').innerHTML=findingSide('상대',select(review.opponent_findings));body.scrollTop=0;
    }));
    root.querySelectorAll('[data-numbers]').forEach(b=>b.addEventListener('click',()=>{
      root.querySelectorAll('[data-numbers]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));
      root.querySelectorAll('[data-number-panel]').forEach(p=>p.hidden=p.dataset.numberPanel!==b.dataset.numbers);body.scrollTop=0;
    }));
    root.querySelectorAll('[data-age]').forEach(b=>b.addEventListener('click',()=>{
      root.querySelectorAll('[data-age]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));
      root.querySelectorAll('[data-age-panel]').forEach(p=>p.hidden=p.dataset.agePanel!==b.dataset.age);
      body.scrollTop=0;
    }));
    let category='unit_orders';
    const search=root.querySelector('#production-search');
    const renderProduction=()=>{
      const query=search.value.trim().toLocaleLowerCase();
      const keys=[...new Set([...Object.keys(mine[category]||{}),...Object.keys(theirs[category]||{})])]
        .filter(k=>(category!=='research_orders'||!['Feudal Age','Castle Age','Imperial Age'].includes(k))&&`${k} ${label(k)}`.toLocaleLowerCase().includes(query))
        .sort((x,y)=>Math.min(mine[category]?.[x]?.first_seconds??Infinity,theirs[category]?.[x]?.first_seconds??Infinity)-Math.min(mine[category]?.[y]?.first_seconds??Infinity,theirs[category]?.[y]?.first_seconds??Infinity));
      const cell=v=>{
        if(!v)return '<span class="no-record">—</span>';
        const value=category==='unit_orders'?`요청 ${number(v.requested_amount)}`:category==='building_orders'?`${number(v.commands)}회`:fmtTime(v.first_seconds);
        const meta=category==='research_orders'?`${number(v.commands)}회 요청`:`첫 요청 ${fmtTime(v.first_seconds)}${category==='unit_orders'?' · '+number(v.commands)+'회':''}`;
        return `<strong class="cell-value">${value}</strong><small class="cell-meta">${meta}</small>${v.negative_amount?`<small class="cell-meta">음수 수량 ${number(v.negative_amount)}</small>`:''}${v.unknown_amount_commands?'<small class="cell-meta">일부 수량 판독 불가</small>':''}`;
      };
      root.querySelector('#production-count').textContent=`${keys.length}종`;
      root.querySelector('#production-table').innerHTML=keys.length?`<table class="timeline comparison data-table"><thead><tr><th scope="col">항목</th><th scope="col">나</th><th scope="col">상대</th></tr></thead><tbody>${keys.map(k=>`<tr><th scope="row">${esc(label(k))}</th><td>${cell(mine[category]?.[k])}</td><td>${cell(theirs[category]?.[k])}</td></tr>`).join('')}</tbody></table>`:'<p class="panel-empty">'+(query?'검색 결과 없음':'분석된 기록 없음')+'</p>';
      root.querySelector('#production-note').textContent=category==='unit_orders'?'생산 버튼으로 요청한 수량이에요. 취소되거나 실행되지 않은 요청도 포함돼요.':category==='research_orders'?'연구를 처음 누른 시각이에요. —는 기록이 없다는 뜻이며, 무료로 주어지는 기술일 수도 있어요.':'건설을 요청한 횟수예요. 취소나 반복 요청이 있어 실제 건물 수와 다를 수 있어요.';
    };
    root.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{
      category=b.dataset.category;search.value='';
      root.querySelectorAll('[data-category]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));
      renderProduction();body.scrollTop=0;
    }));
    search.addEventListener('input',renderProduction);
    renderProduction();
    const events=[...[mine,theirs].flatMap((metrics,side)=>(metrics.full_timeline||metrics.timeline||[]).map(e=>({...e,side:side?'theirs':'mine'})))].sort((a,b)=>a.seconds-b.seconds);
    const seek=root.querySelector('#record-seek'),play=root.querySelector('#record-play');
    const civs=[match.analysis?.civilization||match.civilization,other?.civilization];
    const civRandoms=[match.analysis?.random_civ,other?.random_civ];
    const mapHost=root.querySelector('#building-map-host');
    mapHost.innerHTML=mapData?`<div class="map-toolbar"><div class="map-legend">${civBadge(civs[0],'나',civRandoms[0])}${civBadge(civs[1],'상대',civRandoms[1])}</div><div class="map-focus"><button data-map-focus="all" aria-pressed="true">전체 맵</button><button data-map-focus="mine" aria-pressed="false">내 본진</button><button data-map-focus="theirs" aria-pressed="false">상대 본진</button>${Array.isArray(mapData.command_activity)?'<button id="map-activity" aria-pressed="true">유닛 지시</button>':''}</div></div><canvas id="building-map" width="720" height="420" role="img" aria-label="실제 지형과 양측 건설·이동 지시 위치"></canvas><p id="building-map-info" class="compact-note" aria-live="polite">${Array.isArray(mapData.command_activity)?'원은 최근 30초의 지시 지점, 원의 크기·숫자는 선택 대상 수예요.':'유닛 지시는 이 경기 재분석 후 표시돼요.'}</p><details class="map-note"><summary>지도 표시 기준</summary><p class="compact-note">초록은 나, 빨강은 상대. 시작 건물과 누적 건설 요청 위치예요. 취소·파괴·완료는 반영하지 않아요. 금·돌·열매도 시작 위치예요. 원은 이동·공격·대상 지시를 한 곳이에요. 실제 유닛 위치·이동 경로·생존 병력은 아니며 주민·가축도 포함될 수 있어요. 선택 수가 없는 지시는 크기를 추정하지 않아요.</p></details>`:'<p class="compact-note">이 경기의 맵 자료는 다음 재분석 후 표시돼요.</p>';
    const mapPlayer=mapData?window.SSAPOBuildingMap.mount(root.querySelector('#building-map'),root.querySelector('#building-map-info'),mapData,events,label,fmtTime):null;
    root.querySelectorAll('[data-map-focus]').forEach(b=>b.addEventListener('click',()=>{
      root.querySelectorAll('[data-map-focus]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));
      mapPlayer?.focus(b.dataset.mapFocus);
    }));
    root.querySelector('#map-activity')?.addEventListener('click',e=>{
      const button=e.currentTarget,show=button.getAttribute('aria-pressed')!=='true';
      button.setAttribute('aria-pressed',String(show));mapPlayer?.activity(show);
    });
    const end=(mapData?.command_activity||[]).reduce((last,e)=>Math.max(last,e.seconds),events.length?events[events.length-1].seconds:0);
    const first=Math.min(events[0]?.seconds??Infinity,mapData?.command_activity?.[0]?.seconds??Infinity);
    const start=(mine.recording_restored||theirs.recording_restored)&&Number.isFinite(first)?first:0;
    seek.min=String(start);seek.max=String(end);seek.value=String(start);
    let cursor=start,timer=null,lastTick=0;
    const showPlaying=playing=>{const text=playing?'일시정지':'재생';play.setAttribute('aria-pressed',String(playing));play.setAttribute('aria-label',text);play.title=text;};
    const stop=()=>{if(timer!==null)clearInterval(timer);timer=null;showPlaying(false);};
    const drawPlayer=()=>{
      mapPlayer?.draw(cursor);seek.value=String(cursor);root.querySelector('#record-clock').textContent=`${fmtTime(cursor)} / ${fmtTime(end)}`;
      seek.style.setProperty('--replay-progress',`${end>start?(cursor-start)/(end-start)*100:0}%`);
      seek.setAttribute('aria-valuetext',`${fmtTime(cursor)} / ${fmtTime(end)}`);
    };
    play.disabled=!events.length;
    play.addEventListener('click',()=>{
      if(timer!==null){stop();return;}if(cursor>=end)cursor=start;
      lastTick=performance.now();showPlaying(true);
      timer=setInterval(()=>{
        if(!play.isConnected||!document.querySelector('#match-dialog')?.open||root.querySelector('#panel-timeline').hidden||document.hidden){stop();return;}
        const now=performance.now();cursor=Math.min(end,cursor+(now-lastTick)/1000*Number(root.querySelector('#record-speed').value));lastTick=now;drawPlayer();if(cursor>=end)stop();
      },100);
    });
    seek.addEventListener('input',()=>{stop();cursor=Number(seek.value);drawPlayer();});
    root.querySelector('#record-prev').addEventListener('click',()=>{stop();cursor=[...events].reverse().find(e=>e.seconds<cursor)?.seconds??start;drawPlayer();});
    root.querySelector('#record-next').addEventListener('click',()=>{stop();cursor=events.find(e=>e.seconds>cursor)?.seconds??end;drawPlayer();});
    drawPlayer();
    root.querySelectorAll('[data-seek-record]').forEach(button=>button.addEventListener('click',()=>{
      stop();activate('timeline');cursor=Math.max(start,Math.min(end,Number(button.dataset.seekRecord)));
      drawPlayer();seek.focus({preventScroll:true});
    }));
    const range=root.querySelector('#timeline-range');
    const intervals=[...new Set(events.map(e=>Math.floor(e.seconds/300)))];
    range.innerHTML='<option value="all">전체 시간</option>'+intervals.map(i=>`<option value="${i}">${i*5}–${(i+1)*5}분</option>`).join('');
    let side='both',page=0;
    const kind=root.querySelector('#timeline-kind'),size=15;
    const renderTimeline=()=>{
      const filtered=events.filter(e=>(side==='both'||e.side===side)&&(kind.value==='all'||(e.kind===kind.value)||(kind.value==='QUEUE'&&['DE_QUEUE','MULTIQUEUE'].includes(e.kind)))&&(range.value==='all'||Math.floor(e.seconds/300)===Number(range.value)));
      const rows=timelineRows(filtered);
      const pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,pages-1);
      root.querySelector('#timeline-count').textContent=`${number(filtered.length)}개 기록`;
      root.querySelector('#timeline-page').textContent=`${page+1} / ${pages}`;
      root.querySelector('#timeline-prev').disabled=page===0;
      root.querySelector('#timeline-next').disabled=page>=pages-1;
      const visible=rows.slice(page*size,(page+1)*size);
      root.querySelector('#timeline-table').innerHTML=visible.length?splitTimeline(visible,civs,civRandoms):'<p class="panel-empty">이 조건의 명령 없음</p>';
    };
    root.querySelectorAll('[data-side]').forEach(b=>b.addEventListener('click',()=>{
      side=b.dataset.side;page=0;
      root.querySelectorAll('[data-side]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));renderTimeline();
    }));
    [range,kind].forEach(select=>select.addEventListener('change',()=>{page=0;renderTimeline();}));
    root.querySelector('#timeline-prev').addEventListener('click',()=>{page--;renderTimeline();});
    root.querySelector('#timeline-next').addEventListener('click',()=>{page++;renderTimeline();});
    renderTimeline();
  }
  function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4000); }
  function render() {
    const matches = Array.isArray(report.matches) ? report.matches : [];
    const known = matches.filter(m=>['win','loss'].includes(m.result));
    const wins = known.filter(m=>m.result==='win').length;
    const latestRated = matches.find(m=>Number.isFinite(m.rating_after));
    $('#player-name').textContent = report.profile?.name || selectedName;
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
    else if(report.pending_profile)c.innerHTML=`<div class="text"><strong>${esc(selectedName)} · 아직 저장된 경기 없음</strong><p>지금 수집을 누르면 이 계정의 경기와 분석을 가져와요.</p></div><button class="connect">계정 정보</button>`;
    else if(report.profile?.id) c.innerHTML=`<div class="text"><strong>${esc(report.profile.name)}</strong><p>지금 수집은 새 결과를 가져와요. 새로고침은 저장된 기록을 다시 읽어요.</p></div><button class="connect">계정 정보</button>`;
    else c.innerHTML='<div class="text"><strong>계정 연결 대기</strong><p>ssapo · 최초 수집 필요.</p></div><button class="connect">계정 정보</button>';
    const collectLink=document.createElement('button');
    collectLink.className='collect-now';collectLink.textContent=collectBusy?'수집 중…':'지금 수집';collectLink.disabled=collectBusy;
    collectLink.addEventListener('click',requestCollection);
    c.insertBefore(collectLink,c.querySelector('.connect'));
    c.querySelector('.connect')?.addEventListener('click',openSettings);
    $('#source-link').href=`https://github.com/${repo}`;
    renderMatches();
  }
  const civNames={Achaemenids:'아케메네스',Armenians:'아르메니아',Athenians:'아테네',Aztecs:'아즈텍',Bengalis:'벵골',Berbers:'베르베르',Bohemians:'보헤미아',Britons:'브리튼',Bulgarians:'불가리아',Burgundians:'부르고뉴',Burmese:'버마',Byzantines:'비잔틴',Celts:'켈트',Chinese:'중국',Cumans:'쿠만',Danes:'덴마크',Dravidians:'드라비다',Ethiopians:'에티오피아',Franks:'프랑크',Georgians:'조지아',Goths:'고트',Gurjaras:'구르자라',Hindustanis:'힌두스탄',Huns:'훈',Incas:'잉카',Italians:'이탈리아',Japanese:'일본',Jurchens:'여진',Khitans:'거란',Khmer:'크메르',Koreans:'한국',Lithuanians:'리투아니아',Macedonians:'마케도니아',Magyars:'마자르',Malay:'말레이',Malians:'말리',Mapuche:'마푸체',Maya:'마야',Mongols:'몽골',Muisca:'무이스카',Persians:'페르시아',Poles:'폴란드',Portuguese:'포르투갈',Puru:'푸루',Romans:'로마',Saracens:'사라센',Saxons:'색슨',Shu:'촉',Sicilians:'시칠리아',Slavs:'슬라브',Spanish:'스페인',Spartans:'스파르타',Tatars:'타타르',Teutons:'튜턴',Thracians:'트라키아',Tupi:'투피',Turks:'투르크',Varangians:'바랑기아',Vietnamese:'베트남',Vikings:'바이킹',Wei:'위',Wu:'오'};
  const civIconFiles={Maya:'mayans'};
  const randomMark='<span class="civ-random" title="랜덤으로 고른 문명"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3"/><circle cx="5.2" cy="5.2" r="1.25"/><circle cx="10.8" cy="10.8" r="1.25"/><circle cx="8" cy="8" r="1.25"/></svg>랜덤</span>';
  function civBadge(civ,side,random){
    const name=civNames[civ]||civ||'문명 확인 전';
    const icon=Object.hasOwn(civNames,civ)?`<img src="assets/civs/${civIconFiles[civ]||civ.toLowerCase()}.png" alt="" width="28" height="28" loading="lazy">`:'';
    return `<span class="civ-badge ${side==='나'?'own-civ':'opponent-civ'}" title="${esc(civ||name)}"><small>${esc(side)}</small>${icon}<span>${esc(name)}</span>${random===true?randomMark:''}</span>`;
  }
  function matchCivs(m){
    const own=m.analysis?.civilization||m.civilization;
    const opponents=m.analysis?.opponents||[];
    const fallback=(m.players||[]).filter(p=>!p.is_self);
    return `<span class="match-civs">${civBadge(own,'나',m.analysis?.random_civ)}${opponents.length?opponents.map(p=>civBadge(p.civilization,'상대',p.random_civ)).join(''):fallback.map(p=>civBadge(p.civilization,'상대')).join('')}</span>`;
  }
  function renderMatches() {
    const matches=(report.matches||[]).filter(m=>filter==='all'||m.result===filter);
    const list=$('#matches');
    if(!matches.length) {
      list.innerHTML = `<div class="empty"><h3>${filter==='all'?'경기 기록 없음':'해당 경기 없음'}</h3></div>`;
    } else {
      const labels={complete:'분석 완료',unavailable:'리플을 받지 못했어요',parser_error:'분석하지 못했어요',pending:'분석 대기'};
      list.innerHTML=matches.slice(0,visible).map(m=>{
        const opponent=(m.players||[]).filter(p=>!p.is_self).map(p=>p.name).join(', ');
        const status=Object.hasOwn(labels,m.analysis_status)?m.analysis_status:'pending';
        return `<button class="match" data-match="${Number(m.id)}" aria-label="${esc(m.map)} ${m.result==='win'?'승리':m.result==='loss'?'패배':'결과 미확인'} 경기 복기"><span class="result ${m.result==='loss'?'loss':m.result==='win'?'':'unknown'}">${m.result==='win'?'W':m.result==='loss'?'L':'?'}</span><span class="match-info"><h3>${esc(m.map)}</h3>${matchCivs(m)}<span class="match-opponent">vs ${esc(opponent||'상대 정보 없음')} · ${esc(date(m.started_at))}</span></span><span class="match-right"><span class="rating" title="경기 전 → 경기 후">${number(m.rating_before)} → ${number(m.rating_after)}</span><span class="tag ${status}">${labels[status]}</span></span></button>`;
      }).join('');
      list.querySelectorAll('[data-match]').forEach(b=>b.addEventListener('click',()=>openMatch(Number(b.dataset.match))));
    }
    $('#pagination').hidden=matches.length<=visible;
  }
  function openSettings() {
    $('#settings-profile').textContent=`${report.profile?.name||selectedName} · ID ${selectedProfile} · 1v1`;
    $('#settings-profile-link').textContent=selectedProfile===26260702?'AoE2 Insights 프로필':'AoE II Companion 프로필';
    $('#settings-profile-link').href=selectedProfile===26260702?'https://www.aoe2insights.com/user/13810994/':`https://www.aoe2companion.com/players/${selectedProfile}`;
    $('#settings-collection-note').textContent='이 화면의 지금 수집을 누르면 GitHub 화면 이동 없이 수집해요. 무료 서버가 쉬고 있으면 시작까지 약 1분 걸릴 수 있어요.';
    $('#settings-dialog').showModal();
  }
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
        hasArrival?(lead>0?'시스템 알림에서 시대 도달이 빨랐음. 그 뒤 병력 생산·기술 활용·실제 교전을 확인.':'상대가 새 시대에 먼저 도달. 그 시간 동안의 병력 생산·업그레이드·교전을 확인.'):(lead>0?'상대보다 전환을 먼저 지시. 시대가 바뀐 시각과 병력 투입도 빨랐는지 확인.':'상대가 전환을 먼저 지시. 앞선 시점을 상대가 활용했는지 확인.'));
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
  function findingCard(f,opponent=false) {
    const evidence=opponent?f.evidence.replace(/나 (?=\d)/g,'__PLAYER__ ').replace(/상대 (?=\d)/g,'나 ').replace(/__PLAYER__ /g,'상대 '):f.evidence;
    return `<article class="signal-card ${f.kind==='review'?'negative':f.kind==='advantage'?'positive':'investment'}"><span class="finding-stage">${esc(f.stage)} · ${f.kind==='review'?'먼저 볼 점':f.kind==='advantage'?'앞선 부분':'생산 차이'}</span><h4>${esc(f.title)}</h4><p>${esc(evidence)}</p><details><summary>${opponent?'상대 복기 팁':'복기 팁'}</summary><p>${esc(f.action)}</p></details></article>`;
  }
  function findingSide(title,items) {
    const render=f=>findingCard(f,title==='상대');
    return `<section class="signal-group"><h3>${esc(title)}<span>${items.length}</span></h3>${items.length?items.slice(0,2).map(render).join(''):'<p class="compact-note">이 시대에 비교할 기록이 충분하지 않아요.</p>'}${items.length>2?`<details class="more-signals"><summary>${items.length-2}개 더 보기</summary>${items.slice(2).map(render).join('')}</details>`:''}</section>`;
  }
  function renderEvidenceReview(match) {
    const review=match.analysis.review;
    const stages=['전체','암흑','봉건','성주','왕정'].filter(s=>s==='전체'||[...review.own_findings,...review.opponent_findings].some(f=>f.stage===s));
    return `${review.practice?`<details class="practice-card"><summary><strong>${esc(review.practice.title)}</strong><span>이번 ${fmtTime(review.practice.current_seconds)} → 목표 ${fmtTime(review.practice.target_seconds)}</span></summary><p>${esc(review.practice.evidence)}</p><p>${esc(review.practice.action)}</p></details>`:''}<div class="opening-pair"><span>나 · ${esc(review.own.opening_label)}</span><span>상대 · ${esc(review.opponent.opening_label)}</span></div><div class="panel-toolbar"><div class="segments stage-segments" role="group" aria-label="복기할 시대">${stages.map((s,i)=>`<button data-review-stage="${s}" aria-pressed="${i===0}">${s}</button>`).join('')}</div><button class="subtle" data-open-panel="numbers">수치 비교 →</button></div><div class="signal-columns"><div id="own-findings">${findingSide('나',review.own_findings)}</div><div id="opponent-findings">${findingSide('상대',review.opponent_findings)}</div></div>`;
  }
  function renderFieldControl(analysis) {
    const field=window.SSAPOFieldControl.summarize(analysis.map_view,analysis.duration_game_seconds);
    if(!field)return '';
    const zones=[['home','내 진영'],['middle','중앙'],['away','상대 진영']];
    const names=Object.fromEntries(zones);
    const largest=zones.filter(([id])=>field.seconds[id]===Math.max(...Object.values(field.seconds))).map(([id])=>id);
    const lead=!field.total?'양쪽 지시가 가까이 겹친 구간을 찾지 못했어요.':!field.enough?'겹친 구간이 짧아서 비율은 아직 표시하지 않아요.':largest.length===1?`${names[largest[0]]}에서 양쪽 지시가 가장 자주 맞물렸어요.`:'여러 지역에서 비슷한 비중으로 맞물렸어요.';
    return `<section class="field-control" aria-labelledby="field-title"><div class="field-heading"><h3 id="field-title">전장 위치</h3><span>명령 기반 추정</span></div><p class="field-lead">${lead}</p>${field.total?`<p class="field-caption">가까이 겹친 지시 구간 ${fmtTime(Math.round(field.total))} · ${field.bins}개 시간 구간${field.enough?' 안의 비율':''}</p>${field.enough?`<div class="field-bar" role="img" aria-label="${zones.map(([id,name])=>name+' '+field.percentages[id]+'%').join(', ')}">${zones.map(([id])=>`<span class="field-${id}" style="flex:${field.percentages[id]}"></span>`).join('')}</div>`:''}<div class="field-stats">${zones.map(([id,name])=>`<div><span>${name}</span>${field.enough?`<strong>${field.percentages[id]}<small>%</small></strong>`:''}<time>${fmtTime(Math.round(field.seconds[id]))}</time></div>`).join('')}</div><details class="field-windows"><summary>해당 구간 보기</summary><div class="field-intervals">${field.intervals.map(interval=>`<button data-seek-record="${interval.start}" aria-label="${fmtTime(interval.start)} 지도에서 보기"><time>${fmtTime(interval.start)}–${fmtTime(interval.end)}</time><span>${interval.zones.map(z=>names[z]).join(' · ')}</span><span aria-hidden="true">↗</span></button>`).join('')}</div></details>`:''}<details class="field-method"><summary>계산 기준</summary><p>양측의 지시 지점이 8타일 이내이고 명령 시각이 10초 이내인 경우를 찾아, 10초 구간당 한 번만 세요. 같은 구간에 여러 지역이 겹치면 시간을 나눠요. 시작 TC 사이를 3등분해 내 진영·중앙·상대 진영을 구분해요.</p><p>비율은 이렇게 찾은 구간 안의 분포예요. 실제 교전 시간·맵 점유율·승리 기여도는 아니에요. 주민이나 가축에게 내린 지시도 포함될 수 있어요. 겹친 구간이 30초 미만이면 비율을 생략해요.</p></details></section>`;
  }
  function renderNumbersPanel(review,mine,theirs,other) {
    if(!review)return '<p class="panel-empty">다음 수집이 끝나면 수치를 볼 수 있어요.</p>';
    const a=review.own,b=review.opponent;
    const at15=s=>s.checkpoints.find(p=>p.seconds===900)?.villager_requests;
    const longest=s=>s.villager_command_gaps.length?Math.max(...s.villager_command_gaps.map(g=>g.seconds)):null;
    const core=[
      ['eAPM',number(mine.eapm),number(theirs.eapm)],
      ...ageList.filter(age=>Number.isFinite(checkpoint(mine,age).reached_seconds)||Number.isFinite(checkpoint(theirs,age).reached_seconds)).map(age=>[`${age} 도달`,fmtTime(checkpoint(mine,age).reached_seconds),fmtTime(checkpoint(theirs,age).reached_seconds)]),
      ['첫 병력 생산 요청',fmtTime(a.first_military_seconds),fmtTime(b.first_military_seconds)],
      ['봉건 후 첫 병력 요청까지',Number.isFinite(a.after_feudal_first_military_seconds)?`${Math.round(a.after_feudal_first_military_seconds)}초`:'—',Number.isFinite(b.after_feudal_first_military_seconds)?`${Math.round(b.after_feudal_first_military_seconds)}초`:'—'],
      ['15분까지 주민 생산 요청',number(at15(a)),number(at15(b))],
      ['주민 생산 요청 · 전체',number(a.villager_requests),number(b.villager_requests)],
      ['병력 생산 요청 · 전체',number(a.military_requests),number(b.military_requests)],
      ['생산을 요청한 병종',number(a.military_types),number(b.military_types)],
      ['연구 종류 · 시대업 포함',number(a.research_kinds),number(b.research_kinds)],
      ['추가 TC 건설 요청',`${number(a.additional_tc_build_commands)}회`,`${number(b.additional_tc_build_commands)}회`],
      ['주민 생산 요청의 최대 간격',fmtTime(longest(a)),fmtTime(longest(b))]
    ];
    const points=[...new Set([...a.checkpoints,...b.checkpoints].map(p=>p.seconds))].sort((x,y)=>x-y);
    const point=(s,t)=>{const p=s.checkpoints.find(p=>p.seconds===t);return p?`주민 ${number(p.villager_requests)} · 군사 ${number(p.military_requests)}`:'—';};
    const phase=s=>`${fmtTime(s.start)}–${fmtTime(s.end)} · 주민 ${number(s.villager_requests)} / 군사 ${number(s.military_requests)} / 연구 ${number(s.research_kinds)} / 건설 ${number(s.building_commands)}`;
    const phases=[...new Set([...a.phases,...b.phases].map(p=>p.stage))];
    const panels=[['core','핵심'],['checkpoints','5분별'],['phases','시대별'],...((mine.market||theirs.market)?[['market','시장']]:[]),...(review.personal_benchmarks.length?[['benchmark','내 기록']]:[])];
    let html=`<div class="segments numbers-segments" role="group" aria-label="수치 비교 종류">${panels.map(([id,name],i)=>`<button data-numbers="${id}" aria-pressed="${i===0}">${name}</button>`).join('')}</div><p class="data-caution">주민·군사 수량은 <b>생산 요청</b> 기준이에요. 실제 살아 있는 유닛 수와는 달라요.</p><section data-number-panel="core">${compareTable(core,other)}</section><section data-number-panel="checkpoints" hidden>${compareTable(points.map(t=>[`${Math.round(t/60)}분 누적`,point(a,t),point(b,t)]),other)}</section><section data-number-panel="phases" hidden><p class="compact-note">각자 시대가 바뀐 뒤의 기록이에요. 연구는 종류, 건설은 요청 횟수로 셌어요.</p>${compareTable(phases.map(stage=>{const l=a.phases.find(p=>p.stage===stage),r=b.phases.find(p=>p.stage===stage);return [stage,l?phase(l):'—',r?phase(r):'—'];}),other)}</section>`;
    if(mine.market||theirs.market){
      const total=(m,kind,resource)=>m.market?number(m.market.events.filter(e=>e.kind===kind&&e.label===resource).reduce((n,e)=>n+e.amount,0)):'—';
      const rows=['식량','목재','돌'].flatMap(resource=>['BUY','SELL'].map(kind=>[`${resource} ${kind==='BUY'?'구매':'판매'} 요청`,total(mine,kind,resource),total(theirs,kind,resource)]));
      const before=(m,age)=>{const p=checkpoint(m,age);if(!m.market||!Number.isFinite(p.command_seconds))return '—';const ev=p.market_previous_120s||[];return `${fmtTime(Math.max(0,p.command_seconds-120))}–${fmtTime(p.command_seconds)}\n`+(ev.length?ev.map(e=>`${fmtTime(e.seconds)} ${esc(e.label)} ${number(e.amount)} ${e.kind==='BUY'?'구매':'판매'}`).join('\n'):'거래 요청 없음');};
      html+=`<section data-number-panel="market" hidden><p class="compact-note">자원 단위로 합산한 매매 요청이에요. 실제 체결량이나 금 지출·수입은 계산하지 않아요.</p>${compareTable(rows,other)}<h3>시대업 누르기 전 2분</h3>${compareTable(ageList.filter(age=>Number.isFinite(checkpoint(mine,age).command_seconds)||Number.isFinite(checkpoint(theirs,age).command_seconds)).map(age=>[age,before(mine,age),before(theirs,age)]),other)}</section>`;
    }
    if(review.personal_benchmarks.length){
      html+=`<section data-number-panel="benchmark" hidden><p class="compact-note">같은 맵·문명·첫 병종으로 했던 내 경기와 비교해요. 최근 10경기 안에서 비교 가능한 기록만 모았어요.</p><table class="timeline comparison"><thead><tr><th>항목</th><th>이번 경기</th><th>내 과거 중앙값</th></tr></thead><tbody>${review.personal_benchmarks.map(p=>`<tr><th scope="row">${esc(p.label)}</th><td>${fmtTime(p.current_seconds)}<small class="cell-meta">${Math.round(Math.abs(p.delta_seconds))}초 ${p.delta_seconds<0?'빠름':p.delta_seconds>0?'늦음':'차이'}</small></td><td>${fmtTime(p.median_seconds)}<small class="cell-meta">${p.samples}경기</small></td></tr>`).join('')}</tbody></table></section>`;
    }
    return html+'<details class="method-note"><summary>기록 기준</summary><p>시대가 바뀐 시각은 시스템 알림, 병력·업그레이드는 처음 요청한 시각이에요. 병력 수량에서 주민·어선·교역·수송선과 시작 유닛, 무료로 얻은 유닛은 제외했어요.</p><p>시대업·첫 병력 요청이 20초 이상, 같은 기술 요청이 60초 이상 차이 나면 복기할 항목으로 골랐어요. 같은 첫 병종을 썼을 때 15분 주민 요청이 5 이상, 병력 요청이 10 이상 차이 나는 경우도 보여줘요. 이 기준이 전략의 정답을 뜻하지는 않아요.</p><p>주민 요청 사이에 시간이 길어도 TC가 계속 쉬었다는 뜻은 아니에요. 생산 대기열·취소·인구 제한·피해는 재현하지 못하므로, 실제 TC 유휴시간이나 교전 효율은 이 기록만으로 알 수 없어요.</p></details>';
  }

  function renderReview(match) {
    if(match.analysis?.review)return renderEvidenceReview(match);
    const signals=reviewSignals(match),good=signals.filter(s=>s.positive),bad=signals.filter(s=>!s.positive);
    const card=s=>`<article class="signal-card ${s.positive?'positive':'negative'}"><h4>${esc(s.title)}</h4><p>${esc(s.evidence)}</p><details><summary>복기 포인트</summary><p>${esc(s.meaning)}</p></details></article>`;
    const group=(title,items)=>`<section class="signal-group"><h3>${title}<span>${items.length}</span></h3>${items.length?items.slice(0,2).map(card).join(''):'<p class="compact-note">뚜렷한 비교 근거 없음</p>'}${items.length>2?`<details class="more-signals"><summary>${items.length-2}개 더 보기</summary>${items.slice(2).map(card).join('')}</details>`:''}</section>`;
    const left=match.result==='loss'?group('상대가 앞선 기록',bad):group('내가 앞선 기록',good);
    const right=match.result==='loss'?group('내가 앞선 기록',good):group('개선할 기록',bad);
    return `<div class="summary-label">${match.result==='win'?'승리 요인 · 상대 실수 후보':match.result==='loss'?'패배 복기 · 상대 우위':'양측 복기'}<small>승패의 원인으로 확정하지 않음</small></div><div class="signal-columns">${left}${right}</div>`;
  }
  function openMatch(id) {
    const m=(report.matches||[]).find(m=>m.id===id);if(!m)return;
    const a=m.analysis,other=a?.opponents?.length===1?a.opponents[0]:null,mine=a?.metrics||{},theirs=other?.metrics||{};
    const context=(report.matches||[]).filter(row=>filter==='all'||row.result===filter),index=context.findIndex(row=>row.id===id);
    const newer=$('#match-newer'),older=$('#match-older');
    newer.disabled=index<=0;older.disabled=index<0||index>=context.length-1;
    newer.onclick=()=>{if(index>0)openMatch(context[index-1].id);};
    older.onclick=()=>{if(index>=0&&index<context.length-1)openMatch(context[index+1].id);};
    $('#match-subtitle').textContent=`경기 ${index>=0?index+1:''} / ${context.length} · #${m.id}`;
    const result=m.result==='win'?'승리':m.result==='loss'?'패배':'결과 미확인';
    const opponent=other?.name||(m.players||[]).filter(p=>!p.is_self).map(p=>p.name).join(', ')||'상대 정보 없음';
    const header=`<header class="review-header"><div class="review-heading-row"><span class="outcome ${m.result==='loss'?'loss':''}">${result}</span><h2 id="review-title">${esc(m.map)}</h2></div>${matchCivs(m)}<p class="review-opponent">vs ${esc(opponent)}</p><div class="review-meta"><span>${esc(date(m.started_at))}${a?' · '+fmtTime(a.duration_game_seconds):''}</span><span class="review-rating">${number(m.rating_before)} → ${number(m.rating_after)}</span></div></header>`;
    const links=`<footer class="review-footer"><a href="https://aoe.ms/replay/?gameId=${Number(m.id)}&amp;profileId=${Number(report.profile?.id||selectedProfile)}" target="_blank" rel="noopener noreferrer">리플 다운로드 ↗</a><a href="https://www.aoe2insights.com/match/${Number(m.id)}/" target="_blank" rel="noopener noreferrer">AoE2 Insights ↗</a><a href="https://aoe2.gg/matches/${Number(m.id)}?tab=insights" target="_blank" rel="noopener noreferrer">AoE2.GG ↗</a></footer>`;
    let workspace;
    if(!a){
      workspace=header+`<div class="review-body"><p class="panel-empty">${esc(m.analysis_note||'리플 미확보 또는 분석 대기.')}</p></div>`+links;
    }else{
      const highlights=agesIn(mine,theirs).map(age=>{
        const d=ageDifference(mine,theirs,age);
        return `<button class="highlight ${d.delta===null||d.delta===0?'':d.delta<0?'ahead':'behind'}" data-open-panel="ages" data-open-age="${age}"><span>${age} ${d.reached?'도달':'클릭'}</span><strong>${esc(d.text)}</strong><small>나 ${fmtTime(d.a)} · 상대 ${fmtTime(d.b)}</small></button>`;
      }).join('');
      const tabs=[['summary','복기'],['numbers','수치'],['ages','시대업'],['production','생산·연구'],['timeline','타임라인']];
      workspace=header+`<nav class="review-tabs" role="tablist" aria-label="경기 분석 항목">${tabs.map(([id,title],i)=>`<button role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-panel="${id}">${title}</button>`).join('')}</nav><div class="review-body"><section id="panel-summary" role="tabpanel" aria-labelledby="tab-summary" tabindex="0"><div class="highlights">${highlights||'<p class="compact-note">비교할 시대 전환 기록 없음</p>'}</div>${renderFieldControl(a)}${renderReview(m)}${renderBasics(mine,theirs,other)}${renderMethods(a)}</section><section id="panel-numbers" role="tabpanel" aria-labelledby="tab-numbers" tabindex="0" hidden>${renderNumbersPanel(a.review,mine,theirs,other)}</section><section id="panel-ages" role="tabpanel" aria-labelledby="tab-ages" tabindex="0" hidden>${renderAgePanel(mine,theirs,other)}</section><section id="panel-production" role="tabpanel" aria-labelledby="tab-production" tabindex="0" hidden>${renderProductionPanel()}</section><section id="panel-timeline" role="tabpanel" aria-labelledby="tab-timeline" tabindex="0" hidden>${renderTimelinePanel()}</section></div>`+links;
    }
    $('#match-detail').innerHTML=`<div class="review-workspace">${workspace}</div>`;
    if(a)bindWorkspace($('#match-detail .review-workspace'),mine,theirs,other,a.review,a.map_view,m);
    const dialog=$('#match-dialog');dialog.scrollTop=0;
    document.body.classList.add('review-open');
    if(!dialog.open)dialog.showModal();
  }
  let loadRequest=null;
  function load() {
    if(loadRequest?.id===selectedProfile)return loadRequest.promise;
    const job={id:selectedProfile};job.promise=loadReport(job.id).finally(()=>{if(loadRequest===job)loadRequest=null;});loadRequest=job;return job.promise;
  }
  async function loadReport(id) {
    $('#refresh').disabled=true;
    try {
      if(window.SSAPO_BOOTSTRAP&&id===26260702){if(id!==selectedProfile)return false;report=structuredClone(window.SSAPO_BOOTSTRAP);render();return true;}
      const response=await fetch(`${dataPath(id,'report.json')}?t=${Date.now()}`,{cache:'no-store'});
      if(id!==selectedProfile)return false;
      if(response.status===404&&id!==26260702){report=liveReports.get(id)||{schema_version:1,profile:{id,name:selectedName},matches:[],pending_profile:true};render();return true;}
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const incoming=await response.json();
      if(id!==selectedProfile)return false;
      if(incoming.schema_version!==1||!Array.isArray(incoming.matches)||incoming.profile?.id!==id)throw Error('Profile report mismatch');
      const live=liveReports.get(id);report=live&&Date.parse(live.last_checked_at)>=Date.parse(incoming.last_checked_at)?live:incoming;selectedName=report.profile.name||selectedName;render();return true;
    } catch(error) {
      if(id!==selectedProfile)return false;
      report={...report,sync_error:'결과 파일을 읽지 못했어요. 잠시 후 다시 확인해 주세요.'};render();console.warn('Report loading failed:',error.message);return false;
    } finally {if(id===selectedProfile)$('#refresh').disabled=false;}
  }
  async function selectProfile(id,name,writeUrl=true){
    id=window.SSAPOPlayers.profileId(id);if(!id)return;
    collectionWatch.stop();directCollection.stop();collectionRequestSerial++;collectBusy=false;$('#collection-feedback').hidden=true;
    $('#match-dialog').close();document.body.classList.remove('review-open');
    selectedProfile=id;selectedName=name||(id===26260702?'ssapo':id===199325?'Hera':`프로필 ${id}`);
    report={profile:{id,name:selectedName},matches:[]};filter='all';visible=12;syncFilter();
    if(writeUrl){const u=new URL(location.href);if(id===26260702)u.searchParams.delete('profile');else u.searchParams.set('profile',String(id));history.pushState({},'',u);}
    $('#profile-view-note').textContent=id===26260702?'ssapo의 기록이에요.':`${selectedName}의 기록이에요. 비교표의 ‘나’는 선택한 유저를 뜻해요.`;
    render();await load();
  }
  document.querySelectorAll('[data-profile-id]').forEach(b=>b.addEventListener('click',()=>selectProfile(b.dataset.profileId,b.dataset.profileName)));
  window.addEventListener('popstate',()=>selectProfile(window.SSAPOPlayers.profileId(new URL(location.href).searchParams.get('profile'))||26260702,null,false));
  $('#player-search-form').addEventListener('submit',async e=>{
    e.preventDefault();const seq=++searchSequence,q=$('#player-query').value.trim();if(!q)return;
    $('#player-search-submit').disabled=true;$('#player-search-status').textContent='유저를 찾고 있어요…';
    try{
      if(!catalog){const r=await fetch('data/players.json');if(!r.ok)throw Error('Index unavailable');const data=await r.json();if(!Array.isArray(data.players))throw Error('Invalid index');catalog=data;}
      if(seq!==searchSequence)return;
      const found=window.SSAPOPlayers.search(catalog.players,q),numeric=window.SSAPOPlayers.profileId(q);
      if(numeric&&!found.length)found.push({id:numeric,name:`프로필 ${numeric}`});
      $('#player-results').innerHTML=found.map(p=>`<button class="player-result" data-result-id="${p.id}"><strong>${esc(p.name)}</strong><span>ID ${p.id}${Number.isFinite(p.rating)?' · '+number(p.rating)+'점':''}${Number.isFinite(p.rank)?' · '+number(p.rank)+'위':''}</span></button>`).join('');
      $('#player-results').querySelectorAll('[data-result-id]').forEach(b=>b.addEventListener('click',()=>{const p=found.find(p=>p.id===Number(b.dataset.resultId));selectProfile(p.id,p.name);}));
      $('#player-search-status').textContent=found.length?`${found.length}명 표시 · RM 1v1 랭킹 명단 ${date(catalog.updated_at)} 갱신${catalog.complete?'':' · 일부 명단만 수집됨'}`:'일치하는 유저가 없어요. 비랭크·미등록 계정은 게임 서버 프로필 ID로 찾아주세요.';
    }catch(error){
      if(seq!==searchSequence)return;
      const id=window.SSAPOPlayers.profileId(q)||(['hera','헤라'].includes(q.toLowerCase())?199325:null);
      if(id){await selectProfile(id,id===199325?'Hera':null);$('#player-search-status').textContent='이름 명단을 불러오지 못해 프로필 ID로 이동했어요.';}
      else $('#player-search-status').textContent='검색 명단을 불러오지 못했어요. Hera 바로가기나 숫자 프로필 ID를 이용해 주세요.';
    }finally{if(seq===searchSequence)$('#player-search-submit').disabled=false;}
  });
  function collectionMessage(title,hint){
    const box=$('#collection-feedback');box.hidden=false;$('#collection-title').textContent=title;$('#collection-hint').textContent=hint;
  }
  const directCollection=window.createCollectionClient({
    onState:state=>{
      const messages={waking:['수집 서버를 준비하고 있어요','서버가 쉬고 있었다면 시작까지 약 1분 걸릴 수 있어요.'],requesting:['수집을 요청하고 있어요','잠시만 기다려 주세요.'],running:['경기와 리플을 분석하고 있어요','완료되면 이 화면에 결과를 표시해요.'],complete:['수집 결과를 불러왔어요','새 결과는 현재 탭에서 유지돼요. 예약 수집 기록은 따로 저장돼요.']};
      collectionMessage(...messages[state]);
    },
    applyReport:async incoming=>{
      if(incoming.profile.id!==selectedProfile)return;
      liveReports.set(selectedProfile,incoming);report=incoming;selectedName=incoming.profile.name||selectedName;render();
    }
  });
  async function requestCollection(){
    if(collectBusy)return;
    const serial=++collectionRequestSerial,requestedProfile=selectedProfile;
    collectBusy=true;render();
    try{
      const response=await fetch('collection-service.json',{cache:'no-store'});if(!response.ok)throw Error('수집 서버 설정을 읽지 못했어요.');
      const config=await response.json();
      if(serial!==collectionRequestSerial||requestedProfile!==selectedProfile)return;
      if(!config.endpoint)throw Error('수집 서버 연결을 준비하고 있어요. 연결이 끝나면 이 버튼으로 바로 수집할 수 있어요.');
      await directCollection.start(config.endpoint,requestedProfile);
    }catch(error){if(serial===collectionRequestSerial)collectionMessage('수집을 시작하거나 완료하지 못했어요',error.message);}
    finally{if(serial===collectionRequestSerial){collectBusy=false;render();}}
  }
  const collectionWatch=window.createCollectionWatch({
    fetchStatus:async()=>{
      const r=await fetch(`${dataPath(selectedProfile,'status.json')}?t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)throw Error(`HTTP ${r.status}`);
      return r.json();
    },
    refreshReport:async status=>{
      const loaded=await load();
      return loaded&&Date.parse(report.last_checked_at)>=Date.parse(status.last_checked_at);
    },
    visible:()=>!document.hidden,
    onState:(state,detail)=>{
      const messages={
        waiting:['GitHub에서 실행해 주세요','Run workflow를 열고 실행해 주세요. profile_id에 현재 프로필 ID를 입력하고 실행해 주세요. 돌아오면 새 결과를 확인해요.'],
        retrying:['결과를 다시 확인하고 있어요','아직 상태를 불러오지 못했어요. 잠시 후 다시 확인해요.'],
        updated:['새 기록을 불러왔어요','최근 수집 결과로 바뀌었어요. 새 경기가 없으면 목록은 그대로예요.'],
        failed:['수집을 마치지 못했어요',detail||'기존 기록은 그대로 있어요. GitHub에서 실행 결과를 확인해 주세요.'],
        timeout:['아직 새 결과가 없어요','자동 확인을 멈췄어요. GitHub에서 수집이 실행됐는지 확인해 주세요.']
      };
      const [title,hint]=messages[state];
      const box=$('#collection-feedback');box.hidden=false;box.dataset.state=state;
      if($('#collection-title').textContent!==title)$('#collection-title').textContent=title;
      if($('#collection-hint').textContent!==hint)$('#collection-hint').textContent=hint;
    }
  });
  $('#collection-dismiss').addEventListener('click',()=>{collectionWatch.stop();directCollection.stop();collectionRequestSerial++;collectBusy=false;render();$('#collection-feedback').hidden=true;});
  $('#match-dialog').addEventListener('close',()=>document.body.classList.remove('review-open'));
  $('#open-settings').addEventListener('click',openSettings);
  $('#refresh').addEventListener('click',()=>{filter='all';visible=12;syncFilter();load().then(ok=>toast(ok?'새로고침 완료':'조회 실패. 연결 상태 확인.'));});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  function syncFilter(){document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('selected',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});}
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;visible=12;syncFilter();renderMatches();}));
  $('#load-more').addEventListener('click',()=>{visible+=12;renderMatches();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){load();collectionWatch.check();}});
  setInterval(()=>{if(!document.hidden)load();},120000);
  selectProfile(selectedProfile,selectedName,false);
})();
