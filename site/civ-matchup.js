/* 문명 매치업 및 전략 복기 (1단계): 게임 기술표·유닛 데이터(data/civ-reference.json)에서 계산한 사실만 보여준다.
   문명 보너스 문장은 게임 문자열(civilizations.json의 설명 문자열 id) 그대로이고, 여기서 새로 쓰지 않는다. */
(function(global){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const BUILDING_ORDER=[12,87,101,49,82,104];
  const BUILDING_KO={12:'병영',87:'궁수 양성소',101:'마구간',49:'공성 무기 제조소',82:'성',104:'수도원'};
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

  function compare(ref,mine,theirs){
    if(!ref?.civs?.[mine]||!ref?.civs?.[theirs])return null;
    const sides=[mine,theirs].map(name=>({name,civ:ref.civs[name],lines:linesOf(ref,name)}));
    const byRoot=sides.map(s=>new Map(s.lines.map(l=>[l.root,l])));
    const roots=[...new Set(sides.flatMap(s=>s.lines.map(l=>l.root)))];
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

  const civLabel=(ref,name)=>(global.SSAPOCivNames&&global.SSAPOCivNames[name])||ref?.civs?.[name]?.name_ko||name;
  const bonusText=(ref,h)=>`${esc(unitName(ref,h.unit))} <b>+${h.total}</b><small>(${h.parts.map(p=>`${esc(className(ref,p.cls))} ${p.amount}`).join(', ')})</small>`;
  function lineCell(ref,l){
    if(l.final==null)return '<span class="matchup-none">없음</span>';
    const missing=l.missing.filter(id=>id!==l.root);
    return `${esc(unitName(ref,l.final))}${missing.length?` <small>(${missing.map(id=>esc(unitName(ref,id))).join(', ')} 없음)</small>`:''}`;
  }
  function edgeItem(ref,e){
    return e.kind==='only'?`<li><b>${esc(unitName(ref,e.final))}</b> <small>${esc(BUILDING_KO[buildingOf(ref,e.root)]||'')} · 상대 기술표에 없음</small></li>`
      :`<li><b>${esc(unitName(ref,e.final))}</b>까지 <small>상대는 ${esc(unitName(ref,e.otherFinal))}까지</small></li>`;
  }
  function sideHtml(ref,cmp,i,title){
    const s=cmp.sides[i],own=i===0?'a':'b';
    const gaps=cmp.lines.filter(l=>l[own].status==='partial'&&!NON_COMBAT.has(l.root)).map(l=>l[own]);
    const techGaps=cmp.techs.filter(t=>t[own].length&&t.group!=='dock');
    const unique=(s.civ.unique_techs||[]).map(t=>techName(ref,t));
    return `<section class="signal-group matchup-side"><h3>${esc(title)} · ${esc(civLabel(ref,s.name))}</h3>`
      +`<p class="matchup-label">상대에게 없는 병종·더 높은 최종 업그레이드 <span>${cmp.edges[i].length}</span></p>${cmp.edges[i].length?`<ul class="matchup-list">${cmp.edges[i].map(e=>edgeItem(ref,e)).join('')}</ul>`:'<p class="compact-note">없음</p>'}`
      +`<p class="matchup-label">최종 업그레이드 결손</p>${gaps.length?`<ul class="matchup-list">${gaps.map(l=>`<li>${esc(unitName(ref,l.root))} 계열: ${esc(unitName(ref,l.final))}까지 <small>(${l.missing.map(id=>esc(unitName(ref,id))).join(', ')} 없음)</small></li>`).join('')}</ul>`:'<p class="compact-note">주요 병종 계열 결손 없음</p>'}`
      +`<p class="matchup-label">기술 결손</p>${techGaps.length?`<ul class="matchup-list">${techGaps.map(t=>`<li>${esc(GROUP_KO[t.group]||t.group)}: ${t[own].map(id=>esc(techName(ref,id))).join(', ')}</li>`).join('')}</ul>`:'<p class="compact-note">대장간·대학·수도원·경제·군사 건물 기술 결손 없음</p>'}`
      +(unique.length?`<p class="matchup-label">고유 기술</p><p class="matchup-text">${unique.map(esc).join(', ')}</p>`:'')
      +`<details class="matchup-bonus"><summary>문명 보너스 (게임 문구)</summary>${(s.civ.description||[]).map(r=>r.startsWith('#')?`<b>${esc(r.slice(1))}</b>`:`<span>${esc(r)}</span>`).join('')}</details></section>`;
  }
  function counterTable(ref,rows,targetTitle,attackerTitle){
    if(!rows.length)return '<p class="compact-note">공격 보너스가 있는 조합 없음</p>';
    const row=r=>`<tr><th scope="row">${esc(unitName(ref,r.target))}</th><td>${r.hits.slice(0,3).map(h=>bonusText(ref,h)).join('<br>')}</td></tr>`;
    const head=`<thead><tr><th scope="col">${esc(targetTitle)}</th><th scope="col">${esc(attackerTitle)} (타격당 보너스 피해)</th></tr></thead>`;
    return `<div class="table-scroll"><table class="timeline comparison matchup-table">${head}<tbody>${rows.slice(0,6).map(row).join('')}</tbody></table></div>`
      +(rows.length>6?`<details class="more-signals"><summary>${rows.length-6}개 더 보기</summary><div class="table-scroll"><table class="timeline comparison matchup-table">${head}<tbody>${rows.slice(6).map(row).join('')}</tbody></table></div></details>`:'');
  }
  function html(ref,mine,theirs){
    const title='<div class="summary-label"><span id="civ-matchup-title">문명 매치업 및 전략 복기</span>'+(ref?.game_build?`<small>게임 빌드 ${esc(ref.game_build)} 기술표·유닛 데이터</small>`:'')+'</div>';
    const cmp=compare(ref,mine,theirs);
    if(!cmp){
      const lacking=[mine,theirs].filter(c=>!ref?.civs?.[c]).map(c=>civLabel(ref,c)||'문명 확인 전');
      return `<section class="civ-matchup" aria-labelledby="civ-matchup-title">${title}<p class="compact-note">${ref?`${esc(lacking.join(', '))}: 1v1 랭크 문명 기술표에 없는 문명이라 비교하지 않아요.`:'문명 기술표를 불러오지 못했어요.'}</p></section>`;
    }
    const names=[civLabel(ref,mine),civLabel(ref,theirs)];
    const allLines=cmp.lines.filter(l=>l.a.final!=null||l.b.final!=null);
    const diff=allLines.filter(l=>l.differs),same=allLines.filter(l=>!l.differs);
    const lineRow=l=>`<tr><th scope="row">${esc(unitName(ref,l.root))} 계열</th><td>${lineCell(ref,l.a)}</td><td>${lineCell(ref,l.b)}</td></tr>`;
    const lineHead=`<thead><tr><th scope="col">병종 계열</th><th scope="col">나 · ${esc(names[0])}</th><th scope="col">상대 · ${esc(names[1])}</th></tr></thead>`;
    return `<section class="civ-matchup" aria-labelledby="civ-matchup-title">${title}`
      +`<div class="signal-columns">${sideHtml(ref,cmp,0,'나')}${sideHtml(ref,cmp,1,'상대')}</div>`
      +`<h4 class="matchup-heading">내 병종이 공격 보너스를 갖는 상대 병종</h4>${counterTable(ref,cmp.counters[0],`상대 · ${names[1]}`,`나 · ${names[0]}`)}`
      +`<h4 class="matchup-heading">상대 병종이 공격 보너스를 갖는 내 병종</h4>${counterTable(ref,cmp.counters[1],`나 · ${names[0]}`,`상대 · ${names[1]}`)}`
      +`<details class="matchup-lines"><summary>병종 계열 최종 단계 비교 (차이 ${diff.length}개)</summary><div class="table-scroll"><table class="timeline comparison matchup-table">${lineHead}<tbody>${diff.map(lineRow).join('')}</tbody></table></div>${same.length?`<p class="compact-note">양측 같음: ${same.map(l=>esc(unitName(ref,l.final??l.root))).join(', ')}</p>`:''}</details>`
      +`<p class="compact-note">각 계열의 기술표상 최종 단계 유닛끼리, 게임 데이터의 방어 클래스별 공격 보너스(공격 − 상대 클래스 방어, 0 미만은 0)만 더했어요. 기본 공격·방어·체력·비용, 대장간·문명 보너스는 넣지 않았고, 이 경기에서 실제로 만든 병종(생산 명령이지 완료가 아님)과의 비교는 아직 하지 않아요.</p></section>`;
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
  const api={lineStatus,bonusVs,compare,html,mount,load};
  if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOCivMatchup=api;
})(typeof window==='undefined'?globalThis:window);
