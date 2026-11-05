/* Stockpile and object count the game wrote into the recording (checkpoints), never simulated. */
(function(global){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const valid=curve=>curve&&Array.isArray(curve.points)&&curve.points.length>=2&&curve.points.every(p=>Array.isArray(p)&&p.length===5&&p.every(Number.isFinite));
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
    const w=s.largest_swing;
    if(w&&Number.isFinite(w.change)&&w.change!==0){
      lines.push(`오브젝트 수 격차가 가장 크게 움직인 구간: ${clock(w.from_seconds)}~${clock(w.to_seconds)}, ${w.change>0?'나':'상대'} 쪽으로 ${Math.abs(w.change)} (나 ${w.own_from}→${w.own_to}, 상대 ${w.opponent_from}→${w.opponent_to})`);
    }
    return {lines,swing:w||null};
  }
  function chart(points,mineIndex,theirsIndex,title,swing){
    const W=420,H=150,left=40,right=410,y0=10,base=124;
    const end=points[points.length-1][0];
    const top=niceMax(Math.max(...points.map(p=>Math.max(p[mineIndex],p[theirsIndex]))));
    const x=t=>left+t/end*(right-left),y=v=>base-v/top*(base-y0);
    const path=i=>points.map((p,k)=>`${k?'L':'M'}${x(p[0]).toFixed(1)},${y(p[i]).toFixed(1)}`).join(' ');
    const ticks=[0,top/2,top];
    const minutes=[];for(let m=0;m*60<=end;m+=end>1800?10:5)minutes.push(m*60);
    const band=swing&&Number.isFinite(swing.from_seconds)&&Number.isFinite(swing.to_seconds)?`<rect x="${x(swing.from_seconds).toFixed(1)}" y="${y0}" width="${Math.max(2,x(swing.to_seconds)-x(swing.from_seconds)).toFixed(1)}" height="${base-y0}" class="state-swing"><title>격차가 가장 크게 움직인 구간</title></rect>`:'';
    const last=points[points.length-1];
    return `<figure class="state-chart"><figcaption><strong>${esc(title)}</strong><span><b class="mine">━ 나 ${last[mineIndex].toLocaleString('ko-KR')}</b> <b class="theirs">━ 상대 ${last[theirsIndex].toLocaleString('ko-KR')}</b> <small>끝 시점</small></span></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${band}${ticks.map(v=>`<line x1="${left}" x2="${right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="state-grid"/><text x="${left-5}" y="${(y(v)+3.5).toFixed(1)}" text-anchor="end" class="state-axis">${Math.round(v).toLocaleString('ko-KR')}</text>`).join('')}${minutes.map(t=>`<text x="${x(t).toFixed(1)}" y="${base+15}" text-anchor="middle" class="state-axis">${clock(t)}</text>`).join('')}<path d="${path(theirsIndex)}" class="state-line theirs"/><path d="${path(mineIndex)}" class="state-line mine"/></svg></figure>`;
  }
  function render(curve){
    if(!valid(curve))return '';
    const s=summary(curve);
    return `<section class="state-curve"><h3 class="detail-heading">자원·규모 흐름 <small>게임이 리플에 남긴 값</small></h3>${s.lines.length?`<ul class="state-lines">${s.lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`:''}<div class="state-charts">${chart(curve.points,1,3,'쌓아둔 자원 (식량+나무+금+돌)',s.swing)}${chart(curve.points,2,4,'오브젝트 수',s.swing)}</div><details class="method-note"><summary>이 값은</summary><p>게임이 약 7~15초마다 리플에 기록한 선수별 값이라, 시뮬레이션이나 추정이 아니에요. 쌓아둔 자원은 그 순간 쓰지 않고 가진 자원의 합이에요.</p><p>오브젝트 수에는 유닛·건물·소유 가축과 화살 같은 순간 객체가 섞여 있어서 병력 수가 아니에요. 갑자기 늘거나 줄면 교전이나 대량 생산·건설의 후보로만 보세요.</p></details></section>`;
  }
  const api={summary,render,valid};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOStateCurve=api;
})(typeof window==='undefined'?globalThis:window);
