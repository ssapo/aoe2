(function(global){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite=v=>Number.isFinite(v)&&v>=0;
  const clock=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const num=n=>Math.round(n).toLocaleString('ko-KR');
  const ages=['봉건','성주','왕정'],times=[300,600,900,1200,1500,1800];
  function quantile(values,q){
    const a=[...values].sort((a,b)=>a-b),at=(a.length-1)*q,lo=Math.floor(at);
    return a[lo]+(a[Math.ceil(at)]-a[lo])*(at-lo);
  }
  function stageAt(metrics,at){
    let stage='암흑',previous=0;
    for(const age of ages){
      const row=metrics?.age_checkpoints?.[age]||{},reached=row.reached_seconds,command=row.command_seconds??metrics?.age_commands?.[age];
      if(finite(reached)){if(reached<previous)return null;previous=reached;if(reached<=at)stage=age;}
      else if(finite(command)&&command<=at)return null;
    }
    return stage;
  }
  function tcBand(metrics,at){
    if(!Array.isArray(metrics?.full_timeline))return null;
    return metrics.full_timeline.some(e=>e.kind==='BUILD'&&e.label==='Town Center'&&finite(e.seconds)&&e.seconds<=at)?'expansion':'single';
  }
  function ownWindows(curve,duration,state){
    if(!state?.valid(curve))return [];
    const points=curve.points.map(p=>p.length===5?[p[0],p[1],p[3]]:p),end=Math.min(finite(duration)?duration:points.at(-1)[0],points.at(-1)[0]),rows=[];
    for(let start=300;start<end;start+=300){
      const from=Math.max(start,points[0][0]),stop=Math.min(start+300,end);
      if(stop-from<60)continue;
      const segments=points.slice(0,-1).filter((p,i)=>points[i+1][0]-p[0]<=30&&p[0]<stop&&points[i+1][0]>from);
      const covered=points.slice(0,-1).reduce((sum,p,i)=>sum+(points[i+1][0]-p[0]<=30?Math.max(0,Math.min(stop,points[i+1][0])-Math.max(from,p[0])):0),0);
      if(covered<(stop-from)*.9)continue;
      const own=state.stats(points,1,from,stop),opponent=state.stats(points,2,from,stop);
      if(own&&opponent)rows.push({start:from,end:stop,value:own.mean,peak:Math.max(...segments.map(p=>p[1])),opponent:opponent.mean});
    }
    return rows;
  }
  /* Maps that play alike. Used only when the same map has too few reference games; a map in no group gets no fallback.
     Arabia and Arabian Desert stay separate names (no evidence they are one map) but are both open land maps. */
  const MAP_GROUPS=[
    // 열린 맵: 벽 없이 시작하는 육지 맵. 닫힌 맵: 벽이나 숲으로 막혀 시작하는 맵. 물·유목·무작위·대회용 맵은 넣지 않는다.
    {id:'open',label:'열린 맵',maps:['Arabia','Arabian Desert','Atacama','Socotra','Steppe','Serengeti','Valley','valley.rms2','Acropolis','acropolis.rms2','Kilimanjaro','Runestones','Ghost Lake','Ghost_Lake','Golden Pit','goldenpit.rms2','Gold Rush','Land Madness','Lombardia','Mongolia']},
    {id:'closed',label:'닫힌 맵',maps:['Arena','Hideout','Enclosed','Fortress','Black Forest','Amazon Tunnel','Fortified Clearing','Michi']},
  ];
  const kindLabel=maps=>(MAP_GROUPS.find(g=>(maps||[]).some(m=>g.maps.includes(m)))||{label:'비슷한 맵'}).label;
  const MIN_MATCHES=5,MIN_PLAYERS=2;
  const groupOf=map=>MAP_GROUPS.find(g=>g.maps.includes(map))||null;
  /* {reference, shortage}: the narrowest set of games that still has enough of them.
     Place comes first (the same map, then its open/closed group), then the same civilization, then the same opening:
     map+civ+opening, map+civ, map+opening, map, then the same four inside the group.
     reference.tier is 'map' or 'group', reference.filters lists 'civ'/'opening' used, reference.maps the maps played (most games first). */
  function choose(source,context,pick){
    if(source?.schema_version!==1||!finite(source.min_rating)||source.min_rating<2000||!Array.isArray(source.samples))return {reference:null,shortage:null};
    const group=groupOf(context.map);
    const usable=source.samples.filter(s=>s&&s.match_id!==context.matchId&&s.profile_id!==context.profileId&&finite(s.rating)&&s.rating>=source.min_rating).map(s=>({sample:s,value:pick(s)})).filter(r=>finite(r.value));
    const same=usable.filter(r=>r.sample.map===context.map),grouped=group?usable.filter(r=>group.maps.includes(r.sample.map)):[];
    function aggregate(rows,filters,tier){
      const byPlayer=new Map();
      for(const r of [...rows].sort((a,b)=>String(b.sample.started_at).localeCompare(String(a.sample.started_at)))){
        const id=r.sample.profile_id,list=byPlayer.get(id)||[];
        if(list.length<10&&!list.some(e=>e.sample.match_id===r.sample.match_id))list.push(r);
        byPlayer.set(id,list);
      }
      const kept=[...byPlayer.values()].flat(),matches=new Set(kept.map(r=>r.sample.match_id)).size;
      if(matches<MIN_MATCHES||byPlayer.size<MIN_PLAYERS)return {matches,players:byPlayer.size,reference:null};
      const centers=[...byPlayer.values()].map(list=>quantile(list.map(r=>r.value),.5));
      const perMap=new Map();
      for(const r of kept){const set=perMap.get(r.sample.map)||new Set();set.add(r.sample.match_id);perMap.set(r.sample.map,set);}
      const maps=[...perMap.entries()].sort((a,b)=>b[1].size-a[1].size||String(a[0]).localeCompare(String(b[0]))).map(e=>e[0]);
      return {matches,players:byPlayer.size,reference:{median:Math.round(quantile(centers,.5)),q1:Math.round(quantile(centers,.25)),q3:Math.round(quantile(centers,.75)),
        n:kept.length,matches,players:byPlayer.size,sameCiv:filters.includes('civ'),filters,tier,group:tier==='group'?group.id:null,maps,
        civilization:filters.includes('civ')?context.civilization:null,
        names:[...byPlayer.values()].map(r=>r[0].sample.name),openingLabel:kept[0].sample.opening_label}};
    }
    const sets=[['civ','opening'],['civ'],['opening'],[]].filter(f=>(!f.includes('civ')||context.civilization)&&(!f.includes('opening')||context.opening));
    const narrow=(rows,f)=>rows.filter(r=>(!f.includes('civ')||r.sample.civilization===context.civilization)&&(!f.includes('opening')||r.sample.opening===context.opening));
    let sameAll=null,groupAll=null;
    for(const [tier,rows] of [['map',same],...(group?[['group',grouped]]:[])]){
      for(const f of sets){
        const result=aggregate(narrow(rows,f),f,tier);
        if(!f.length){if(tier==='map')sameAll=result;else groupAll=result;}
        if(result.reference)return {reference:result.reference,shortage:null};
      }
    }
    return {reference:null,shortage:{same:sameAll.matches,group:groupAll?groupAll.matches:null}};
  }
  const select=(source,context,pick)=>choose(source,context,pick).reference;
  const civName=civ=>(global.SSAPOCivNames&&global.SSAPOCivNames[civ])||civ;
  /* Which games a reference used, in plain words without the count: "열린 맵 · 프랑크 · 스카웃". */
  function where(reference){
    if(!reference||!['map','group'].includes(reference.tier))return '';
    const filters=reference.filters||(reference.sameCiv?['civ']:[]);
    return [reference.tier==='map'?'같은 맵':kindLabel(reference.maps),
      ...(filters.includes('civ')&&reference.civilization?[civName(reference.civilization)]:[]),
      ...(filters.includes('opening')&&reference.openingLabel?[reference.openingLabel]:[])].join(' · ');
  }
  /* Plain words for what a reference was built from; '' for a reference without that record. */
  function basis(reference){
    if(!reference||!finite(reference.matches))return '';
    const place=where(reference);
    return place?`${place} ${reference.matches}경기`:'';
  }
  function shortageText(result){
    const s=result?.shortage;
    if(!s||['resources','ages','villagers'].some(k=>result[k]?.length))return '';
    return `이 맵은 ${result.minRating||2000}점 이상 기준 경기가 부족해요(같은 맵 ${s.same}경기, ${s.group===null?'열린 맵·닫힌 맵 어느 쪽에도 안 넣은 맵':`같은 종류 맵 ${s.group}경기`}; ${MIN_MATCHES}경기·${MIN_PLAYERS}명 이상 필요)`;
  }
  /* Engine food by source at whole minutes inside the verified span (mirror of scripts/ranked_benchmarks.py food_sources).
     at[minute] = [sheep, hunt, berries, farm, rest]; left[minute] = food left on animals this side finished alone by then. */
  const FOOD_LIMIT=600,FOOD_FROM=240;
  function foodAt(engine,side=0){
    if(!engine||!finite(engine.verified_until_seconds)||!Array.isArray(engine.by_source?.points))return null;
    const until=engine.verified_until_seconds,start=side===0?1:10,rows=new Map();
    for(const p of engine.by_source.points)if(Array.isArray(p)&&p.length===19&&p.every(finite))rows.set(Math.round(p[0]*10)/10,p);
    const at={};
    for(let minute=60;minute<=FOOD_LIMIT;minute+=60){
      const p=rows.get(minute);if(minute>until||!p)continue;
      const f=p.slice(start,start+7);at[minute]=[f[0],f[1]+f[2],f[3],f[4],f[5]+f[6]].map(Math.round);
    }
    if(!Object.keys(at).length)return null;
    const out={until,at},animals=engine.animals;
    if(animals&&finite(animals.until_seconds)){
      const all=[...(animals.own||[]),...(animals.opponent||[])].filter(a=>a&&typeof a==='object'),mine=(animals[side===0?'own':'opponent']||[]).filter(a=>a&&typeof a==='object');
      if(all.some(a=>'full' in a)){
        const left={};
        for(let minute=60;minute<=Math.min(FOOD_LIMIT,until,animals.until_seconds);minute+=60)
          left[minute]=Math.round(mine.filter(a=>finite(a.full)&&finite(a.eaten)&&a.full>=a.eaten&&finite(a.last_seconds)&&a.last_seconds<=minute).reduce((sum,a)=>sum+a.full-a.eaten,0));
        if(Object.keys(left).length)out.left=left;
      }
    }
    return out;
  }
  const FOOD_NAMES=['가축','사냥','열매','농장'];
  /* Food shares and food left at one common time: the player's verified end clamped to 10:00, whole minutes;
     only pro games verified at least that long count. null when either side lacks the data. */
  function foodRows(analysis,context,source){
    const own=foodAt(analysis?.engine_income);
    if(!own)return null;
    const at=Math.floor(Math.min(own.until,FOOD_LIMIT)/60)*60,mine=own.at[at];
    if(at<FOOD_FROM||!mine)return null;
    const sum=list=>list.reduce((a,b)=>a+b,0),total=sum(mine);
    if(total<=0)return null;
    const sampleAt=s=>{const f=s?.food;return f&&finite(f.until)&&f.until>=at&&Array.isArray(f.at?.[at])&&f.at[at].length===5&&f.at[at].every(finite)?f.at[at]:null;};
    const rows=[];
    FOOD_NAMES.forEach((name,i)=>{
      const reference=choose(source,context,s=>{const v=sampleAt(s),t=v&&sum(v);return t>0?v[i]/t*100:null;}).reference,value=Math.round(mine[i]/total*100);
      if(reference&&(value>0||reference.median>0))rows.push({label:`${name} 비율`,value,reference,delta:value-reference.median,unit:'%'});
    });
    if(finite(own.left?.[at])){
      const reference=choose(source,context,s=>sampleAt(s)&&finite(s.food.left?.[at])?s.food.left[at]:null).reference;
      if(reference)rows.push({label:'남긴 식량',value:own.left[at],reference,delta:own.left[at]-reference.median,unit:'food',left:true});
    }
    return rows.length?{seconds:at,rows}:null;
  }
  function compare(match,profileId,source,state){
    const a=match?.analysis,m=a?.metrics,own=a?.review?.own;
    const result={resources:[],ages:[],villagers:[],food:null,ownResources:ownWindows(a?.state_curve,a?.duration_game_seconds,state),minRating:source?.min_rating||2000};
    if(!a||!own?.available||m?.recording_restored||source?.schema_version!==1)return result;
    const context={matchId:match.id,profileId,map:match.map,civilization:a.civilization,opening:own.opening};
    result.food=foodRows(a,context,source);
    const pickFrom=picker=>{
      const chosen=choose(source,context,picker),short=chosen.shortage;
      if(short&&(!result.shortage||short.same+(short.group||0)>result.shortage.same+(result.shortage.group||0)))result.shortage=short;
      return chosen.reference;
    };
    const add=(kind,label,value,reference,more={})=>{if(reference)result[kind].push({label,value,reference,delta:value-reference.median,...more});};
    for(const age of ages){
      const value=m.age_checkpoints?.[age]?.reached_seconds;
      if(finite(value))add('ages',`${age} 도달`,value,pickFrom(s=>s.ages?.[age]),{age});
    }
    const points=state?.valid(a.state_curve)?a.state_curve.points.map(p=>p.length===5?[p[0],p[1],p[3]]:p):null;
    for(const at of times){
      if(at>a.duration_game_seconds)continue;
      const band=tcBand(m,at),stage=stageAt(m,at),value=own.checkpoints?.find(p=>p.seconds===at)?.villager_requests;
      if(band&&stage&&finite(value))add('villagers',`${at/60}분 주민 요청`,value,pickFrom(s=>{
        const row=s.checkpoints?.[at]?.villagers;return row?.stage===stage&&row?.tc===band?row.value:null;
      }),{at});
      const resourceStage=stageAt(m,at-300),stats=points&&at>=600?state.stats(points,1,at-300,at):null;
      const covered=points?points.slice(0,-1).reduce((sum,p,i)=>sum+(points[i+1][0]-p[0]<=30?Math.max(0,Math.min(at,points[i+1][0])-Math.max(at-300,p[0])):0),0):0;
      if(band&&resourceStage&&stats&&covered>=270)add('resources',`${(at-300)/60}–${at/60}분 평균`,stats.mean,pickFrom(s=>{
        const row=s.checkpoints?.[at]?.resources;return row?.stage===resourceStage&&row?.tc===band?row.value:null;
      }),{at,start:at-300,end:at,peak:Math.max(...points.filter((p,i)=>i<points.length-1&&p[0]<at&&points[i+1][0]>at-300&&points[i+1][0]-p[0]<=30).map(p=>p[1]))});
    }
    return result;
  }
  /* Food comparison: a details table in the numbers tab, one or two short lines in the overview. */
  function foodGap(r){
    if(r.delta===0)return '같음';
    const n=Math.round(Math.abs(r.delta));
    return r.unit==='%'?`${n}%p ${r.delta>0?'높음':'낮음'}`:`${num(n)} ${r.delta>0?'많음':'적음'}`;
  }
  function renderFood(result,compact,basisNote){
    const f=result?.food;
    if(!f||!f.rows.length)return '';
    const value=(r,v)=>r.unit==='%'?`${Math.round(v)}%`:num(v),rating=result.minRating||2000;
    if(compact){
      const shares=f.rows.filter(r=>r.unit==='%'),widest=[...shares].sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))[0],left=f.rows.find(r=>r.left);
      return [widest,left].filter(Boolean).map(r=>`<p><span>${clock(f.seconds)} ${esc(r.label)} <b>${value(r,r.value)}</b></span><small>${rating}+ ${value(r,r.reference.median)} · ${foodGap(r)} · ${esc(basis(r.reference))}</small></p>`).join('');
    }
    const rows=f.rows.map(r=>`<tr><th scope="row">${esc(r.label)}</th><td>${value(r,r.value)}</td><td>${value(r,r.reference.median)}</td><td>${foodGap(r)}</td></tr>`).join('');
    return `<details class="ranked-details"><summary>식량 출처 비교 <small>${clock(f.seconds)} 시점</small></summary><div class="table-scroll"><table class="timeline comparison ranked-table"><thead><tr><th>항목</th><th>나</th><th>${rating}+</th><th>차이</th></tr></thead><tbody>${rows}</tbody></table></div>${basisNote(f.rows)}<p class="ranked-basis"><span>경기 재현으로 확인된 구간 안에서 ${clock(f.seconds)}까지 일꾼이 가져온 식량의 비율이에요. 남긴 식량은 다 먹고 떠난 양·사냥감에 남은 양이에요.</span></p></details>`;
  }
  function render(result,compact=false){
    const short=shortageText(result);
    if(!result||(!short&&!result.food&&!['resources','ages','villagers','ownResources'].some(k=>result[k]?.length)))return '';
    const based=r=>{const text=basis(r.reference);return text?` · ${esc(text)}`:'';};
    const gap=(r,time=false)=>{
      if(r.delta===0)return '같음';
      const seconds=Math.round(Math.abs(r.delta)),difference=time?(seconds>=60?clock(seconds):`${seconds}초`):num(Math.abs(r.delta));
      return `${difference} ${time?(r.delta>0?'늦음':'빠름'):(r.delta>0?'많음':'적음')}`;
    };
    // Keep the player's own resource window primary whether or not a benchmark exists.
    const ownHero=[...(result.ownResources||[])].sort((a,b)=>b.value-a.value||a.start-b.start)[0];
    const hero=ownHero||[...result.resources].sort((a,b)=>b.value-a.value||a.start-b.start)[0];
    const reference=hero&&result.resources.find(r=>r.start===hero.start&&r.end===hero.end);
    const heroHtml=hero?`<article class="ranked-resource resource-window"><header><div>${global.SSAPOStateCurve?.resourceIcons||''}<span>보유 자원 합계</span></div><time>${clock(hero.start)}–${clock(hero.end)}</time></header><dl class="resource-metrics"><div class="resource-primary"><dt>내 평균</dt><dd>${num(hero.value)}</dd></div><div><dt>최대 보유</dt><dd>${num(hero.peak)}</dd></div></dl>${finite(hero.opponent)?`<div class="resource-opponent-line"><span>같은 시간 상대 평균</span><strong>${num(hero.opponent)}</strong></div>`:''}${reference?`<p class="ranked-inline">${result.minRating}+ 중앙값 ${num(reference.reference.median)} · ${gap(reference)}${based(reference)}</p>`:''}</article>`:'';
    const row=(r,time=false)=>`<tr><th scope="row">${esc(r.label)}</th><td>${time?clock(r.value):num(r.value)}</td><td>${time?clock(r.reference.median):num(r.reference.median)}</td><td>${gap(r,time)}</td></tr>`;
    const basisNote=rows=>{
      const used=rows.filter(r=>basis(r.reference));
      if(!used.length)return '';
      const places=[...new Set(used.map(r=>where(r.reference)))],counts=used.map(r=>r.reference.matches),low=Math.min(...counts),high=Math.max(...counts);
      const text=places.length===1?`기준: ${result.minRating}점 이상 · ${places[0]} ${low===high?low:`${low}~${high}`}경기`:`기준(${result.minRating}점 이상) — ${used.map(r=>`${r.label}: ${basis(r.reference)}`).join(' / ')}`;
      return `<p class="ranked-basis">${esc(text)}${used.some(r=>r.reference.tier==='group')?' <span>같은 맵 기준 경기가 부족해서 같은 종류(열린 맵/닫힌 맵)끼리 비교했어요.</span>':''}</p>`;
    };
    const table=(rows,time)=>`<div class="table-scroll"><table class="timeline comparison ranked-table"><thead><tr><th>항목</th><th>나</th><th>${result.minRating}+</th><th>차이</th></tr></thead><tbody>${rows.map(r=>row(r,time)).join('')}</tbody></table></div>${basisNote(rows)}`;
    const age=result.ages.find(r=>r.age==='성주')||result.ages[0],villager=result.villagers.find(r=>r.at===900)||result.villagers[0];
    const quick=[age,villager].filter(Boolean).map(r=>{
      const time=result.ages.includes(r);
      return `<p><span>${esc(r.label)} <b>${time?clock(r.value):num(r.value)}</b></span><small>${result.minRating}+ ${time?clock(r.reference.median):num(r.reference.median)} · ${gap(r,time)}${based(r)}</small></p>`;
    }).join('');
    const food=renderFood(result,compact,basisNote);
    const details=compact?(quick||food?`<div class="ranked-quick">${quick}${food}</div>`:''):[['ages','시대업',true],['villagers','시간대별 주민',false],['resources','시간대별 자원',false]].filter(([key])=>result[key].length).map(([key,title,time])=>`<details class="ranked-details"><summary>${title} 비교</summary>${table(result[key],time)}</details>`).join('')+food;
    return `<section class="ranked-benchmarks"><div class="panel-toolbar"><h3 class="detail-heading">내 자원 흐름</h3>${compact?'<button class="subtle" data-open-panel="numbers">자세히 →</button>':''}</div>${heroHtml}${details}${short?`<p class="ranked-basis ranked-shortage">${esc(short)}</p>`:''}</section>`;
  }
  const api={select,choose,compare,render,stageAt,tcBand,basis,where,shortageText,groupOf,kindLabel,MAP_GROUPS,foodAt,foodRows,renderFood};
  if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPORankedBenchmarks=api;
})(typeof window==='undefined'?globalThis:window);
