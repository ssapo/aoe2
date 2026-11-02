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
  function openMatch(id) {
    const m = (report.matches||[]).find(m=>m.id===id); if(!m)return;
    const a=m.analysis;
    $('#match-subtitle').textContent=`경기 #${m.id}`;
    let content=`<h2 class="review-title">${esc(m.map)} · ${esc(m.civilization)}</h2><div class="review-meta">${esc(date(m.started_at))} · ${m.result==='win'?'승리':m.result==='loss'?'패배':'결과 미확인'} · 레이팅 ${number(m.rating_before)} → ${number(m.rating_after)}</div>`;
    if(!a) {
      content+=`<article class="insight"><h3>상세 분석 없음</h3><p>${esc(m.analysis_note||'리플 미확보 또는 분석 대기.')}</p></article>`;
    } else {
      content+=`<div class="review-stats"><article><small>게임 시간</small><strong>${fmtTime(a.duration_game_seconds)}</strong></article><article><small>파서 eAPM</small><strong>${number(a.metrics?.eapm)}</strong></article><article><small>분석 범위</small><strong style="font-size:15px">명령 기록</strong></article></div>`;
      content+=(a.insights||[]).filter(i=>i.kind!=='practice').map(i=>`<article class="insight ${['strength','practice','review'].includes(i.kind)?i.kind:'review'}"><h3>${esc(i.title)}</h3><p>${esc(i.evidence)}</p><p class="action">→ ${esc(i.action)}</p><small>${esc(i.confidence)}</small></article>`).join('');
      const ages=Object.entries(a.metrics?.age_commands||{});
      if(ages.length) content+=`<h3 style="font-size:14px;margin:25px 0 8px">시대 전환 명령</h3><p class="detail-note">전환 명령 시점. 시대 도달 시점과 다름.</p><div class="review-stats">${ages.map(([k,v])=>`<article><small>${esc(k)} 명령</small><strong>${fmtTime(v)}</strong></article>`).join('')}</div>`;
      content+='<details><summary>초반 명령 타임라인 보기 (최대 100개)</summary><table class="timeline"><thead><tr><th>게임 시간</th><th>명령</th><th>종류</th></tr></thead><tbody>'+(a.metrics?.timeline||[]).map(e=>`<tr><td>${fmtTime(e.seconds)}</td><td>${esc(e.label)}</td><td class="type">${esc(e.kind)}</td></tr>`).join('')+'</tbody></table></details>';
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
