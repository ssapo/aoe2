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
    return `<div class="panel-toolbar"><div class="segments" role="group" aria-label="비교할 시대">${available.map((age,i)=>`<button data-age="${age}" aria-pressed="${i===0}">${age}</button>`).join('')}</div><span class="toolbar-note">나 / 상대 비교</span></div><p class="data-caution">주민 항목은 생산 <b>지시량</b>. 실제 일꾼 수가 아님.</p>`+available.map((age,i)=>{
      const left=checkpoint(mine,age),right=checkpoint(theirs,age),diff=ageDifference(mine,theirs,age);
      const requests=p=>Number.isFinite(p.command_seconds)&&p.unit_requests_before_click&&!p.unknown_unit_request_amounts?.includes('Villager')?number(p.unit_requests_before_click.Villager??0):'—';
      const recent=p=>p.unit_requests_previous_120s?quantities(p.unit_requests_previous_120s):'—';
      const prior=p=>p.unit_requests_before_click?quantities(Object.fromEntries(Object.entries(p.unit_requests_before_click).filter(([k])=>k!=='Villager'))):'—';
      return `<section data-age-panel="${age}" ${i?'hidden':''}><div class="panel-title"><h3>${age} ${diff.reached?'도달':'클릭'}</h3><span class="difference ${diff.delta===null||diff.delta===0?'':diff.delta<0?'ahead':'behind'}">${esc(diff.text)}</span></div>`+compareTable([
        ['첫 시대업 클릭',fmtTime(left.command_seconds),fmtTime(right.command_seconds)],
        ['실제 시대 도달',fmtTime(left.reached_seconds),fmtTime(right.reached_seconds)],
        ['주민 생산 지시량 · 누적',requests(left),requests(right)],
        ['다른 유닛 지시량 · 누적',prior(left),prior(right)],
        ['클릭 전 2분 생산 지시량',recent(left),recent(right)]
      ],other)+'</section>';
    }).join('')+'<details class="method-note"><summary>이 수치를 읽는 방법</summary><p>주민 지시량은 시작 주민을 제외한 양수 수량의 합. 대기·취소·실패·사망·전향을 반영하지 않음. 시대 도달은 시스템 알림으로 확인하며 첫 클릭은 실제 연구 시작과 다를 수 있음. —는 기록 미확인.</p>'+((mine.recording_restored||theirs.recording_restored)?'<p>재개된 리플의 누적량은 기록 시작 이후만 포함.</p>':'')+'</details>';
  }
  function renderProductionPanel() {
    return `<div class="panel-toolbar"><div class="segments" role="group" aria-label="기록 종류"><button data-category="unit_orders" aria-pressed="true">유닛</button><button data-category="research_orders" aria-pressed="false">업그레이드</button><button data-category="building_orders" aria-pressed="false">건물</button></div></div><div class="search-row"><input id="production-search" type="search" aria-label="생산·연구 기록 검색" placeholder="이름 검색 · 한글 / 영문" autocomplete="off"><span id="production-count" class="toolbar-note" role="status"></span></div><div id="production-table"></div><p id="production-note" class="compact-note"></p>`;
  }
  function renderTimelinePanel() {
    return `<div class="panel-toolbar"><div class="segments" role="group" aria-label="타임라인 선수"><button data-side="both" aria-pressed="true">양측</button><button data-side="mine" aria-pressed="false">나</button><button data-side="theirs" aria-pressed="false">상대</button></div><label class="select-label">명령<select id="timeline-kind"><option value="all">전체</option><option value="QUEUE">생산</option><option value="BUILD">건설</option><option value="RESEARCH">연구</option></select></label><label class="select-label">시간<select id="timeline-range"></select></label></div><div class="timeline-pagination"><span id="timeline-count" role="status"></span><div><button id="timeline-prev" aria-label="이전 명령 페이지">이전</button><span id="timeline-page"></span><button id="timeline-next" aria-label="다음 명령 페이지">다음</button></div></div><div id="timeline-table"></div><p class="compact-note">건설·생산·연구 지시 기록. 실제 완료 시각과 다를 수 있음.</p>`;
  }
  function renderBasics(mine,theirs,other) {
    const controlled=p=>p.food_evidence?.livestock_control?`${number(p.food_evidence.livestock_control.observed_targets)}개체`:'—';
    const berry=p=>(p.berry_switches?.windows||[]).map(w=>`${fmtTime(w.start_seconds)}${w.end_seconds>w.start_seconds?'–'+fmtTime(w.end_seconds):''} (${w.workers}/${w.observed_berry_workers}명)`).join('; ')||'단체 전환 근거 부족';
    const hasBerry=(mine.berry_switches?.windows?.length||0)+(theirs.berry_switches?.windows?.length||0)>0;
    const rows=[['eAPM',number(mine.eapm),number(theirs.eapm)],['첫 농장 건설 지시',fmtTime(mine.first_build_commands?.Farm),fmtTime(theirs.first_build_commands?.Farm)],['농장 건설 지시 횟수',number(mine.building_orders?.Farm?.commands??mine.command_counts?.Farm),number(theirs.building_orders?.Farm?.commands??theirs.command_counts?.Farm)],['직접 조작한 가축 · 누적',controlled(mine),controlled(theirs)],...(hasBerry?[['열매 작업 전환 · 추정',berry(mine),berry(theirs)]]:[])];
    return `<details class="basic-comparison"><summary>경제·조작 기록 비교</summary>${compareTable(rows,other)}</details>`;
  }
  function renderMethods(analysis) {
    return `<details class="method-note"><summary>분석 기준·제한</summary><p>시대 도달 알림과 명령의 시점을 비교한 복기 후보이며, 승패의 인과관계나 상대 실수를 확정하지 않음. eAPM·건설 지시 횟수를 승리 원인으로 사용하지 않음.</p><p>건설·생산·연구 지시에는 반복·취소·실패가 포함될 수 있음. 실제 보유 병력·완공 건물·유지 농장 수와 다름. 기록 미확인 기술은 문명 무료 제공일 수도 있음.</p><p>가축은 직접 이동·대상·경유 지시한 개체 ID의 누적 수. 발견·현재 보유·본진 도착·섭취 완료 수와 다름. 빼앗긴 가축은 양측에 포함될 수 있음.</p><p>열매는 같은 군락 작업자의 후속 지시가 모인 구간. 괄호는 전환 지시 인원/확인된 작업자 수. 실제 고갈·채집 종료 시각이 아니며 자동 작업은 누락될 수 있음.</p>${(analysis.limitations||[]).map(t=>`<p>${esc(t)}</p>`).join('')}</details>`;
  }
  function bindWorkspace(root,mine,theirs,other,review) {
    const body=root.querySelector('.review-body');
    const tabs=[...root.querySelectorAll('[role="tab"]')];
    const activate=id=>{
      tabs.forEach(t=>{const selected=t.dataset.panel===id;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;});
      root.querySelectorAll('[role="tabpanel"]').forEach(p=>p.hidden=p.id!==`panel-${id}`);
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
        const value=category==='unit_orders'?`지시량 ${number(v.requested_amount)}`:category==='building_orders'?`${number(v.commands)}회`:fmtTime(v.first_seconds);
        const meta=category==='research_orders'?`${number(v.commands)}회 지시`:`첫 지시 ${fmtTime(v.first_seconds)}${category==='unit_orders'?' · '+number(v.commands)+'회':''}`;
        return `<strong class="cell-value">${value}</strong><small class="cell-meta">${meta}</small>${v.negative_amount?`<small class="cell-meta">음수 수량 ${number(v.negative_amount)}</small>`:''}${v.unknown_amount_commands?'<small class="cell-meta">일부 수량 판독 불가</small>':''}`;
      };
      root.querySelector('#production-count').textContent=`${keys.length}종`;
      root.querySelector('#production-table').innerHTML=keys.length?`<table class="timeline comparison data-table"><thead><tr><th scope="col">항목</th><th scope="col">나</th><th scope="col">상대</th></tr></thead><tbody>${keys.map(k=>`<tr><th scope="row">${esc(label(k))}</th><td>${cell(mine[category]?.[k])}</td><td>${cell(theirs[category]?.[k])}</td></tr>`).join('')}</tbody></table>`:'<p class="panel-empty">'+(query?'검색 결과 없음':'분석된 기록 없음')+'</p>';
      root.querySelector('#production-note').textContent=category==='unit_orders'?'수량은 양수 생산 지시량의 합. 실제 생산·생존 수가 아님.':category==='research_orders'?'최초 연구 지시 시각. 실제 완료와 다르며, —는 지시 미확인.':'반복·취소를 포함한 건설 지시 횟수. 실제 건물 수가 아님.';
    };
    root.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{
      category=b.dataset.category;search.value='';
      root.querySelectorAll('[data-category]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));
      renderProduction();body.scrollTop=0;
    }));
    search.addEventListener('input',renderProduction);
    renderProduction();
    const events=[...[mine,theirs].flatMap((metrics,side)=>(metrics.full_timeline||metrics.timeline||[]).map(e=>({...e,side:side?'theirs':'mine'})))].sort((a,b)=>a.seconds-b.seconds);
    const range=root.querySelector('#timeline-range');
    const intervals=[...new Set(events.map(e=>Math.floor(e.seconds/300)))];
    range.innerHTML='<option value="all">전체 시간</option>'+intervals.map(i=>`<option value="${i}">${i*5}–${(i+1)*5}분</option>`).join('');
    let side='both',page=0;
    const kind=root.querySelector('#timeline-kind'),size=15;
    const renderTimeline=()=>{
      const filtered=events.filter(e=>(side==='both'||e.side===side)&&(kind.value==='all'||(e.kind===kind.value)||(kind.value==='QUEUE'&&['DE_QUEUE','MULTIQUEUE'].includes(e.kind)))&&(range.value==='all'||Math.floor(e.seconds/300)===Number(range.value)));
      const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages-1);
      root.querySelector('#timeline-count').textContent=`${number(filtered.length)}개 지시`;
      root.querySelector('#timeline-page').textContent=`${page+1} / ${pages}`;
      root.querySelector('#timeline-prev').disabled=page===0;
      root.querySelector('#timeline-next').disabled=page>=pages-1;
      const visible=filtered.slice(page*size,(page+1)*size),types={QUEUE:'생산',DE_QUEUE:'생산',MULTIQUEUE:'생산',BUILD:'건설',RESEARCH:'연구'};
      root.querySelector('#timeline-table').innerHTML=visible.length?`<table class="timeline event-table"><thead><tr><th scope="col">시간</th><th scope="col">선수</th><th scope="col">명령</th></tr></thead><tbody>${visible.map(e=>`<tr><td>${fmtTime(e.seconds)}</td><td><span class="player-tag ${e.side}">${e.side==='mine'?'나':'상대'}</span></td><td>${esc(label(e.label))}${Number.isFinite(e.amount)?' × '+number(e.amount):''}<small class="cell-meta">${esc(types[e.kind]||e.kind)}</small></td></tr>`).join('')}</tbody></table>`:'<p class="panel-empty">이 조건의 명령 없음</p>';
    };
    root.querySelectorAll('[data-side]').forEach(b=>b.addEventListener('click',()=>{
      side=b.dataset.side;page=0;
      root.querySelectorAll('[data-side]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));renderTimeline();
    }));
    [range,kind].forEach(select=>select.addEventListener('change',()=>{page=0;renderTimeline();}));
    root.querySelector('#timeline-prev').addEventListener('click',()=>{page--;renderTimeline();body.scrollTop=0;});
    root.querySelector('#timeline-next').addEventListener('click',()=>{page++;renderTimeline();body.scrollTop=0;});
    renderTimeline();
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
    const collectLink=document.createElement('a');
    collectLink.className='collect-now';collectLink.textContent='지금 수집 ↗';
    collectLink.href=`https://github.com/${repo}/actions/workflows/update.yml`;
    collectLink.target='_blank';collectLink.rel='noopener noreferrer';
    collectLink.addEventListener('click',()=>{
      if(location.protocol==='file:'||window.SSAPO_BOOTSTRAP){toast('자동 결과 확인은 운영 사이트에서 지원. GitHub에서 Run workflow 실행.');return;}
      collectionWatch.start();
    });
    c.insertBefore(collectLink,c.querySelector('.connect'));
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
  function findingCard(f,opponent=false) {
    const evidence=opponent?f.evidence.replace(/나 (?=\d)/g,'__PLAYER__ ').replace(/상대 (?=\d)/g,'나 ').replace(/__PLAYER__ /g,'상대 '):f.evidence;
    return `<article class="signal-card ${f.kind==='review'?'negative':f.kind==='advantage'?'positive':'investment'}"><span class="finding-stage">${esc(f.stage)} · ${f.kind==='review'?'복기 우선':f.kind==='advantage'?'앞선 기록':'투자 차이'}</span><h4>${esc(f.title)}</h4><p>${esc(evidence)}</p><details><summary>${opponent?'상대가 확인할 점':'고칠 행동·확인할 점'}</summary><p>${esc(f.action)}</p></details></article>`;
  }
  function findingSide(title,items) {
    const render=f=>findingCard(f,title==='상대');
    return `<section class="signal-group"><h3>${esc(title)}<span>${items.length}</span></h3>${items.length?items.slice(0,2).map(render).join(''):'<p class="compact-note">이 단계에서 비교할 진단 근거 부족</p>'}${items.length>2?`<details class="more-signals"><summary>${items.length-2}개 더 보기</summary>${items.slice(2).map(render).join('')}</details>`:''}</section>`;
  }
  function renderEvidenceReview(match) {
    const review=match.analysis.review;
    const stages=['전체','암흑','봉건','성주','왕정'].filter(s=>s==='전체'||[...review.own_findings,...review.opponent_findings].some(f=>f.stage===s));
    return `${review.practice?`<details class="practice-card"><summary><strong>${esc(review.practice.title)}</strong><span>이번 ${fmtTime(review.practice.current_seconds)} → 연습 목표 ${fmtTime(review.practice.target_seconds)}</span></summary><p>${esc(review.practice.evidence)}</p><p>${esc(review.practice.action)}</p></details>`:''}<div class="opening-pair"><span>나 · ${esc(review.own.opening_label)}</span><span>상대 · ${esc(review.opponent.opening_label)}</span></div><div class="panel-toolbar"><div class="segments stage-segments" role="group" aria-label="진단할 시대">${stages.map((s,i)=>`<button data-review-stage="${s}" aria-pressed="${i===0}">${s}</button>`).join('')}</div><button class="subtle" data-open-panel="numbers">전체 수치 보기 →</button></div><p class="compact-note review-intro">수치로 찾은 복기 후보. 각 카드에서 근거와 고칠 행동을 확인.</p><div class="signal-columns"><div id="own-findings">${findingSide('나',review.own_findings)}</div><div id="opponent-findings">${findingSide('상대',review.opponent_findings)}</div></div>`;
  }
  function renderNumbersPanel(review,mine,theirs,other) {
    if(!review)return '<p class="panel-empty">다음 수집에서 수치 분석 갱신</p>';
    const a=review.own,b=review.opponent;
    const at15=s=>s.checkpoints.find(p=>p.seconds===900)?.villager_requests;
    const longest=s=>s.villager_command_gaps.length?Math.max(...s.villager_command_gaps.map(g=>g.seconds)):null;
    const core=[
      ['파서 eAPM',number(mine.eapm),number(theirs.eapm)],
      ...ageList.filter(age=>Number.isFinite(checkpoint(mine,age).reached_seconds)||Number.isFinite(checkpoint(theirs,age).reached_seconds)).map(age=>[`${age} 도달 · 알림`,fmtTime(checkpoint(mine,age).reached_seconds),fmtTime(checkpoint(theirs,age).reached_seconds)]),
      ['첫 군사 생산 지시',fmtTime(a.first_military_seconds),fmtTime(b.first_military_seconds)],
      ['봉건 도달 후 첫 군사 지시',Number.isFinite(a.after_feudal_first_military_seconds)?`${Math.round(a.after_feudal_first_military_seconds)}초`:'—',Number.isFinite(b.after_feudal_first_military_seconds)?`${Math.round(b.after_feudal_first_military_seconds)}초`:'—'],
      ['15분까지 주민 지시량',number(at15(a)),number(at15(b))],
      ['전체 주민 생산 지시량',number(a.villager_requests),number(b.villager_requests)],
      ['전체 군사 생산 지시량',number(a.military_requests),number(b.military_requests)],
      ['군사 생산 지시 병종 수',number(a.military_types),number(b.military_types)],
      ['연구 종류 · 시대업 포함',number(a.research_kinds),number(b.research_kinds)],
      ['추가 TC 건설 지시',`${number(a.additional_tc_build_commands)}회`,`${number(b.additional_tc_build_commands)}회`],
      ['최장 주민 지시 간격',fmtTime(longest(a)),fmtTime(longest(b))]
    ];
    const points=[...new Set([...a.checkpoints,...b.checkpoints].map(p=>p.seconds))].sort((x,y)=>x-y);
    const point=(s,t)=>{const p=s.checkpoints.find(p=>p.seconds===t);return p?`주민 ${number(p.villager_requests)} · 군사 ${number(p.military_requests)}`:'—';};
    const phase=s=>`${fmtTime(s.start)}–${fmtTime(s.end)} · 주민 ${number(s.villager_requests)} / 군사 ${number(s.military_requests)} / 연구 ${number(s.research_kinds)} / 건설 ${number(s.building_commands)}`;
    const phases=[...new Set([...a.phases,...b.phases].map(p=>p.stage))];
    const panels=[['core','핵심'],['checkpoints','5분별'],['phases','시대별'],...(review.personal_benchmarks.length?[['benchmark','내 기록']]:[])];
    let html=`<div class="segments numbers-segments" role="group" aria-label="수치 비교 종류">${panels.map(([id,name],i)=>`<button data-numbers="${id}" aria-pressed="${i===0}">${name}</button>`).join('')}</div><p class="data-caution">주민·군사 수량은 <b>생산 지시량</b>. 실제 생존 수와 다름.</p><section data-number-panel="core">${compareTable(core,other)}</section><section data-number-panel="checkpoints" hidden>${compareTable(points.map(t=>[`${Math.round(t/60)}분 누적`,point(a,t),point(b,t)]),other)}</section><section data-number-panel="phases" hidden><p class="compact-note">각자의 실제 시대 도달 구간별 지시. 연구는 종류, 건설은 횟수.</p>${compareTable(phases.map(stage=>{const l=a.phases.find(p=>p.stage===stage),r=b.phases.find(p=>p.stage===stage);return [stage,l?phase(l):'—',r?phase(r):'—'];}),other)}</section>`;
    if(review.personal_benchmarks.length){
      html+=`<section data-number-panel="benchmark" hidden><p class="compact-note">같은 맵·문명·첫 군사 생산 병종 계열의 이전 최대 10경기 중 비교 가능한 표본. 글로벌 평균·백분위가 아님.</p><table class="timeline comparison"><thead><tr><th>항목</th><th>이번 경기</th><th>내 과거 중앙값</th></tr></thead><tbody>${review.personal_benchmarks.map(p=>`<tr><th scope="row">${esc(p.label)}</th><td>${fmtTime(p.current_seconds)}<small class="cell-meta">${Math.round(Math.abs(p.delta_seconds))}초 ${p.delta_seconds<0?'빠름':p.delta_seconds>0?'늦음':'차이'}</small></td><td>${fmtTime(p.median_seconds)}<small class="cell-meta">${p.samples}경기</small></td></tr>`).join('')}</tbody></table></section>`;
    }
    return html+'<details class="method-note"><summary>수치의 범위·진단 기준</summary><p>시대 도달은 시스템 알림, 첫 군사·업그레이드는 최초 지시 시각. 군사 수량에서 주민·어선·교역·수송선을 제외. 초기 유닛과 무료 획득은 포함하지 않음.</p><p>현재 복기 후보 기준: 시대 도달·첫 군사 지시 20초 이상 차이, 같은 첫 병종의 15분 주민 지시량 5 이상 차이, 군사 지시량 10 이상 차이, 같은 기술 최초 지시 60초 이상 차이. 전략의 정답이나 통계적 등급 기준이 아님.</p><p>주민 지시 공백은 실제 TC 유휴가 아님. 예약 대기·취소·실패·자원·인구 제한·피해를 게임 엔진으로 재생하지 않음. 검증되지 않은 TC 유휴·교환비·등급·글로벌 백분위는 만들지 않음.</p></details>';
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
    const header=`<header class="review-header"><div class="review-heading-row"><span class="outcome ${m.result==='loss'?'loss':''}">${result}</span><h2 id="review-title">${esc(m.map)} · ${esc(m.civilization)}</h2></div><p class="review-opponent">vs ${esc(opponent)}${other?.civilization?' · '+esc(other.civilization):''}</p><div class="review-meta"><span>${esc(date(m.started_at))}${a?' · '+fmtTime(a.duration_game_seconds):''}</span><span class="review-rating">${number(m.rating_before)} → ${number(m.rating_after)}</span></div></header>`;
    const links=`<footer class="review-footer"><a href="https://aoe.ms/replay/?gameId=${Number(m.id)}&amp;profileId=26260702" target="_blank" rel="noopener noreferrer">리플 다운로드 ↗</a><a href="https://www.aoe2insights.com/match/${Number(m.id)}/" target="_blank" rel="noopener noreferrer">AoE2 Insights ↗</a><a href="https://aoe2.gg/matches/${Number(m.id)}?tab=insights" target="_blank" rel="noopener noreferrer">AoE2.GG ↗</a></footer>`;
    let workspace;
    if(!a){
      workspace=header+`<div class="review-body"><p class="panel-empty">${esc(m.analysis_note||'리플 미확보 또는 분석 대기.')}</p></div>`+links;
    }else{
      const highlights=agesIn(mine,theirs).map(age=>{
        const d=ageDifference(mine,theirs,age);
        return `<button class="highlight ${d.delta===null||d.delta===0?'':d.delta<0?'ahead':'behind'}" data-open-panel="ages" data-open-age="${age}"><span>${age} ${d.reached?'도달':'클릭'}</span><strong>${esc(d.text)}</strong><small>나 ${fmtTime(d.a)} · 상대 ${fmtTime(d.b)}</small></button>`;
      }).join('');
      const tabs=[['summary','진단'],['numbers','수치'],['ages','시대업'],['production','생산·연구'],['timeline','타임라인']];
      workspace=header+`<nav class="review-tabs" role="tablist" aria-label="경기 분석 항목">${tabs.map(([id,title],i)=>`<button role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-panel="${id}">${title}</button>`).join('')}</nav><div class="review-body"><section id="panel-summary" role="tabpanel" aria-labelledby="tab-summary" tabindex="0"><div class="highlights">${highlights||'<p class="compact-note">비교할 시대 전환 기록 없음</p>'}</div>${renderReview(m)}${renderBasics(mine,theirs,other)}${renderMethods(a)}</section><section id="panel-numbers" role="tabpanel" aria-labelledby="tab-numbers" tabindex="0" hidden>${renderNumbersPanel(a.review,mine,theirs,other)}</section><section id="panel-ages" role="tabpanel" aria-labelledby="tab-ages" tabindex="0" hidden>${renderAgePanel(mine,theirs,other)}</section><section id="panel-production" role="tabpanel" aria-labelledby="tab-production" tabindex="0" hidden>${renderProductionPanel()}</section><section id="panel-timeline" role="tabpanel" aria-labelledby="tab-timeline" tabindex="0" hidden>${renderTimelinePanel()}</section></div>`+links;
    }
    $('#match-detail').innerHTML=`<div class="review-workspace">${workspace}</div>`;
    if(a)bindWorkspace($('#match-detail .review-workspace'),mine,theirs,other,a.review);
    const dialog=$('#match-dialog');dialog.scrollTop=0;
    document.body.classList.add('review-open');
    if(!dialog.open)dialog.showModal();
  }
  let loadRequest=null;
  function load() {
    if(!loadRequest)loadRequest=loadReport().finally(()=>{loadRequest=null;});
    return loadRequest;
  }
  async function loadReport() {
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
  const collectionWatch=window.createCollectionWatch({
    fetchStatus:async()=>{
      const r=await fetch(`data/status.json?t=${Date.now()}`,{cache:'no-store'});
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
        waiting:['GitHub에서 수집 실행','열린 화면에서 Run workflow → Run workflow를 눌러줘. 새 결과는 여기서 자동 확인해.'],
        retrying:['결과 확인 재시도 중','진행 상태를 읽지 못했어. 자동으로 다시 확인할게.'],
        updated:['새 수집 결과 확인','목록을 최신 저장 결과로 갱신했어. 새 경기가 없어도 수집 확인 시각은 갱신돼.'],
        failed:['수집 오류 확인',detail||'기존 분석을 유지했어. GitHub 실행 기록을 확인해줘.'],
        timeout:['아직 새 수집 결과가 없어','자동 확인을 종료했어. GitHub에서 실행했는지, 대기·실패 상태인지 확인해줘.']
      };
      const [title,hint]=messages[state];
      const box=$('#collection-feedback');box.hidden=false;box.dataset.state=state;
      if($('#collection-title').textContent!==title)$('#collection-title').textContent=title;
      if($('#collection-hint').textContent!==hint)$('#collection-hint').textContent=hint;
    }
  });
  $('#collection-dismiss').addEventListener('click',()=>{collectionWatch.stop();$('#collection-feedback').hidden=true;});
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
  render();load();
})();
