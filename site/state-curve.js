/* Resource totals interpreted from recording checkpoints. */
(function(global){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const valid=curve=>curve&&Array.isArray(curve.points)&&curve.points.length>=2&&curve.points.every(p=>Array.isArray(p)&&((p.length===3&&p.every(Number.isFinite))||(p.length===5&&[p[0],p[1],p[3]].every(Number.isFinite))));
  function niceMax(v){
    if(v<=0)return 1;
    const step=10**Math.floor(Math.log10(v)),n=v/step;
    return ([1,1.5,2,2.5,3,4,5,6,8,10].find(k=>n<=k))*step;
  }
  function summary(curve){
    if(!valid(curve))return null;
    const s=curve.summary||{},lines=[];
    if(Number.isFinite(s.own_mean_resources)&&Number.isFinite(s.opponent_mean_resources)){
      const more=s.own_mean_resources>=s.opponent_mean_resources?'내가':'상대가';
      lines.push(`${clock(s.after_seconds||300)} 이후 쌓아둔 자원 평균: 나 ${s.own_mean_resources.toLocaleString('ko-KR')} · 상대 ${s.opponent_mean_resources.toLocaleString('ko-KR')} (${more} 더 쌓아둠)`);
    }
    if(Number.isFinite(s.own_floating_seconds)&&Number.isFinite(s.opponent_floating_seconds)){
      lines.push(`자원 ${(s.float_line||1000).toLocaleString('ko-KR')} 이상 쌓인 시간: 나 ${clock(s.own_floating_seconds)} · 상대 ${clock(s.opponent_floating_seconds)}`);
    }
    return {lines};
  }
  function chart(points,mineIndex,theirsIndex,title){
    const W=420,H=150,left=40,right=410,y0=10,base=124;
    const end=points[points.length-1][0];
    const top=niceMax(Math.max(...points.map(p=>Math.max(p[mineIndex],p[theirsIndex]))));
    const x=t=>left+t/end*(right-left),y=v=>base-v/top*(base-y0);
    const path=i=>points.map((p,k)=>`${k?'L':'M'}${x(p[0]).toFixed(1)},${y(p[i]).toFixed(1)}`).join(' ');
    const ticks=[0,top/2,top];
    const minutes=[];for(let m=0;m*60<=end;m+=end>1800?10:5)minutes.push(m*60);
    const last=points[points.length-1];
    return `<figure class="state-chart"><figcaption><strong>${esc(title)}</strong><span><b class="mine">━ 나 ${last[mineIndex].toLocaleString('ko-KR')}</b> <b class="theirs">━ 상대 ${last[theirsIndex].toLocaleString('ko-KR')}</b> <small>끝 시점</small></span></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${ticks.map(v=>`<line x1="${left}" x2="${right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="state-grid"/><text x="${left-5}" y="${(y(v)+3.5).toFixed(1)}" text-anchor="end" class="state-axis">${Math.round(v).toLocaleString('ko-KR')}</text>`).join('')}${minutes.map(t=>`<text x="${x(t).toFixed(1)}" y="${base+15}" text-anchor="middle" class="state-axis">${clock(t)}</text>`).join('')}<path d="${path(theirsIndex)}" class="state-line theirs"/><path d="${path(mineIndex)}" class="state-line mine"/></svg></figure>`;
  }
  function render(curve){
    if(!valid(curve))return '';
    const s=summary(curve);
    const points=curve.points.map(p=>p.length===5?[p[0],p[1],p[3]]:p);
    return `<section class="state-curve"><h3 class="detail-heading">자원 흐름 <small>리플 체크포인트 기준</small></h3>${s.lines.length?`<ul class="state-lines">${s.lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`:''}<div class="state-charts">${chart(points,1,2,'쌓아둔 자원 (식량+나무+금+돌)')}</div><details class="method-note"><summary>이 값은</summary><p>리플 체크포인트의 값을 파서가 보유 자원 합계로 해석한 그래프예요. 누적 채집량이 아니며, 파서의 필드 해석은 공식 명세로 확인된 것은 아니에요.</p></details></section>`;
  }
  const api={summary,render,valid};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOStateCurve=api;
})(typeof window==='undefined'?globalThis:window);
