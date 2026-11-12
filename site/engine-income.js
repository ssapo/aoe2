/* Cumulative income per resource from the re-simulation engine, shown only over the span its stockpile matched the recording's checkpoints. */
(function(global){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const num=v=>Math.round(v).toLocaleString('ko-KR');
  const RESOURCES=[['식량',1,5],['나무',2,6],['금',3,7],['돌',4,8]];
  const valid=d=>!!d&&Array.isArray(d.points)&&d.points.length>=2&&d.points.every(p=>Array.isArray(p)&&p.length===9&&p.every(Number.isFinite))&&Number.isFinite(d.verified_until_seconds);
  function niceMax(v){
    if(v<=0)return 1;
    const step=10**Math.floor(Math.log10(v)),n=v/step;
    return ([1,1.5,2,2.5,3,4,5,6,8,10].find(k=>n<=k))*step;
  }
  function summary(d){
    if(!valid(d))return null;
    const last=d.points[d.points.length-1];
    const total=(p,from)=>p[from]+p[from+1]+p[from+2]+p[from+3];
    let widest=null;
    for(const p of d.points){
      const gap=total(p,1)-total(p,5);
      if(!widest||Math.abs(gap)>Math.abs(widest.gap))widest={seconds:p[0],gap};
    }
    return {until:d.verified_until_seconds,at:last[0],own:total(last,1),opponent:total(last,5),widest,
      shown:RESOURCES.filter(([, a, b])=>d.points.some(p=>p[a]>0||p[b]>0))};
  }
  function chart(points,mineIndex,theirsIndex,title){
    const W=420,H=150,left=40,right=410,y0=10,base=124;
    const end=points[points.length-1][0]||1;
    const top=niceMax(Math.max(...points.map(p=>Math.max(p[mineIndex],p[theirsIndex]))));
    const x=t=>left+t/end*(right-left),y=v=>base-v/top*(base-y0);
    const path=i=>points.map((p,k)=>`${k?'L':'M'}${x(p[0]).toFixed(1)},${y(p[i]).toFixed(1)}`).join(' ');
    const minutes=[];for(let m=0;m*60<=end;m+=end>1800?10:5)minutes.push(m*60);
    const last=points[points.length-1];
    return `<figure class="state-chart"><figcaption><strong>${esc(title)}</strong><span><b class="mine">━ 나 ${num(last[mineIndex])}</b> <b class="theirs">━ 상대 ${num(last[theirsIndex])}</b> <small>${clock(end)}까지</small></span></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)} 누적 수입">${[0,top/2,top].map(v=>`<line x1="${left}" x2="${right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="state-grid"/><text x="${left-5}" y="${(y(v)+3.5).toFixed(1)}" text-anchor="end" class="state-axis">${num(v)}</text>`).join('')}${minutes.map(t=>`<text x="${x(t).toFixed(1)}" y="${base+15}" text-anchor="middle" class="state-axis">${clock(t)}</text>`).join('')}<path d="${path(theirsIndex)}" class="state-line theirs"/><path d="${path(mineIndex)}" class="state-line mine"/></svg></figure>`;
  }
  function render(d){
    const s=summary(d);
    if(!s||!s.shown.length)return '';
    const lines=[`${clock(s.at)}까지 모은 자원: 나 ${num(s.own)} · 상대 ${num(s.opponent)}`];
    if(s.widest&&s.widest.gap!==0)lines.push(`가장 크게 벌어진 때: ${clock(s.widest.seconds)}, ${s.widest.gap>0?'내가':'상대가'} ${num(Math.abs(s.widest.gap))} 더 모음`);
    return `<section class="state-curve engine-income"><h3 class="detail-heading">자원별 누적 수입 <small>경기 재현 · ${clock(s.until)}까지 확인됨</small></h3><ul class="state-lines">${lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul><div class="state-charts">${s.shown.map(([name,a,b])=>chart(d.points,a,b,name)).join('')}</div></section>`;
  }
  const api={summary,render,valid};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOEngineIncome=api;
})(typeof window==='undefined'?globalThis:window);
