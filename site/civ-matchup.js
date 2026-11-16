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
  const SPECIAL_ROOTS=new Set([5]); // gunpowder line counts as a special force
  function armyLines(ref,lines){return lines.filter(l=>l.final!=null&&!NON_COMBAT.has(l.root)&&buildingOf(ref,l.root)!==49);}
  function isSpecial(ref,l){const t=node(ref,'u',l.root)?.type;return t==='UniqueUnit'||t==='RegionalUnit'||buildingOf(ref,l.root)===82||SPECIAL_ROOTS.has(l.root);}
  function summary(ref,mine,theirs){
    if(!ref?.civs?.[mine]||!ref?.civs?.[theirs])return null;
    const myArmy=armyLines(ref,linesOf(ref,mine)),theirArmy=armyLines(ref,linesOf(ref,theirs));
    const full=myArmy.filter(l=>l.status==='full'),main=full.length?full:myArmy;
    // threats: their unique/special/fully upgraded lines, by the biggest bonus against one of my main lines
    const threats=theirArmy.filter(l=>isSpecial(ref,l)||l.status==='full').map(l=>{
      const hits=main.map(m=>({target:m.final,...bonusVs(ref,l.final,m.final)})).filter(h=>h.total>0).sort((x,y)=>y.total-x.total);
      return {unit:l.final,root:l.root,special:isSpecial(ref,l),hits};
    }).filter(t=>t.hits.length).sort((x,y)=>y.hits[0].total-x.hits[0].total||Number(y.special)-Number(x.special)).slice(0,3);
    // fewer than three: add their castle unique units by their base stats
    for(const l of theirArmy){
      if(threats.length>=3)break;
      if(buildingOf(ref,l.root)===82&&!threats.some(t=>t.root===l.root))threats.push({unit:l.final,root:l.root,special:true,hits:[]});
    }
    const threatUnits=threats.map(t=>t.unit);
    // avoid: my main lines the threats hit harder than those lines hit back
    const avoid=main.map(m=>{
      const by=threatUnits.map(u=>({unit:u,...bonusVs(ref,u,m.final)})).filter(h=>h.total>0).sort((x,y)=>y.total-x.total);
      const dealt=Math.max(0,...threatUnits.map(u=>bonusVs(ref,m.final,u).total));
      return {unit:m.final,root:m.root,by,worst:by[0]?.total||0,dealt};
    }).filter(a=>a.worst>a.dealt).sort((x,y)=>y.worst-x.worst).slice(0,2);
    // recommend: my lines with the biggest bonus against the threats, fully upgraded first
    const recommend=myArmy.map(m=>{
      const vs=threatUnits.map(u=>({target:u,...bonusVs(ref,m.final,u)})).filter(h=>h.total>0).sort((x,y)=>y.total-x.total);
      return {unit:m.final,root:m.root,full:m.status==='full',vs,score:vs.reduce((s,h)=>s+h.total,0)};
    }).filter(r=>r.score>0).sort((x,y)=>Number(y.full)-Number(x.full)||y.score-x.score).slice(0,3);
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
  // "→ [target icon] +18" (or "← [attacker icon] +18"): one attack bonus, its classes in the tooltip
  function relation(ref,attacker,target,hit,arrow){
    const tip=`${unitName(ref,attacker)} → ${unitName(ref,target)}\n타격당 보너스 +${hit.total} (${parts(ref,hit)})`;
    const src=iconSrc(ref,'u',arrow==='←'?attacker:target);
    return `<span class="mc-rel" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}">${arrow}${src?`<img src="${src}" alt="" loading="lazy">`:''}<b>+${hit.total}</b></span>`;
  }
  function unitTip(ref,id,hits){
    const rows=[unitName(ref,id),statsLine(ref,id)];
    if(hits?.length)rows.push(...hits.map(h=>`→ ${unitName(ref,h.target)} +${h.total} (${parts(ref,h)})`));
    return rows.filter(Boolean).join('\n');
  }
  function cardRow(cls,mark,title,body){
    return `<div class="mc-row ${cls}"><span class="mc-icon" aria-hidden="true">${mark}</span><div class="mc-body"><span class="mc-title">${esc(title)}</span>${body}</div></div>`;
  }
  const chips=items=>`<div class="mc-chips">${items.join('')}</div>`;
  function cardHtml(ref,mine,theirs){
    const s=summary(ref,mine,theirs);
    if(!s)return '';
    const none=text=>`<span class="mc-none">${esc(text)}</span>`;
    const avoid=s.avoid.length?chips(s.avoid.map(a=>`<span class="mc-chip">${icon(ref,'u',a.unit,{label:true,tip:[`${unitName(ref,a.unit)} 단독`,...a.by.map(h=>`← ${unitName(ref,h.unit)} +${h.total} (${parts(ref,h)})`)].join('\n')})}${relation(ref,a.by[0].unit,a.unit,a.by[0],'←')}</span>`)):none('뚜렷한 것 없음');
    const threats=s.threats.length?chips(s.threats.map(t=>`<span class="mc-chip">${icon(ref,'u',t.unit,{label:true,tip:unitTip(ref,t.unit,t.hits)})}${t.hits.length?relation(ref,t.unit,t.hits[0].target,t.hits[0],'→'):'<span class="mc-rel-text">고유 유닛</span>'}</span>`)):none('뚜렷한 것 없음');
    const recommend=s.recommend.length?chips(s.recommend.map(r=>`<span class="mc-chip">${icon(ref,'u',r.unit,{label:true,tip:unitTip(ref,r.unit,r.vs)+(r.full?'':'\n(최종 업그레이드 아님)')})}${relation(ref,r.unit,r.vs[0].target,r.vs[0],'→')}</span>`)):none('공격 보너스로 맞설 계열 없음');
    const g=s.gaps;
    const gapIcons=[...g.lines.map(r=>icon(ref,'u',r,{crossed:true,tip:`${unitName(ref,r)} 계열 없음`})),...g.tops.map(id=>icon(ref,'u',id,{crossed:true,tip:`${unitName(ref,id)} 없음`})),...g.techs.map(t=>icon(ref,'t',t,{crossed:true,tip:`${techName(ref,t)} 없음`}))];
    return `<div class="matchup-card"><div class="mc-head"><span class="mc-kicker">MATCHUP · ${esc(civLabel(ref,mine))}</span><strong class="mc-vs">VS ${esc(civLabel(ref,theirs))}</strong></div>`
      +cardRow('mc-avoid','!','피해야 할 단독 병력',avoid)
      +cardRow('mc-threat','▲','상대 핵심 위협',threats)
      +cardRow('mc-counter','✓','추천 대응',recommend)
      +cardRow('mc-gap','i','상대 기술적 빈틈',gapIcons.length?`<div class="mc-icons">${gapIcons.join('')}</div>`:none('주요 계열·기술 결손 없음'))
      +'<p class="mc-note">+숫자 = 타격당 공격 보너스, 각 계열 최종 유닛 기본값(대장간·문명 보너스 제외). 아이콘에 마우스를 올리거나 누르면 이름·근거.</p></div>';
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
  const api={lineStatus,bonusVs,compare,summary,html,mount,load};
  if(typeof module==='object'&&module.exports)module.exports=api;else{global.SSAPOCivMatchup=api;installTips();}
})(typeof window==='undefined'?globalThis:window);
