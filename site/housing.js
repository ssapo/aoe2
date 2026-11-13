/* Population blocks before the Feudal click, estimated by replaying the recorded orders. */
(function(global){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const side=row=>row&&Array.isArray(row.blocks)&&Number.isFinite(row.blocked_seconds)?row:null;
  function valid(h){return !!(h&&(side(h.own)||side(h.opponent)));}
  function total(row){return side(row)?row.blocked_seconds:null;}
  function text(row){
    if(!side(row))return '—';
    if(!row.blocks.length)return '없음';
    return `${clock(row.blocked_seconds)} (${row.blocks.map(b=>`${clock(b.from_seconds)}~${clock(b.to_seconds)} ${b.population}`).join(', ')})`;
  }
  // One villager takes 25 s at a Town Center (DAT build 188329).
  function villagers(seconds){
    const v=seconds/25;
    return v>=1?`주민 약 ${Math.round(v)}명분`:`주민 1명분 시간의 ${Math.round(v*100)}%`;
  }
  function warning(h){
    if(!valid(h)||!total(h.own))return '';
    const own=h.own,b=total(h.opponent);
    const rival=b===null?'':b?`상대도 ${clock(b)} 막혔어요.`:'상대는 막힘이 없었어요.';
    const spans=own.blocks.map(x=>`<li><time>${clock(x.from_seconds)}~${clock(x.to_seconds)}</time> 인구 ${esc(x.population)} · ${clock(x.seconds)}</li>`).join('');
    return `<section class="housing-alert" aria-labelledby="housing-alert-title"><p class="housing-alert-label">꼭 고칠 점 · 봉건 전 인구 막힘 <small>추정</small></p><h3 id="housing-alert-title"><strong>${clock(own.blocked_seconds)}</strong> 동안 생산이 멈췄어요</h3><p class="housing-alert-cost">${villagers(own.blocked_seconds)} 생산 시간을 잃었어요. ${rival}</p><ul class="housing-alert-spans">${spans}</ul><p class="housing-alert-action">집은 인구가 상한보다 3 적을 때 지으세요. 일꾼 1명이면 25초, 2명이면 19초 걸려요.</p><button class="subtle" data-open-panel="ages" data-open-age="봉건">봉건 화면에서 보기 →</button></section>`;
  }
  function badge(h){
    const a=valid(h)?total(h.own):null;
    return a?`<span class="housing-badge" title="봉건 전 인구 막힘 · 추정">인구 막힘 ${clock(a)}</span>`:'';
  }
  function highlight(h){
    if(!valid(h))return '';
    const a=total(h.own),b=total(h.opponent);
    if(!a&&!b)return '';
    if(a)return '';                     // the alert above the cards shows it
    const cls=a===null||b===null||a===b?'':a>b?'behind':'ahead';
    return `<button class="highlight ${cls}" data-open-panel="ages" data-open-age="봉건"><span>봉건 전 인구 막힘 · 추정</span><strong>${a?clock(a):'없음'}</strong><small>나 · 상대 ${b?clock(b):b===0?'없음':'—'}</small></button>`;
  }
  // Villagers that had come out by the Feudal click: the start's plus those trained since
  // (`villagers`, analysis revision 20). Deaths are not taken off, so never "alive".
  const count=n=>Number.isInteger(n)&&n>=0;
  const out=row=>side(row)&&row.feudal_clicked!==false&&row.villagers&&count(row.villagers.start)&&count(row.villagers.trained)?row.villagers:null;
  function cameOut(row){
    const v=out(row);
    if(!v)return '—';
    const n=v.start+v.trained;
    if(v.counted!==true)return `${n}명 · 추정`;
    // units in the checkpoint interval that holds the click: before or after it is not known
    return count(v.at_click)&&v.at_click?`${n}~${n+v.at_click}명`:`${n}명`;
  }
  function rows(h){
    if(!valid(h))return [];
    const came=out(h.own)||out(h.opponent)?[['누르기 전까지 나온 주민 · 시작 포함',cameOut(h.own),cameOut(h.opponent)]]:[];
    return [...came,['봉건 전 인구 막힘 · 추정',text(h.own),text(h.opponent)]];
  }
  function note(h){
    if(!valid(h))return '';
    const came=out(h.own)||out(h.opponent)?'<p>‘나온 주민’은 요청 횟수가 아니라, 리플에 몇 초마다 찍힌 오브젝트 수로 센 값에 시작 주민을 더한 수예요. 그사이 죽은 주민은 빼지 못해요. ‘19~20명’ 같은 범위는 클릭과 같은 구간에 나온 주민이 클릭 전인지 후인지 가릴 수 없다는 뜻이고, 셀 수 없는 구간이 끼면 ‘추정’이라고 적어요.</p>':'';
    return `<details class="method-note"><summary>${came?'나온 주민·인구 막힘은':'인구 막힘은'}</summary>${came}<p>${came?'인구 막힘은 ':''}리플의 생산·건설 명령을 순서대로 다시 돌려서, 인구가 꽉 차 주민·병력이 생산을 시작하지 못한 구간을 찾은 추정이에요. 봉건 클릭 전까지만 보고, ${Number.isFinite(h.min_block_seconds)?h.min_block_seconds:10}초보다 짧은 구간은 오차 범위라 뺐어요.</p><p>집 완성 시각은 일꾼이 걸어간 거리를 어림하고, 생산 요청이 식량 부족으로 거절됐는지는 리플에 남은 자원 합계로 추정해요. 주민 1명 차이로 시작 시각이 25초쯤 달라질 수 있어요.</p></details>`;
  }
  const api={valid,highlight,rows,note,text,warning,badge};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOHousing=api;
})(typeof window==='undefined'?globalThis:window);
