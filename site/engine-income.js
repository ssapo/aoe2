/* Cumulative income per resource from the re-simulation engine, shown only over the span its stockpile matched the recording's checkpoints; below it, where the food (and gold) came from. */
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
  /* By source: one stored row is [seconds, 9 of mine, 9 of the opponent's]; 7 food sources, then gold from mines and other gold. */
  const FOOD=['가축','사냥','열매','농장','물고기','기타']; // shown rows; boar and deer are one row (사냥)
  const GOLD=['금광','기타'];
  /* A source someone has set up by the counted time is listed even while both sides are at zero:
     a Mill (or Folwark) request stands for berries, a Farm request for farms. The rest only when used. */
  const SETUP={Mill:2,Folwark:2,Farm:3};
  function started(timelines,until){
    const found=new Set();
    for(const timeline of Array.isArray(timelines)?timelines:[]){
      for(const e of Array.isArray(timeline)?timeline:[]){
        if(e&&e.kind==='BUILD'&&Number.isFinite(e.seconds)&&e.seconds<=until&&Object.prototype.hasOwnProperty.call(SETUP,e.label))found.add(SETUP[e.label]);
      }
    }
    return found;
  }
  function sources(d,timelines){
    const part=d&&d.by_source;
    if(!part||!Array.isArray(part.points)||!part.points.length)return null;
    const last=part.points[part.points.length-1];
    if(!Array.isArray(last)||last.length!==19||!last.every(v=>Number.isFinite(v)&&v>=0))return null;
    const side=from=>{const f=last.slice(from,from+7);return {food:[f[0],f[1]+f[2],f[3],f[4],f[5],f[6]],gold:last.slice(from+7,from+9)};};
    const own=side(1),opponent=side(10);
    const sum=list=>list.reduce((a,b)=>a+b,0);
    if(sum(own.food)+sum(opponent.food)<=0)return null;
    const setUp=started(timelines,last[0]);
    return {seconds:last[0],own,opponent,
      // APP-20: every source row in every match (zeros included); setUp is kept for callers that ask
      foodShown:FOOD.map((name,i)=>[name,i]),setUp,
      goldSplit:own.gold[1]>0||opponent.gold[1]>0};
  }
  function sourceRows(names,values,side){
    const total=values.reduce((a,b)=>a+b,0);
    return `<ul class="source-rows">${names.map(([name,i])=>{
      const share=total>0?Math.round(values[i]/total*100):0;
      return `<li><span class="source-name">${esc(name)}</span><span class="source-bar ${side}" aria-hidden="true"><i style="width:${share}%"></i></span><span class="source-amount">${esc(num(values[i]))}</span><span class="source-share">${share}%</span></li>`;
    }).join('')}</ul>`;
  }
  /* By animal: what each side's gatherers brought in from every single sheep, boar and deer by the counted time.
     `full` (an animal's whole food) is stored only for an animal finished and not shared by the counted time; then what was left is shown too. */
  const KINDS=[['sheep','가축',['sheep']],['hunt','사냥',['boar','deer']],['other','기타 동물',[]]];
  const LEFT_SHARE=.2;
  function animals(d){
    const part=d&&d.animals;
    if(!part||!Number.isFinite(part.until_seconds))return null;
    const known=new Set(KINDS.flatMap(k=>k[2]));
    const side=list=>KINDS.map(([kind,name,members])=>{
      const rows=(Array.isArray(list)?list:[]).filter(a=>a&&Number.isFinite(a.eaten)&&a.eaten>0&&(members.includes(a.kind)||(kind==='other'&&!known.has(a.kind)))).map(a=>{
        const full=Number.isFinite(a.full)&&a.full>=a.eaten?a.full:null,left=full===null?null:full-a.eaten;
        return {eaten:a.eaten,full,left,wasted:full!==null&&full>0&&left/full>=LEFT_SHARE};
      });
      const allFull=rows.length>0&&rows.every(r=>r.full!==null);
      return {kind,name,rows,eaten:rows.reduce((a,r)=>a+r.eaten,0),full:allFull?rows.reduce((a,r)=>a+r.full,0):null};
    }).filter(k=>k.rows.length);
    const own=side(part.own),opponent=side(part.opponent);
    if(!own.length&&!opponent.length)return null;
    return {seconds:part.until_seconds,own,opponent};
  }
  function renderAnimals(d){
    const s=animals(d);
    if(!s){
      const part=d&&d.animals,until=part&&Number.isFinite(part.until_seconds)?part.until_seconds:Number.isFinite(d&&d.verified_until_seconds)?d.verified_until_seconds:null;
      const why=part?`확인된 구간(${until===null?'—':clock(until)}) 안에 일꾼이 식량을 가져온 동물이 없어요.`:'동물별 기록이 없는 예전 분석이에요. 다시 분석되면 나와요.';
      return `<div class="source-block animal-block" data-section="animals"><h4>동물별 먹은 양</h4><p class="section-why">${esc(why)}</p></div>`;
    }
    const kinds=list=>list.length?list.map(k=>`<p class="animal-kind"><b>${esc(k.name)} ${k.rows.length}마리</b> · ${esc(num(k.eaten))}${k.full!==null?` / ${esc(num(k.full))}`:''}</p><ul class="animal-chips">${k.rows.map(r=>`<li${r.wasted?' class="left"':''}>${esc(num(r.eaten))}${r.wasted?`<small>남김 ${esc(num(r.left))}</small>`:''}</li>`).join('')}</ul>`).join(''):'<p class="animal-kind">먹은 동물 없음</p>';
    const count=list=>list.reduce((a,k)=>a+k.rows.length,0);
    return `<div class="source-block animal-block" data-section="animals"><h4>동물별 먹은 양 <small>${clock(s.seconds)}까지 · 한 마리마다 일꾼이 가져온 식량</small></h4><div class="source-sides">${[['mine','나',s.own],['theirs','상대',s.opponent]].map(([side,who,list])=>`<div class="source-side"><strong class="${side}">${esc(who)} · ${count(list)}마리</strong>${kinds(list)}</div>`).join('')}</div><p class="source-note">확인된 시각까지만 센 값이에요. 그때 먹고 있던 동물은 적게 나와요.</p></div>`;
  }
  function renderSources(d,timelines){
    const s=sources(d,timelines);
    if(!s){
      const why='<p class="section-why">이 경기는 출처별 기록이 없어요. 예전 분석이면 다시 분석될 때 나와요.</p>';
      return `<div class="income-sources"><div class="source-block" data-section="food-sources"><h4>식량 출처</h4>${why}</div>${renderAnimals(d)}<div class="source-block" data-section="gold-sources"><h4>금 출처</h4>${why}</div></div>`;
    }
    const sum=list=>list.reduce((a,b)=>a+b,0);
    const block=(title,names,pick,id)=>`<div class="source-block" data-section="${id}"><h4>${esc(title)} <small>${clock(s.seconds)}까지 일꾼이 가져온 양</small></h4><div class="source-sides">${[['mine','나',s.own],['theirs','상대',s.opponent]].map(([side,who,data])=>`<div class="source-side"><strong class="${side}">${esc(who)} · ${esc(num(sum(pick(data))))}</strong>${sourceRows(names,pick(data),side)}</div>`).join('')}</div></div>`;
    return `<div class="income-sources">${block('식량 출처',s.foodShown,x=>x.food,'food-sources')}${renderAnimals(d)}${block('금 출처',GOLD.map((name,i)=>[name,i]),x=>x.gold,'gold-sources')}<p class="source-note">생산을 취소해 돌려받은 자원은 여기에 넣지 않았어요. 그래서 위 그래프의 숫자보다 적을 수 있어요.</p></div>`;
  }
  function render(d,timelines){
    const s=summary(d);
    if(!s||!s.shown.length)return '';
    const lines=[`${clock(s.at)}까지 모은 자원: 나 ${num(s.own)} · 상대 ${num(s.opponent)}`];
    if(s.widest&&s.widest.gap!==0)lines.push(`가장 크게 벌어진 때: ${clock(s.widest.seconds)}, ${s.widest.gap>0?'내가':'상대가'} ${num(Math.abs(s.widest.gap))} 더 모음`);
    return `<section class="state-curve engine-income" data-section="engine-income"><h3 class="detail-heading">자원별 누적 수입 <small>경기 재현 · ${clock(s.until)}까지 확인됨${d.engine_version&&d.engine_version.research_commit?` · 엔진 ${esc(d.engine_version.research_commit)}`:''}</small></h3><ul class="state-lines">${lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul><div class="state-charts">${s.shown.map(([name,a,b])=>chart(d.points,a,b,name)).join('')}</div>${renderSources(d,timelines)}</section>`;
  }
  // APP-20: the section in a match without the engine data — the same blocks, each pointing at the reason above
  function renderEmpty(reason){
    const block=(id,title)=>`<div class="source-block${id==='animals'?' animal-block':''}" data-section="${id}"><h4>${esc(title)}</h4><p class="section-why">위와 같은 이유로 없어요.</p></div>`;
    return `<section class="state-curve engine-income" data-section="engine-income"><h3 class="detail-heading">자원별 누적 수입</h3><p class="section-why">${esc(reason)}</p><div class="income-sources">${block('food-sources','식량 출처')}${block('animals','동물별 먹은 양')}${block('gold-sources','금 출처')}</div></section>`;
  }
  const api={summary,render,renderEmpty,valid,sources,renderSources,started,animals,renderAnimals};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOEngineIncome=api;
})(typeof window==='undefined'?globalThis:window);
