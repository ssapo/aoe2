/* Resource totals interpreted from recording checkpoints. */
(function(global){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const pointsOf=curve=>curve.points.map(p=>p.length===5?[p[0],p[1],p[3]]:p);
  const valid=curve=>!!(curve&&Array.isArray(curve.points)&&curve.points.length>=2&&curve.points.every((p,i)=>Array.isArray(p)&&(p.length===3||p.length===5)&&[p[0],p[1],p[p.length===5?3:2]].every(v=>Number.isFinite(v)&&v>=0)&&(i===0||p[0]>curve.points[i-1][0])));
  const MAX_GAP=30;
  // Left-hold estimates only between nearby observations, never across missing data.
  function stats(points,index,start,end){
    let covered=0,weighted=0,floating=0;
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1];
      if(b[0]-a[0]>MAX_GAP)continue;
      const dt=Math.max(0,Math.min(end,b[0])-Math.max(start,a[0]));
      covered+=dt;weighted+=dt*a[index];if(a[index]>=1000)floating+=dt;
    }
    return covered?{mean:Math.round(weighted/covered),floating:Math.round(floating),covered:Math.round(covered)}:null;
  }
  function ageStats(curve,metrics,index){
    if(!valid(curve)||!metrics||metrics.recording_restored)return [];
    const points=pointsOf(curve),end=points.at(-1)[0];
    const ages=['암흑','봉건','성주','왕정'];
    const starts=ages.map((age,i)=>i===0?0:metrics.age_checkpoints?.[age]?.reached_seconds);
    return ages.flatMap((age,i)=>{
      const start=starts[i],next=starts[i+1];
      if(!Number.isFinite(start)||start<0||start>=end)return [];
      if(!Number.isFinite(next)&&starts.slice(i+2).some(Number.isFinite))return [];
      const stop=Number.isFinite(next)?Math.min(next,end):end;
      if(stop<=start)return [];
      const value=stats(points,index,start,stop);
      return value?[{age,start,end:stop,...value}]:[];
    });
  }
  // Select sustained balances, not spending or lost economic value. Keep all
  // windows disjoint, stop at missing checkpoints, and compare the same clock.
  function resourceWindows(curve,index){
    if(!valid(curve)||![1,2].includes(index))return [];
    const points=pointsOf(curve),windows=[];
    let run=null;
    const finish=()=>{
      if(run&&run.end-run.start>=60){
        const own=stats(points,1,run.start,run.end),opponent=stats(points,2,run.start,run.end);
        const observed=points.filter((p,i)=>i<points.length-1&&p[0]<run.end&&points[i+1][0]>run.start);
        const peak=col=>Math.max(...observed.map(p=>p[col]));
        windows.push({...run,own:{...own,peak:peak(1)},opponent:{...opponent,peak:peak(2)}});
      }
      run=null;
    };
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],start=Math.max(300,a[0]);
      if(b[0]<=start||b[0]-a[0]>MAX_GAP||a[index]<1000){finish();continue;}
      if(!run)run={start,end:b[0],excess:0};
      run.end=b[0];run.excess+=(a[index]-1000)*(b[0]-start);
    }
    finish();
    return windows.sort((a,b)=>b.excess-a.excess||(b.end-b.start)-(a.end-a.start)||a.start-b.start);
  }
  const ageLabels={'Feudal Age':'봉건','Castle Age':'성주','Imperial Age':'왕정'};
  function windowActions(metrics,start,end){
    // The short legacy timeline is truncated: never infer absence from it.
    if(!Array.isArray(metrics?.full_timeline))return null;
    const events=metrics.full_timeline.filter(e=>e&&Number.isFinite(e.seconds)&&e.seconds>=start&&e.seconds<end);
    const production=events.filter(e=>e.kind==='QUEUE'&&Number.isFinite(e.amount)&&e.amount>0).length;
    const cancellations=events.filter(e=>e.kind==='QUEUE'&&Number.isFinite(e.amount)&&e.amount<0).length;
    const unknown=events.filter(e=>e.kind==='QUEUE'&&!Number.isFinite(e.amount)).length;
    const research=new Set(events.filter(e=>e.kind==='RESEARCH'&&!Object.hasOwn(ageLabels,e.label)).map(e=>e.label)).size;
    const buildings=events.filter(e=>e.kind==='BUILD').length;
    const market=events.filter(e=>e.kind==='BUY'||e.kind==='SELL').length;
    const ages=[];
    for(const e of metrics.full_timeline){
      if(e&&Number.isFinite(e.seconds)&&e.seconds>=start&&e.seconds<end+30&&e.kind==='RESEARCH'&&Object.hasOwn(ageLabels,e.label)&&!ages.some(a=>a.age===ageLabels[e.label]))ages.push({age:ageLabels[e.label],seconds:e.seconds});
    }
    return {production,cancellations,unknown,research,buildings,market,ages};
  }
  function resourceInsights(curve,mine,theirs){
    return [mine,theirs].map((metrics,i)=>resourceWindows(curve,i+1).slice(0,3).map(w=>({...w,actions:windowActions(metrics,w.start,w.end)})));
  }
  const amount=value=>value.toLocaleString('ko-KR');
  const duration=seconds=>{const n=Math.round(seconds);return `${Math.floor(n/60)}분${n%60?` ${n%60}초`:''}`;};
  const resourceIcons='<span class="resource-icons" aria-hidden="true"><svg viewBox="0 0 24 24" class="food"><path d="M12 21V4M12 9C4 9 4 2 4 2s8 0 8 7Zm0 6c-8 0-8-7-8-7s8 0 8 7Zm0-3c8 0 8-7 8-7s-8 0-8 7Z"/></svg><svg viewBox="0 0 24 24" class="wood"><path d="m5 18 10-13 5 4-10 13Z"/><ellipse cx="6" cy="19" rx="4" ry="3"/><path d="m11 13 5-6M4 19h4"/></svg><svg viewBox="0 0 24 24" class="gold"><path d="m3 18 4-11h10l4 11Zm4-11 3 4h8M10 11l-3 7"/></svg><svg viewBox="0 0 24 24" class="stone"><path d="m3 18 2-10 8-5 7 6 1 9-9 3Zm2-10 8 4 7-3M13 12l-1 9"/></svg></span>';
  function renderInsights(curve,mine,theirs,compact=false){
    const [own,opponent]=resourceInsights(curve,mine,theirs);
    if((compact&&!own.length)||(!own.length&&!opponent.length))return '';
    const card=w=>{
      const a=w.actions,age=a?.ages.map(v=>`${v.age}업 ${clock(v.seconds)}`).join(' · ');
      const actions=a?[
        a.production?`생산 명령 ${a.production}회`:'',a.research?`연구 ${a.research}종`:'',a.buildings?`건설 ${a.buildings}회`:'',
        a.cancellations?`생산 취소 ${a.cancellations}회`:'',a.unknown?`수량 불명 ${a.unknown}회`:'',a.market?`시장 ${a.market}회`:''
      ].filter(Boolean):[];
      const delta=w.own.mean-w.opponent.mean;
      const comparison=delta===0?'나와 같음':`나보다 ${amount(Math.abs(delta))} ${delta>0?'적음':'많음'}`;
      return `<article class="resource-window own"><header><div>${resourceIcons}<span>보유 자원 합계</span></div><time>${clock(w.start)}–${clock(w.end)}</time></header><dl class="resource-metrics"><div class="resource-primary"><dt>평균 보유</dt><dd>${amount(w.own.mean)}</dd></div><div><dt><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3 14 5-5 4 3 5-8M12 4h5v5"/></svg>최대 보유</dt><dd>${amount(w.own.peak)}</dd></div><div><dt><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 5v5l3 2"/></svg>1,000 이상</dt><dd class="resource-duration">${duration(w.end-w.start)}</dd></div></dl><div class="resource-opponent-line"><span>같은 시간 상대 평균</span><strong>${amount(w.opponent.mean)}</strong><span>${comparison}</span></div>${age?`<p class="resource-age">${esc(age)}</p>`:''}${!compact&&actions.length?`<ul class="resource-actions">${actions.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:''}</article>`;
    };
    const opponentRow=w=>`<li><time>${clock(w.start)}–${clock(w.end)}</time><span>상대 평균 <strong>${amount(w.opponent.mean)}</strong> · 최대 ${amount(w.opponent.peak)}</span><span>1,000 이상 ${duration(w.end-w.start)} · 내 평균 ${amount(w.own.mean)}</span></li>`;
    return `<section class="resource-insights"><div class="panel-toolbar"><h3 class="detail-heading">${own.length?'내 자원 운영':'상대 자원 운영'}</h3>${compact?'<button class="subtle" data-open-panel="numbers">자세히 →</button>':''}</div>${own.length?card(own[0]):''}${!compact&&own.length>1?`<details class="resource-more"><summary>내 다른 구간 ${own.length-1}개</summary>${own.slice(1).map(card).join('')}</details>`:''}${opponent.length&&!compact?`<details class="resource-more resource-opponent-details"><summary>상대가 자원을 모아둔 구간 ${opponent.length}개</summary><ul>${opponent.map(opponentRow).join('')}</ul></details>`:''}</section>`;
  }
  function ageTable(curve,mine,theirs){
    const own=ageStats(curve,mine,1),opp=ageStats(curve,theirs,2);
    const names=['암흑','봉건','성주','왕정'].filter(age=>own.concat(opp).some(p=>p.age===age));
    if(!names.length)return '';
    const cell=p=>p?`평균 <strong>${p.mean.toLocaleString('ko-KR')}</strong><br>1,000 이상 약 ${clock(p.floating)}<small class="cell-meta">${clock(p.start)}–${clock(p.end)} · 계산 구간 ${clock(p.covered)}</small>`:'—';
    return `<details class="age-resource-details"><summary>시대별 보유 자원 · 나 / 상대</summary><div class="table-scroll"><table class="timeline comparison"><thead><tr><th scope="col">시대</th><th scope="col">나</th><th scope="col">상대</th></tr></thead><tbody>${names.map(age=>`<tr><th scope="row">${age}</th><td>${cell(own.find(p=>p.age===age))}</td><td>${cell(opp.find(p=>p.age===age))}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  function niceMax(v){
    if(v<=0)return 1;
    const step=10**Math.floor(Math.log10(v)),n=v/step;
    return ([1,1.5,2,2.5,3,4,5,6,8,10].find(k=>n<=k))*step;
  }
  function summary(curve){
    if(!valid(curve))return null;
    const points=pointsOf(curve),end=points.at(-1)[0],a=stats(points,1,300,end),b=stats(points,2,300,end),lines=[];
    if(a&&b){
      lines.push(`5:00 이후 시간 가중 평균 자원: 나 ${a.mean.toLocaleString('ko-KR')} · 상대 ${b.mean.toLocaleString('ko-KR')}`);
      lines.push(`자원 1,000 이상 보유한 추정 시간: 나 ${clock(a.floating)} · 상대 ${clock(b.floating)} (계산 구간 ${clock(a.covered)})`);
    }
    return {lines};
  }
  function chart(points,mineIndex,theirsIndex,title){
    const W=420,H=150,left=40,right=410,y0=10,base=124;
    const end=points[points.length-1][0];
    const top=niceMax(Math.max(...points.map(p=>Math.max(p[mineIndex],p[theirsIndex]))));
    const x=t=>left+t/end*(right-left),y=v=>base-v/top*(base-y0);
    const path=i=>points.map((p,k)=>`${k&&p[0]-points[k-1][0]<=MAX_GAP?'L':'M'}${x(p[0]).toFixed(1)},${y(p[i]).toFixed(1)}`).join(' ');
    const ticks=[0,top/2,top];
    const minutes=[];for(let m=0;m*60<=end;m+=end>1800?10:5)minutes.push(m*60);
    const last=points[points.length-1];
    return `<figure class="state-chart"><figcaption><strong>${esc(title)}</strong><span><b class="mine">━ 나 ${last[mineIndex].toLocaleString('ko-KR')}</b> <b class="theirs">━ 상대 ${last[theirsIndex].toLocaleString('ko-KR')}</b> <small>끝 시점</small></span></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${ticks.map(v=>`<line x1="${left}" x2="${right}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="state-grid"/><text x="${left-5}" y="${(y(v)+3.5).toFixed(1)}" text-anchor="end" class="state-axis">${Math.round(v).toLocaleString('ko-KR')}</text>`).join('')}${minutes.map(t=>`<text x="${x(t).toFixed(1)}" y="${base+15}" text-anchor="middle" class="state-axis">${clock(t)}</text>`).join('')}<path d="${path(theirsIndex)}" class="state-line theirs"/><path d="${path(mineIndex)}" class="state-line mine"/></svg></figure>`;
  }
  function render(curve,mine,theirs){
    if(!valid(curve))return '';
    const s=summary(curve);
    const points=curve.points.map(p=>p.length===5?[p[0],p[1],p[3]]:p);
    return `<section class="state-curve"><h3 class="detail-heading">자원 흐름 </h3>${s.lines.length?`<ul class="state-lines">${s.lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`:''}<div class="state-charts">${chart(points,1,2,'쌓아둔 자원 (식량+나무+금+돌)')}</div>${ageTable(curve,mine,theirs)}</section>`;
  }
  const api={summary,render,valid,stats,ageStats,resourceWindows,windowActions,resourceInsights,renderInsights};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOStateCurve=api;
})(typeof window==='undefined'?globalThis:window);
