/* 문명 매치업 및 전략 복기 (1단계): 게임 기술표·유닛 데이터(data/civ-reference.json)에서 계산한 사실만 보여준다.
   문명 보너스 문장은 게임 문자열(civilizations.json의 설명 문자열 id) 그대로이고, 여기서 새로 쓰지 않는다. */
(function(global){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const BUILDING_ORDER=[12,87,101,49,82,104];
  const GROUP_KO={blacksmith:'대장간',university:'대학',monastery:'수도원',economy:'경제',military:'군사 건물',dock:'부두'};
  // lines left out of the attack-bonus comparison: not fighting units, or fighting only buildings
  const NON_COMBAT=new Set([125,440,331,1105]);
  let data=null,loading=null;

  const has=(o,k)=>o!=null&&Object.prototype.hasOwnProperty.call(o,k);
  const node=(ref,kind,id)=>ref?.nodes?.[`${kind}${id}`]||null;
  const unitName=(ref,id)=>node(ref,'u',id)?.ko||node(ref,'u',id)?.name||`유닛 ${id}`;
  const techName=(ref,id)=>node(ref,'t',id)?.ko||node(ref,'t',id)?.name||`기술 ${id}`;
  const className=(ref,c)=>ref?.armor_classes?.[String(c)]||`방어 클래스 ${c}`;

  function lineStatus(civ,chain){
    const missing=new Set(civ?.missing_units||[]);
    const avail=chain.filter(id=>!missing.has(id));
    const final=avail.length?avail[avail.length-1]:null;
    return {root:chain[0],chain,final,top:chain[chain.length-1],missing:chain.filter(id=>missing.has(id)),
      status:!avail.length||missing.has(chain[0])?'none':avail.length===chain.length?'full':'partial'};
  }
  // bonus damage per hit that `attacker` deals to `defender` from attack classes beyond the base melee/pierce ones
  function bonusVs(ref,attacker,defender){
    const a=ref?.unit_stats?.[String(attacker)],d=ref?.unit_stats?.[String(defender)];
    if(!a?.bonus||!d?.armour_classes)return {total:0,parts:[]};
    const parts=[];
    for(const [cls,amount] of Object.entries(a.bonus)){
      if(!has(d.armour_classes,cls))continue;
      const value=Math.max(0,amount-d.armour_classes[cls]);
      if(value>0)parts.push({cls:Number(cls),amount:value});
    }
    const resist=Number(d.bonus_resist)||0,raw=parts.reduce((s,p)=>s+p.amount,0);
    return {total:Math.round(raw*(1-resist)*10)/10,parts:parts.sort((x,y)=>y.amount-x.amount)};
  }
  function linesOf(ref,civName){
    const civ=ref?.civs?.[civName];
    if(!civ)return [];
    return (civ.lines||[]).map(chain=>lineStatus(civ,chain));
  }
  function buildingOf(ref,id){return node(ref,'u',id)?.building??null;}
  function sortLines(ref,rows){
    const order=id=>{const b=buildingOf(ref,id),i=BUILDING_ORDER.indexOf(b);return i<0?99:i;};
    return rows.sort((x,y)=>order(x.root)-order(y.root));
  }
  function missingTechs(ref,civName,group){
    const ids=new Set(ref?.tech_groups?.[group]||[]),civ=ref?.civs?.[civName];
    return (civ?.missing_techs||[]).filter(t=>ids.has(node(ref,'t',t)?.building));
  }
  function fighters(lines){return lines.filter(l=>l.final!=null&&!NON_COMBAT.has(l.root)).map(l=>l.final);}
  // for each target unit of `defenders`, the attacker units with an attack bonus against it (best first)
  function counters(ref,attackers,defenders){
    const rows=[];
    for(const target of defenders){
      const hits=attackers.map(unit=>({unit,...bonusVs(ref,unit,target)})).filter(h=>h.total>0).sort((x,y)=>y.total-x.total);
      if(hits.length)rows.push({target,hits});
    }
    // siege workshop targets last: their large siege-vs-siege bonuses would otherwise push every army unit down
    const siege=id=>buildingOf(ref,id)===49?1:0;
    return rows.sort((x,y)=>siege(x.target)-siege(y.target)||y.hits[0].total-x.hits[0].total);
  }

  // castle unique lines and unique upgrades inside a common line (Imperial Skirmisher, Winged Hussar) only
  // ever belong to one civ, so they are left out of the side-by-side line comparison
  const isUniqueLine=(ref,root)=>node(ref,'u',root)?.type==='UniqueUnit'||buildingOf(ref,root)===82;
  const commonChain=(ref,chain)=>chain.filter(id=>node(ref,'u',id)?.type!=='UniqueUnit');
  function compare(ref,mine,theirs){
    if(!ref?.civs?.[mine]||!ref?.civs?.[theirs])return null;
    const sides=[mine,theirs].map(name=>({name,civ:ref.civs[name],lines:linesOf(ref,name)}));
    const byRoot=sides.map(s=>new Map(s.lines.filter(l=>!isUniqueLine(ref,l.root)).map(l=>[l.root,lineStatus(s.civ,commonChain(ref,l.chain))])));
    const roots=[...new Set(byRoot.flatMap(m=>[...m.keys()]))];
    const lines=sortLines(ref,roots.map(root=>{
      const a=byRoot[0].get(root)||{root,status:'none',final:null,missing:[],chain:[root]};
      const b=byRoot[1].get(root)||{root,status:'none',final:null,missing:[],chain:[root]};
      return {root,a,b,differs:a.final!==b.final};
    }));
    const edges=[0,1].map(i=>{
      const own=i===0?'a':'b',other=i===0?'b':'a',rows=[];
      for(const l of lines){
        const x=l[own],y=l[other];
        if(x.final==null||NON_COMBAT.has(l.root)&&y.final!=null)continue;
        if(y.final==null)rows.push({kind:'only',root:l.root,final:x.final});
        else if(x.final!==y.final&&x.chain.indexOf(x.final)>y.chain.indexOf(y.final))rows.push({kind:'further',root:l.root,final:x.final,otherFinal:y.final});
      }
      return rows;
    });
    const groups=Object.keys(ref.tech_groups||{});
    const techs=groups.map(g=>({group:g,a:missingTechs(ref,mine,g),b:missingTechs(ref,theirs,g)}));
    const units=sides.map(s=>fighters(s.lines));
    return {sides,lines,edges,techs,counters:[counters(ref,units[0],units[1]),counters(ref,units[1],units[0])]};
  }

  // ── summary card: four rows computed from the table by fixed rules (no hand-written advice) ──
  const CORE_LINES=[4,7,39,5,74,93,448,38,1258,280,279,36]; // lines most civs have; a missing one is a gap
  const KEY_TECHS=[435,39,437,436,93,47,215,602,315,377]; // Bloodlines, Husbandry, Thumb Ring, Parthian Tactics, Ballistics, Chemistry, Squires, Arson, Conscription, Siege Engineers
  const ATTR_KO={0:'체력',5:'이동 속도',8:'방어',9:'공격',10:'공격 속도',12:'사거리',100:'비용',101:'생산 속도',103:'비용',104:'비용',105:'비용',106:'비용'};
  function armyLines(ref,lines){return lines.filter(l=>l.final!=null&&!NON_COMBAT.has(l.root)&&buildingOf(ref,l.root)!==49);}
  const stat=(ref,id)=>ref?.unit_stats?.[String(id)]||null;
  const unitCost=(ref,id)=>Object.values(stat(ref,id)?.cost||{}).reduce((a,b)=>a+b,0)||1;
  const isRanged=(ref,id)=>(stat(ref,id)?.range||0)>=2;
  // damage per hit after armour (base melee/pierce plus class bonuses), at least 1 as in the game
  function hitDamage(ref,a,d){
    const A=stat(ref,a),D=stat(ref,d);
    if(!A||!D)return 1;
    const base=Math.max(0,(A.melee_attack||0)-(D.melee_armour||0))+Math.max(0,(A.pierce_attack||0)-(D.pierce_armour||0));
    return Math.max(1,base+bonusVs(ref,a,d).total);
  }
  // How a beats d in a 1-on-1 from the final units' base values (no blacksmith, civ bonus amounts or micro):
  // each side's time to kill the other = HP ÷ (damage per hit ÷ reload); a melee unit facing a ranged one first
  // walks across its range (range ÷ speed). ratio = (d's time to kill a) ÷ (a's time to kill d) × d's cost ÷ a's
  // cost, i.e. resource for resource; edge = log2(ratio), > 0 when a wins.
  function pair(ref,a,d){
    const A=stat(ref,a),D=stat(ref,d);
    if(!A||!D)return {edge:0,ratio:1,approach:0};
    const dealt=hitDamage(ref,a,d),taken=hitDamage(ref,d,a);
    let aKills=D.hp/(dealt/(A.reload||2)),dKills=A.hp/(taken/(D.reload||2)),approach=0;
    if(isRanged(ref,a)&&!isRanged(ref,d)){approach=A.range/(D.speed||1);dKills+=approach;}
    else if(isRanged(ref,d)&&!isRanged(ref,a)){approach=D.range/(A.speed||1);aKills+=approach;}
    const ratio=dKills/aKills*(unitCost(ref,d)/unitCost(ref,a));
    return {edge:Math.log2(ratio),ratio,dealt,taken,approach,aKills,dKills,bonus:bonusVs(ref,a,d)};
  }
  const isUniqueUnit=(ref,l)=>node(ref,'u',l.root)?.type==='UniqueUnit'||buildingOf(ref,l.root)===82;
  const boostOf=(ref,civ,id)=>ref?.civs?.[civ]?.boosts?.[String(id)]||null;
  // keep the first line of each unit class (DAT class: archer, cavalry, cavalry archer, …), then fill up
  function diverse(ref,rows,count){
    const out=[],seen=new Set();
    for(const r of rows){const c=stat(ref,r.unit)?.class;if(out.length<count&&!seen.has(c)){out.push(r);seen.add(c);}}
    for(const r of rows)if(out.length<count&&!out.includes(r))out.push(r);
    return out;
  }
  const sumPositive=values=>values.filter(v=>v>0).reduce((a,b)=>a+b,0);
  function summary(ref,mine,theirs){
    if(!ref?.civs?.[mine]||!ref?.civs?.[theirs])return null;
    const myArmy=armyLines(ref,linesOf(ref,mine)),theirArmy=armyLines(ref,linesOf(ref,theirs));
    // my main lines: unique, fully upgraded or boosted by my civ
    const mainLines=myArmy.filter(l=>isUniqueUnit(ref,l)||l.status==='full'||boostOf(ref,mine,l.final));
    const main=mainLines.length?mainLines:myArmy;
    // threat candidates: their unique units and lines their civ boosts; fully upgraded lines only if fewer than three
    let pool=theirArmy.filter(l=>isUniqueUnit(ref,l)||boostOf(ref,theirs,l.final));
    if(pool.length<3)pool=pool.concat(theirArmy.filter(l=>l.status==='full'&&!pool.includes(l)));
    const threatRows=pool.map(l=>{
      const vs=main.map(m=>({target:m.final,...pair(ref,l.final,m.final)})).sort((x,y)=>y.edge-x.edge);
      return {unit:l.final,root:l.root,unique:isUniqueUnit(ref,l),boost:boostOf(ref,theirs,l.final),vs,score:sumPositive(vs.map(v=>v.edge))};
    }).sort((x,y)=>Number(y.score>=0.5)-Number(x.score>=0.5)||(y.score>=0.5?y.score-x.score:0)||Number(y.unique)-Number(x.unique)||(y.boost?.attrs.length||0)-(x.boost?.attrs.length||0));
    const threats=diverse(ref,threatRows,3);
    const T=threats.map(t=>t.unit);
    // the opponent's strongest answer to one of my units, over all their army lines
    const answer=id=>theirArmy.map(o=>({line:o,...pair(ref,o.final,id)})).sort((x,y)=>y.edge-x.edge)[0]||null;
    // avoid: my main lines the threats beat together, that beat none of them and that the opponent can answer
    const avoidRows=main.map(m=>{
      const by=T.map(u=>({unit:u,...pair(ref,u,m.final)})).filter(p=>p.edge>0).sort((x,y)=>y.edge-x.edge);
      const hitsBack=T.some(u=>pair(ref,m.final,u).edge>0.5);
      return {unit:m.final,root:m.root,by,score:sumPositive(by.map(p=>p.edge)),hitsBack,answer:answer(m.final)};
    }).filter(a=>a.score>=1&&!a.hitsBack&&a.answer&&a.answer.edge>=0.5).sort((x,y)=>y.score-x.score);
    const avoid=diverse(ref,avoidRows,2);
    const avoided=new Set(avoid.map(a=>a.root));
    // recommend: my lines that beat at least one threat, fully upgraded first, then how well they beat the threats
    // minus how well the opponent can answer them (a missing counter upgrade on their side helps)
    const recommend=myArmy.filter(m=>!avoided.has(m.root)).map(m=>{
      const vs=T.map(u=>({target:u,...pair(ref,m.final,u)})).sort((x,y)=>y.edge-x.edge);
      const neg=vs.filter(v=>v.edge<0).reduce((a,v)=>a+v.edge,0),ans=answer(m.final);
      return {unit:m.final,root:m.root,full:m.status==='full',vs,beats:sumPositive(vs.map(v=>v.edge)),answer:ans,score:sumPositive(vs.map(v=>v.edge))+neg/2-Math.max(0,ans?.edge||0)/2};
    }).filter(r=>r.beats>=0.5).sort((x,y)=>Number(y.full)-Number(x.full)||y.score-x.score).slice(0,3);
    // gaps: their missing core lines, missing final upgrades, missing key techs
    const theirLines=new Map(linesOf(ref,theirs).map(l=>[l.root,l]));
    const missingLines=CORE_LINES.filter(r=>!theirLines.has(r)||theirLines.get(r).status==='none');
    const missingTops=[...theirLines.values()].filter(l=>l.status==='partial'&&!NON_COMBAT.has(l.root)).map(l=>l.top);
    const missingKey=KEY_TECHS.filter(t=>(ref.civs[theirs].missing_techs||[]).includes(t));
    const smith=missingTechs(ref,theirs,'blacksmith').filter(t=>!missingKey.includes(t));
    return {threats,avoid,recommend,gaps:{lines:missingLines,tops:missingTops,techs:[...missingKey,...smith]}};
  }
  const parts=(ref,h)=>h.parts.map(p=>`${className(ref,p.cls)} ${p.amount}`).join(', ');
  const civLabel=(ref,name)=>(global.SSAPOCivNames&&global.SSAPOCivNames[name])||ref?.civs?.[name]?.name_ko||name;
  const iconSrc=(ref,kind,id)=>{const n=node(ref,kind,id);return n?.icon!=null?`assets/${kind==='u'?'units':'techs'}/${n.icon}.png`:null;};
  function statsLine(ref,id){
    const s=ref?.unit_stats?.[String(id)];
    if(!s)return '';
    const attack=s.pierce_attack>s.melee_attack?`원거리 공격 ${s.pierce_attack}`:`근접 공격 ${s.melee_attack}`;
    return `체력 ${s.hp} · ${attack} · 방어 ${s.melee_armour}/${s.pierce_armour}`;
  }
  // One unit or tech as an icon; its name and evidence are in the tooltip (data-tip, shown on hover or tap).
  // label: the short name next to the icon (summary card); crossed: the civ lacks it.
  function icon(ref,kind,id,opts={}){
    const name=kind==='u'?unitName(ref,id):techName(ref,id),tip=opts.tip||name,src=iconSrc(ref,kind,id);
    return `<span class="mu${opts.crossed?' mu-x':''}" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}">`
      +(src?`<img src="${src}" alt="" loading="lazy">`:`<span class="mu-fallback">${esc(name.slice(0,2))}</span>`)
      +(opts.label?`<span class="mu-label">${esc(name)}</span>`:'')+'</span>';
  }
  const times=edge=>{const r=Math.pow(2,edge);return r>=10?"10+":r.toFixed(1);};
  const pairFigure=p=>`×${times(p.edge)}`;
  const sec=v=>`${Math.round(v*10)/10}초`;
  function pairTip(ref,a,d,p){
    return `${unitName(ref,a)} → ${unitName(ref,d)}
타격당 피해 ${Math.round(p.dealt*10)/10}${p.bonus.parts.length?` (보너스 ${parts(ref,p.bonus)})`:''} · 받는 피해 ${Math.round(p.taken*10)/10}`
      +`
1:1 처치 시간 ${sec(p.aKills)} vs ${sec(p.dKills)}${p.approach?` (접근 ${sec(p.approach)} 포함)`:''}
비용 ${unitCost(ref,a)} vs ${unitCost(ref,d)} → 같은 자원 기준 ×${times(p.edge)}`;
  }
  // "→ [target icon] ×2.6" (or "← [attacker icon] ×2.6"), evidence in the tooltip
  function relation(ref,attacker,target,p,arrow){
    const tip=pairTip(ref,attacker,target,p);
    const src=iconSrc(ref,'u',arrow==='←'?attacker:target);
    return `<span class="mc-rel" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}">${arrow}${src?`<img src="${src}" alt="" loading="lazy">`:''}<b>${esc(pairFigure(p))}</b></span>`;
  }
  function unitTip(ref,id,rows,extra){
    const out=[unitName(ref,id),statsLine(ref,id)];
    for(const r of rows||[])if(r.edge>0)out.push(`→ ${unitName(ref,r.target)} ${pairFigure(r)}`);
    return out.concat(extra||[]).filter(Boolean).join('\n');
  }
  const boostText=b=>b?`문명 보너스: ${[...new Set(b.attrs.map(a=>ATTR_KO[a]).filter(Boolean))].join('·')}${b.sources.includes('unique')?' (고유 기술 포함)':''}`:'';
  function answerText(ref,ans){
    if(!ans)return '';
    const line=ans.line,missing=line.status==='partial'?` — 상대 ${unitName(ref,line.top)} 없음`:'';
    return `상대의 가장 강한 대응: ${unitName(ref,line.final)} ${ans.edge>0?pairFigure(ans):'(불리)'}${missing}`;
  }
  function cardRow(cls,mark,title,body){
    return `<div class="mc-row ${cls}"><span class="mc-icon" aria-hidden="true">${mark}</span><div class="mc-body"><span class="mc-title">${esc(title)}</span>${body}</div></div>`;
  }
  const chips=items=>`<div class="mc-chips">${items.join('')}</div>`;
  function cardHtml(ref,mine,theirs){
    const s=summary(ref,mine,theirs);
    if(!s)return '';
    const none=text=>`<span class="mc-none">${esc(text)}</span>`;
    const avoid=s.avoid.length?chips(s.avoid.map(a=>`<span class="mc-chip">${icon(ref,'u',a.unit,{label:true,tip:[`${unitName(ref,a.unit)} 단독`,...a.by.map(p=>`← ${unitName(ref,p.unit)} ${pairFigure(p)}`),answerText(ref,a.answer)].join('\n')})}${relation(ref,a.by[0].unit,a.unit,a.by[0],'←')}</span>`)):none('상대 핵심 병종이 함께 앞서는 내 계열 없음');
    const threats=s.threats.length?chips(s.threats.map(t=>{
      const best=t.vs[0],tip=unitTip(ref,t.unit,t.vs,[t.unique?'고유 유닛':'',boostText(t.boost)]);
      const tail=best&&best.edge>0?relation(ref,t.unit,best.target,best,'→'):`<span class="mc-rel-text">${esc(t.unique?'고유 유닛':boostText(t.boost))}</span>`;
      return `<span class="mc-chip">${icon(ref,'u',t.unit,{label:true,tip})}${tail}</span>`;
    })):none('뚜렷한 것 없음');
    const recommend=s.recommend.length?chips(s.recommend.map(r=>`<span class="mc-chip">${icon(ref,'u',r.unit,{label:true,tip:unitTip(ref,r.unit,r.vs,[r.full?'':'(최종 업그레이드 아님)',answerText(ref,r.answer)])})}${relation(ref,r.unit,r.vs[0].target,r.vs[0],'→')}</span>`)):none('상대 핵심 병종에 앞서는 계열 없음');
    const g=s.gaps;
    const gapIcons=[...g.lines.map(r=>icon(ref,'u',r,{crossed:true,tip:`${unitName(ref,r)} 계열 없음`})),...g.tops.map(id=>icon(ref,'u',id,{crossed:true,tip:`${unitName(ref,id)} 없음`})),...g.techs.map(t=>icon(ref,'t',t,{crossed:true,tip:`${techName(ref,t)} 없음`}))];
    return `<div class="matchup-card"><div class="mc-head"><span class="mc-kicker">MATCHUP · ${esc(civLabel(ref,mine))}</span><strong class="mc-vs">VS ${esc(civLabel(ref,theirs))}</strong></div>`
      +cardRow('mc-avoid','!','피해야 할 단독 병력',avoid)
      +cardRow('mc-threat','▲','상대 핵심 위협',threats)
      +cardRow('mc-counter','✓','추천 대응',recommend)
      +cardRow('mc-gap','i','상대 기술적 빈틈',gapIcons.length?`<div class="mc-icons">${gapIcons.join('')}</div>`:none('주요 계열·기술 결손 없음'))
      +'<p class="mc-note">×숫자 = 같은 자원으로 싸울 때 기본 수치상 유리한 정도(1:1 처치 시간 × 비용, 원거리 상대는 다가가는 시간 포함). 각 계열 최종 유닛 기본값 — 대장간·문명 보너스 수치·컨트롤 제외. 아이콘을 누르면 근거.</p></div>';
  }
  function chainCell(ref,l){
    if(l.final==null)return '<span class="matchup-none">—</span>';
    return `<span class="mu-chain">${l.chain.map(id=>icon(ref,'u',id,{crossed:l.missing.includes(id),tip:l.missing.includes(id)?`${unitName(ref,id)} 없음`:unitName(ref,id)})).join('')}</span>`;
  }
  function counterTable(ref,rows,targetTitle,attackerTitle){
    if(!rows.length)return '<p class="compact-note">공격 보너스가 있는 조합 없음</p>';
    const cell=(target,h)=>`<span class="mu-hit">${icon(ref,'u',h.unit,{tip:`${unitName(ref,h.unit)} → ${unitName(ref,target)}\n타격당 보너스 +${h.total} (${parts(ref,h)})`})}<b>+${h.total}</b></span>`;
    return `<div class="table-scroll"><table class="timeline matchup-table matchup-grid"><thead><tr><th scope="col">${esc(targetTitle)}</th><th scope="col">${esc(attackerTitle)}</th></tr></thead><tbody>`
      +rows.map(r=>`<tr><th scope="row">${icon(ref,'u',r.target,{tip:unitTip(ref,r.target)})}</th><td>${r.hits.map(h=>cell(r.target,h)).join('')}</td></tr>`).join('')+'</tbody></table></div>';
  }
  function html(ref,mine,theirs){
    const title='<div class="summary-label"><span id="civ-matchup-title">문명 매치업 및 전략 복기</span>'+(ref?.game_build?`<small>게임 빌드 ${esc(ref.game_build)} 기술표·유닛 데이터</small>`:'')+'</div>';
    const cmp=compare(ref,mine,theirs);
    if(!cmp){
      const lacking=[mine,theirs].filter(c=>!ref?.civs?.[c]).map(c=>civLabel(ref,c)||'문명 확인 전');
      return `<section class="civ-matchup" aria-labelledby="civ-matchup-title">${title}<p class="compact-note">${ref?`${esc(lacking.join(', '))}: 1v1 랭크 문명 기술표에 없는 문명이라 비교하지 않아요.`:'문명 기술표를 불러오지 못했어요.'}</p></section>`;
    }
    const names=[civLabel(ref,mine),civLabel(ref,theirs)];
    const head=`<thead><tr><th scope="col"></th><th scope="col">나 · ${esc(names[0])}</th><th scope="col">상대 · ${esc(names[1])}</th></tr></thead>`;
    const diff=cmp.lines.filter(l=>l.differs&&(l.a.final!=null||l.b.final!=null));
    const lineRows=diff.map(l=>`<tr><td>${chainCell(ref,l.a)}</td><td>${chainCell(ref,l.b)}</td></tr>`).join('');
    const lineHead=`<thead><tr><th scope="col">나 · ${esc(names[0])}</th><th scope="col">상대 · ${esc(names[1])}</th></tr></thead>`;
    const techRows=cmp.techs.filter(t=>t.group!=='dock'&&(t.a.length||t.b.length)).map(t=>`<tr><th scope="row">${esc(GROUP_KO[t.group]||t.group)}</th>${[t.a,t.b].map(ids=>`<td>${ids.length?`<span class="mu-chain">${ids.map(id=>icon(ref,'t',id,{crossed:true,tip:`${techName(ref,id)} 없음`})).join('')}</span>`:'<span class="matchup-none">—</span>'}</td>`).join('')}</tr>`).join('');
    const bonus=cmp.sides.map((s,i)=>`<section class="matchup-bonus-side"><b>${i?'상대':'나'} · ${esc(names[i])}</b>${(s.civ.description||[]).map(r=>r.startsWith('#')?`<b>${esc(r.slice(1))}</b>`:`<span>${esc(r)}</span>`).join('')}</section>`).join('');
    return `<section class="civ-matchup" aria-labelledby="civ-matchup-title">${title}${cardHtml(ref,mine,theirs)}`
      +`<details class="matchup-more"><summary>자세히 — 계열·기술 비교, 상성 수치, 문명 보너스</summary>`
      +`<h4 class="matchup-heading">병종 계열이 다른 곳 <small>흐린 ✕ = 없음</small></h4>${lineRows?`<div class="table-scroll"><table class="timeline matchup-table matchup-grid matchup-lines">${lineHead}<tbody>${lineRows}</tbody></table></div>`:'<p class="compact-note">공통 병종 계열은 양측 같음</p>'}`
      +`<h4 class="matchup-heading">기술 결손</h4>${techRows?`<div class="table-scroll"><table class="timeline matchup-table matchup-grid">${head}<tbody>${techRows}</tbody></table></div>`:'<p class="compact-note">양측 결손 없음</p>'}`
      +`<h4 class="matchup-heading">상대 병종 ← 공격 보너스를 갖는 내 병종</h4>${counterTable(ref,cmp.counters[0],`상대 · ${names[1]}`,`나 · ${names[0]} (타격당)`)}`
      +`<h4 class="matchup-heading">내 병종 ← 공격 보너스를 갖는 상대 병종</h4>${counterTable(ref,cmp.counters[1],`나 · ${names[0]}`,`상대 · ${names[1]} (타격당)`)}`
      +`<details class="matchup-bonus"><summary>문명 보너스 (게임 문구)</summary><div class="matchup-bonus-grid">${bonus}</div></details>`
      +`<p class="compact-note">각 계열의 최종 유닛끼리 방어 클래스별 공격 보너스(공격 − 상대 클래스 방어, 0 미만은 0)만 더한 값이에요. 기본 공격·방어·체력·비용, 대장간·문명 보너스는 넣지 않았고, 이 경기에서 실제로 만든 병종(생산 명령이지 완료가 아님)과의 비교는 아직 하지 않아요.</p></details></section>`;
  }

  // tooltip for [data-tip] inside the section: hover with a mouse, tap on a phone, focus with a keyboard
  function installTips(){
    if(typeof document==='undefined')return;
    let box=null,anchor=null,pinned=false;
    const hide=()=>{if(box){box.remove();box=null;anchor=null;pinned=false;}};
    const show=el=>{
      if(anchor===el)return;
      hide();
      box=document.createElement('div');box.className='mu-tip';box.setAttribute('role','tooltip');box.textContent=el.dataset.tip;
      (el.closest('dialog')||document.body).appendChild(box);
      const r=el.getBoundingClientRect();
      box.style.maxWidth=Math.min(260,window.innerWidth-16)+'px';
      const bw=box.offsetWidth,h=box.offsetHeight,left=Math.max(8,Math.min(r.left+r.width/2-bw/2,window.innerWidth-bw-8));
      const top=r.bottom+6+h>window.innerHeight-8&&r.top-6-h>8?r.top-6-h:r.bottom+6;
      box.style.left=left+'px';box.style.top=Math.max(8,top)+'px';anchor=el;
    };
    const tipOf=t=>t instanceof Element?t.closest('.civ-matchup [data-tip]'):null;
    // a click pins the tip (a tap also fires mouseover first); a second click on a pinned tip closes it
    document.addEventListener('click',e=>{const el=tipOf(e.target);if(el){if(anchor===el&&pinned)hide();else{show(el);pinned=true;}}else if(box)hide();});
    if(typeof window.matchMedia==='function'&&window.matchMedia('(hover: hover)').matches){
      document.addEventListener('mouseover',e=>{const el=tipOf(e.target);if(el)show(el);});
      document.addEventListener('mouseout',e=>{if(anchor&&!pinned&&tipOf(e.target)===anchor&&!anchor.contains(e.relatedTarget))hide();});
    }
    document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
    window.addEventListener('scroll',hide,true);
    window.addEventListener('resize',hide);
  }

  function load(fetchImpl){
    if(data)return Promise.resolve(data);
    if(loading)return loading;
    const f=fetchImpl||(typeof fetch==='function'?fetch:null);
    if(!f)return Promise.resolve(null);
    // revalidate: the table is regenerated after each game patch under the same name
    loading=f('data/civ-reference.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{data=j?.schema_version===1?j:null;return data;}).catch(()=>null).finally(()=>{loading=null;});
    return loading;
  }
  // HTML now if the table is loaded; otherwise a placeholder that is filled once it loads
  function mount(mine,theirs){
    if(data)return html(data,mine,theirs);
    load().then(ref=>{
      if(typeof document==='undefined')return;
      document.querySelectorAll('[data-civ-matchup]').forEach(el=>{
        const [a,b]=JSON.parse(el.dataset.civMatchup||'[]');
        el.outerHTML=html(ref,a,b);
      });
    });
    return `<section class="civ-matchup" data-civ-matchup="${esc(JSON.stringify([mine,theirs]))}"><div class="summary-label"><span>문명 매치업 및 전략 복기</span></div><p class="compact-note">문명 기술표를 불러오는 중…</p></section>`;
  }
  const api={lineStatus,bonusVs,pair,compare,summary,html,mount,load};
  if(typeof module==='object'&&module.exports)module.exports=api;else{global.SSAPOCivMatchup=api;installTips();}
})(typeof window==='undefined'?globalThis:window);
