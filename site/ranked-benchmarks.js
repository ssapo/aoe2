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
  function select(source,context,pick){
    if(source?.schema_version!==1||!finite(source.min_rating)||source.min_rating<2000||!Array.isArray(source.samples))return null;
    const candidates=source.samples.filter(s=>s&&s.match_id!==context.matchId&&s.profile_id!==context.profileId&&s.map===context.map&&finite(s.rating)&&s.rating>=source.min_rating).map(s=>({sample:s,value:pick(s)})).filter(r=>finite(r.value));
    function aggregate(rows,sameCiv){
      const byPlayer=new Map();
      for(const r of rows.sort((a,b)=>String(b.sample.started_at).localeCompare(String(a.sample.started_at)))){
        const id=r.sample.profile_id,list=byPlayer.get(id)||[];
        if(list.length<10&&!list.some(e=>e.sample.match_id===r.sample.match_id))list.push(r);
        byPlayer.set(id,list);
      }
      const kept=[...byPlayer.values()].flat(),matches=new Set(kept.map(r=>r.sample.match_id)).size;
      if(matches<5||byPlayer.size<2)return null;
      const centers=[...byPlayer.values()].map(list=>quantile(list.map(r=>r.value),.5));
      return {median:Math.round(quantile(centers,.5)),q1:Math.round(quantile(centers,.25)),q3:Math.round(quantile(centers,.75)),
        n:kept.length,matches,players:byPlayer.size,sameCiv,names:[...byPlayer.values()].map(r=>r[0].sample.name),openingLabel:kept[0].sample.opening_label};
    }
    return aggregate(candidates.filter(r=>r.sample.civilization===context.civilization),true)||aggregate(candidates,false);
  }
  function compare(match,profileId,source,state){
    const a=match?.analysis,m=a?.metrics,own=a?.review?.own;
    const result={resources:[],ages:[],villagers:[],ownResources:ownWindows(a?.state_curve,a?.duration_game_seconds,state),minRating:source?.min_rating||2000};
    if(!a||!own?.available||m?.recording_restored||source?.schema_version!==1)return result;
    const context={matchId:match.id,profileId,map:match.map,civilization:a.civilization,opening:own.opening};
    const add=(kind,label,value,reference,more={})=>{if(reference)result[kind].push({label,value,reference,delta:value-reference.median,...more});};
    for(const age of ages){
      const value=m.age_checkpoints?.[age]?.reached_seconds;
      if(finite(value))add('ages',`${age} 도달`,value,select(source,context,s=>s.ages?.[age]),{age});
    }
    const points=state?.valid(a.state_curve)?a.state_curve.points.map(p=>p.length===5?[p[0],p[1],p[3]]:p):null;
    for(const at of times){
      if(at>a.duration_game_seconds)continue;
      const band=tcBand(m,at),stage=stageAt(m,at),value=own.checkpoints?.find(p=>p.seconds===at)?.villager_requests;
      if(band&&stage&&finite(value))add('villagers',`${at/60}분 주민 요청`,value,select(source,context,s=>{
        const row=s.checkpoints?.[at]?.villagers;return row?.stage===stage&&row?.tc===band?row.value:null;
      }),{at});
      const resourceStage=stageAt(m,at-300),stats=points&&at>=600?state.stats(points,1,at-300,at):null;
      const covered=points?points.slice(0,-1).reduce((sum,p,i)=>sum+(points[i+1][0]-p[0]<=30?Math.max(0,Math.min(at,points[i+1][0])-Math.max(at-300,p[0])):0),0):0;
      if(band&&resourceStage&&stats&&covered>=270)add('resources',`${(at-300)/60}–${at/60}분 평균`,stats.mean,select(source,context,s=>{
        const row=s.checkpoints?.[at]?.resources;return row?.stage===resourceStage&&row?.tc===band?row.value:null;
      }),{at,start:at-300,end:at,peak:Math.max(...points.filter((p,i)=>i<points.length-1&&p[0]<at&&points[i+1][0]>at-300&&points[i+1][0]-p[0]<=30).map(p=>p[1]))});
    }
    return result;
  }
  function render(result,compact=false){
    if(!result||!['resources','ages','villagers','ownResources'].some(k=>result[k]?.length))return '';
    const gap=(r,time=false)=>{
      if(r.delta===0)return '같음';
      const seconds=Math.round(Math.abs(r.delta)),difference=time?(seconds>=60?clock(seconds):`${seconds}초`):num(Math.abs(r.delta));
      return `${difference} ${time?(r.delta>0?'늦음':'빠름'):(r.delta>0?'많음':'적음')}`;
    };
    // Keep the player's own resource window primary whether or not a benchmark exists.
    const ownHero=[...(result.ownResources||[])].sort((a,b)=>b.value-a.value||a.start-b.start)[0];
    const hero=ownHero||[...result.resources].sort((a,b)=>b.value-a.value||a.start-b.start)[0];
    const reference=hero&&result.resources.find(r=>r.start===hero.start&&r.end===hero.end);
    const heroHtml=hero?`<article class="ranked-resource resource-window"><header><div>${global.SSAPOStateCurve?.resourceIcons||''}<span>보유 자원 합계</span></div><time>${clock(hero.start)}–${clock(hero.end)}</time></header><dl class="resource-metrics"><div class="resource-primary"><dt>내 평균</dt><dd>${num(hero.value)}</dd></div><div><dt>최대 보유</dt><dd>${num(hero.peak)}</dd></div></dl>${finite(hero.opponent)?`<div class="resource-opponent-line"><span>같은 시간 상대 평균</span><strong>${num(hero.opponent)}</strong></div>`:''}${reference?`<p class="ranked-inline">${result.minRating}+ 중앙값 ${num(reference.reference.median)} · ${gap(reference)}</p>`:''}</article>`:'';
    const row=(r,time=false)=>`<tr><th scope="row">${esc(r.label)}</th><td>${time?clock(r.value):num(r.value)}</td><td>${time?clock(r.reference.median):num(r.reference.median)}</td><td>${gap(r,time)}</td></tr>`;
    const table=(rows,time)=>`<div class="table-scroll"><table class="timeline comparison ranked-table"><thead><tr><th>항목</th><th>나</th><th>${result.minRating}+</th><th>차이</th></tr></thead><tbody>${rows.map(r=>row(r,time)).join('')}</tbody></table></div>`;
    const age=result.ages.find(r=>r.age==='성주')||result.ages[0],villager=result.villagers.find(r=>r.at===900)||result.villagers[0];
    const quick=[age,villager].filter(Boolean).map(r=>{
      const time=result.ages.includes(r);
      return `<p><span>${esc(r.label)} <b>${time?clock(r.value):num(r.value)}</b></span><small>${result.minRating}+ ${time?clock(r.reference.median):num(r.reference.median)} · ${gap(r,time)}</small></p>`;
    }).join('');
    const details=compact?(quick?`<div class="ranked-quick">${quick}</div>`:''):[['ages','시대업',true],['villagers','시간대별 주민',false],['resources','시간대별 자원',false]].filter(([key])=>result[key].length).map(([key,title,time])=>`<details class="ranked-details"><summary>${title} 비교</summary>${table(result[key],time)}</details>`).join('');
    return `<section class="ranked-benchmarks"><div class="panel-toolbar"><h3 class="detail-heading">내 자원 흐름</h3>${compact?'<button class="subtle" data-open-panel="numbers">자세히 →</button>':''}</div>${heroHtml}${details}</section>`;
  }
  const api={select,compare,render,stageAt,tcBand};
  if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPORankedBenchmarks=api;
})(typeof window==='undefined'?globalThis:window);
