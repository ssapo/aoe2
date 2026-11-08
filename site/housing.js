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
  function highlight(h){
    if(!valid(h))return '';
    const a=total(h.own),b=total(h.opponent);
    if(!a&&!b)return '';
    const cls=a===null||b===null||a===b?'':a>b?'behind':'ahead';
    return `<button class="highlight ${cls}" data-open-panel="ages" data-open-age="봉건"><span>봉건 전 인구 막힘 · 추정</span><strong>${a?clock(a):'없음'}</strong><small>나 · 상대 ${b?clock(b):b===0?'없음':'—'}</small></button>`;
  }
  function rows(h){
    if(!valid(h))return [];
    return [['봉건 전 인구 막힘 · 추정',text(h.own),text(h.opponent)]];
  }
  function note(h){
    if(!valid(h))return '';
    return `<details class="method-note"><summary>인구 막힘은</summary><p>리플의 생산·건설 명령을 순서대로 다시 돌려서, 인구가 꽉 차 주민·병력이 생산을 시작하지 못한 구간을 찾은 추정이에요. 봉건 클릭 전까지만 보고, ${Number.isFinite(h.min_block_seconds)?h.min_block_seconds:10}초보다 짧은 구간은 오차 범위라 뺐어요.</p><p>집 완성 시각은 일꾼이 걸어간 거리를 어림하고, 생산 요청이 식량 부족으로 거절됐는지는 리플에 남은 자원 합계로 추정해요. 주민 1명 차이로 시작 시각이 25초쯤 달라질 수 있어요.</p></details>`;
  }
  const api={valid,highlight,rows,note,text};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOHousing=api;
})(typeof window==='undefined'?globalThis:window);
