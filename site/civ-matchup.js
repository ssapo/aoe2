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
  function bonusVs(ref,attacker,defender){return bonusStats(ref?.unit_stats?.[String(attacker)],ref?.unit_stats?.[String(defender)]);}
  function bonusStats(a,d){
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
  const isRanged=(ref,id)=>(stat(ref,id)?.range||0)>=2;
  // damage per hit after armour (base melee/pierce plus class bonuses), at least 1 as in the game
  function hitStats(A,D){
    if(!A||!D)return 1;
    const base=Math.max(0,(A.melee_attack||0)-(D.melee_armour||0))+Math.max(0,(A.pierce_attack||0)-(D.pierce_armour||0));
    return Math.max(1,base+bonusStats(A,D).total);
  }
  const costOf=s=>Object.values(s?.cost||{}).reduce((a,b)=>a+b,0)||1;
  // How a beats d in a 1-on-1 from the final units' base values (no blacksmith, civ bonus amounts or micro):
  // each side's time to kill the other = HP ÷ (damage per hit ÷ reload); a melee unit facing a ranged one first
  // walks across its range (range ÷ speed). ratio = (d's time to kill a) ÷ (a's time to kill d) × d's cost ÷ a's
  // cost, i.e. resource for resource; edge = log2(ratio), > 0 when a wins.
  // SA/SD: the two units' stats at an age (statAt); without them the base DAT values
  function pair(ref,a,d,SA,SD){
    const A=SA||stat(ref,a),D=SD||stat(ref,d);
    if(!A||!D)return {edge:0,ratio:1,approach:0,dealt:1,taken:1,aKills:0,dKills:0,bonus:{total:0,parts:[]},costA:1,costD:1};
    const dealt=hitStats(A,D),taken=hitStats(D,A),ranged=s=>(s.range||0)>=2;
    let aKills=D.hp/(dealt/(A.reload||2)),dKills=A.hp/(taken/(D.reload||2)),approach=0;
    if(ranged(A)&&!ranged(D)){approach=A.range/(D.speed||1);dKills+=approach;}
    else if(ranged(D)&&!ranged(A)){approach=D.range/(A.speed||1);aKills+=approach;}
    const costA=costOf(A),costD=costOf(D),ratio=dKills/aKills*(costD/costA);
    return {edge:Math.log2(ratio),ratio,dealt,taken,approach,aKills,dKills,bonus:bonusStats(A,D),costA,costD};
  }
  // ── per age (APP-16): units a civ has in an age and their stats with what it can research by then ──
  const AGES=[2,3,4],AGE_KO={2:'봉건',3:'성주',4:'왕정'};
  const nodeAge=(ref,kind,id)=>node(ref,kind,id)?.age??1;
  // lines whose first unit exists in `age`; final = the best unit of the line the civ has by then. A unique
  // upgrade inside a common line (Imperial Skirmisher) that the civ lacks does not make the line "partial".
  function linesAt(ref,civName,age){
    const civ=ref?.civs?.[civName];
    if(!civ)return [];
    const missing=new Set(civ.missing_units||[]);
    // a unit its civ's own tech enables comes no earlier than that tech (unlock_ages, from the DAT)
    const ageOf=id=>Math.max(nodeAge(ref,'u',id),Number(civ.unlock_ages?.[id])||0);
    return (civ.lines||[]).filter(chain=>ageOf(chain[0])<=age).map(chain=>{
      const inAge=chain.filter(id=>ageOf(id)<=age&&!(missing.has(id)&&node(ref,'u',id)?.type==='UniqueUnit'&&id!==chain[0]));
      const avail=inAge.filter(id=>!missing.has(id));
      const final=missing.has(chain[0])||!avail.length?null:avail[avail.length-1];
      return {root:chain[0],chain,final,top:inAge[inAge.length-1],missing:inAge.filter(id=>missing.has(id)),
        status:final==null?'none':avail.length===inAge.length?'full':'partial'};
    });
  }
  // civ bonus steps [age, attribute, kind, amount, source] from the DAT; unique techs count from the Castle Age.
  const stepAge=st=>st[4]==='unique'?Math.max(3,st[0]):st[0];
  // Only plain steps change numbers: add / multiply within sane bounds. A unit's attribute whose steps include
  // the game's rounding tricks (±2000, ×0.01 then ×100, as for the Mongol light cavalry hit points) keeps its
  // base value; the bonus still counts for choosing threats and is named in the tooltip.
  function cleanSteps(ref,civName,id){
    const b=ref?.civs?.[civName]?.boosts?.[String(id)];
    if(!Array.isArray(b?.steps))return [];
    const ok=([,attr,kind,amount])=>{
      if(kind===5)return amount>=0.5&&amount<=2&&attr!==8&&attr!==9;
      if(kind!==4)return false;
      if(attr===8||attr===9)return Math.abs(amount)%256<=10;
      if(attr===0)return Math.abs(amount)<=60;
      if(attr===12)return Math.abs(amount)<=3;
      if(attr===5||attr===10)return Math.abs(amount)<=1;
      return false;
    };
    const byAttr=new Map();
    for(const st of b.steps){if(!byAttr.has(st[1]))byAttr.set(st[1],[]);byAttr.get(st[1]).push(st);}
    return [...byAttr.values()].filter(list=>list.every(ok)).flat();
  }
  // one effect command on a stats copy; attack/armour amounts are class * 256 + value
  const COST_KEY={103:'0',104:'1',105:'3',106:'2'};
  function applyCmd(s,kind,attr,amount){
    const num=(k)=>{if(kind===4)s[k]=(s[k]||0)+amount;else if(kind===5)s[k]=(s[k]||0)*amount;else if(kind===0)s[k]=amount;};
    if(attr===0)num('hp');else if(attr===5)num('speed');else if(attr===10)num('reload');else if(attr===12)num('range');
    else if(attr===8||attr===9){
      if(kind!==4)return;
      const a=Math.abs(amount),cls=Math.floor(a/256),v=(a%256)*(amount<0?-1:1);
      if(attr===9){
        if(cls===4){if(s.melee_attack>0)s.melee_attack+=v;}
        else if(cls===3){if(s.pierce_attack>0)s.pierce_attack+=v;}
        else s.bonus[cls]=(s.bonus[cls]||0)+v;
      }else if(cls===4)s.melee_armour+=v;
      else if(cls===3)s.pierce_armour+=v;
      else if(has(s.armour_classes,String(cls)))s.armour_classes[cls]+=v;
    }else if(kind===5&&(attr===100||COST_KEY[attr])&&s.cost){
      for(const k of Object.keys(s.cost))if(attr===100||COST_KEY[attr]===k)s.cost[k]*=amount;
    }
  }
  // generic techs (blacksmith, Bloodlines, Thumb Ring, …) the civ has by `age`
  const techsAt=(ref,civName,age)=>{
    const missing=new Set(ref?.civs?.[civName]?.missing_techs||[]);
    return Object.entries(ref?.tech_effects||{}).filter(([id,t])=>(t.age||1)<=age&&!missing.has(Number(id)));
  };
  const statCache=new WeakMap();
  // a unit's stats in `age`: base DAT values + the civ's generic techs by then + its plain civ-bonus steps by then
  function statAt(ref,civName,id,age){
    const base=stat(ref,id);
    if(!base||!ref)return base;
    if(!statCache.has(ref))statCache.set(ref,new Map());
    const cache=statCache.get(ref),key=`${civName}|${id}|${age}`;
    if(cache.has(key))return cache.get(key);
    const s=JSON.parse(JSON.stringify(base));
    s.bonus=s.bonus||{};s.armour_classes=s.armour_classes||{};
    const techs=[];
    for(const [tid,t] of techsAt(ref,civName,age)){
      let hit=false;
      for(const [kind,unit,cls,attr,amount] of t.commands||[])
        if(unit===id||unit===-1&&cls>=0&&cls===base.class){applyCmd(s,kind,attr,amount);hit=true;}
      if(hit)techs.push(Number(tid));
    }
    const steps=cleanSteps(ref,civName,id).filter(st=>stepAge(st)<=age);
    for(const [,attr,kind,amount] of steps)applyCmd(s,kind,attr,amount);
    s.techs=techs;
    cache.set(key,s);
    return s;
  }
  // the civ bonus on a unit counted in `age` (its earliest step by then), with the attributes it changes by then
  function boostAt(ref,civName,id,age){
    const b=ref?.civs?.[civName]?.boosts?.[String(id)];
    if(!b)return null;
    if(!Array.isArray(b.steps))return (b.from_age||1)<=age?b:null;
    const steps=b.steps.filter(st=>stepAge(st)<=age);
    return steps.length?{attrs:[...new Set(steps.map(st=>st[1]))],sources:[...new Set(steps.map(st=>st[4]))]}:null;
  }
  const isUniqueUnit=(ref,l)=>node(ref,'u',l.root)?.type==='UniqueUnit'||buildingOf(ref,l.root)===82;
  const boostOf=(ref,civ,id)=>ref?.civs?.[civ]?.boosts?.[String(id)]||null;
  // keep the first line of each unit class (DAT class: archer, cavalry, cavalry archer, …), then fill up
  // (a unique unit stands for its class over a common line of the same class when both are listed: Mangudai over
  // Cavalry Archer — the civ's own unit is what players expect; APP-16)
  function diverse(ref,rows,count,taken){
    const out=[],seen=new Set((taken||[]).map(r=>stat(ref,r.unit)?.class)),uniq=r=>r.unique===true;
    for(const r of rows){
      const c=stat(ref,r.unit)?.class;
      if(out.length>=count||seen.has(c))continue;
      out.push(uniq(r)?r:rows.find(x=>uniq(x)&&stat(ref,x.unit)?.class===c&&(x.score??1)>=Math.min(0.5,r.score??1))||r);seen.add(c);
    }
    for(const r of rows)if(out.length<count&&!out.includes(r))out.push(r);
    return out;
  }
  const sumPositive=values=>values.filter(v=>v>0).reduce((a,b)=>a+b,0);
  // age: 2 Feudal, 3 Castle, 4 Imperial — only units of that age with the techs and civ bonuses by then;
  // without an age, the final units with base values (the first card). made: their army line root → orders.
  function summary(ref,mine,theirs,age,made){
    if(!ref?.civs?.[mine]||!ref?.civs?.[theirs])return null;
    const at=age!=null;
    const L=civ=>at?linesAt(ref,civ,age):linesOf(ref,civ);
    const S=(civ,id)=>at?statAt(ref,civ,id,age):stat(ref,id);
    const boost=(civ,id)=>at?boostAt(ref,civ,id,age):boostOf(ref,civ,id);
    const P=(a,ca,d,cd)=>pair(ref,a,d,S(ca,a),S(cd,d));
    const myArmy=armyLines(ref,L(mine)),theirArmy=armyLines(ref,L(theirs));
    // my main lines: unique, fully upgraded (for the age) or boosted by my civ
    const mainLines=myArmy.filter(l=>isUniqueUnit(ref,l)||l.status==='full'||boost(mine,l.final));
    const main=mainLines.length?mainLines:myArmy;
    const madeOf=l=>Number(made?.[l.root])||0;
    // threat candidates: their unique units, lines their civ boosts and lines they made; fully upgraded lines
    // only if fewer than three
    let pool=theirArmy.filter(l=>isUniqueUnit(ref,l)||boost(theirs,l.final)||madeOf(l));
    if(pool.length<3)pool=pool.concat(theirArmy.filter(l=>l.status==='full'&&!pool.includes(l)));
    // lines they made at least three of in this age come first (most made first)
    const lead=r=>r.made>=3?r.made:0;
    const threatRows=pool.map(l=>{
      const vs=main.map(m=>({target:m.final,...P(l.final,theirs,m.final,mine)})).sort((x,y)=>y.edge-x.edge);
      return {unit:l.final,root:l.root,unique:isUniqueUnit(ref,l),boost:boost(theirs,l.final),made:madeOf(l),vs,score:sumPositive(vs.map(v=>v.edge))};
    }).sort((x,y)=>lead(y)-lead(x)||Number(y.score>=0.5)-Number(x.score>=0.5)||(y.score>=0.5?y.score-x.score:0)||Number(y.unique)-Number(x.unique)||(y.boost?.attrs.length||0)-(x.boost?.attrs.length||0));
    // lines they made are all kept (knights and light cavalry are both cavalry); the rest one per unit class
    const led=threatRows.filter(r=>lead(r)>0).slice(0,3);
    const threats=led.concat(diverse(ref,threatRows.filter(r=>!led.includes(r)),3-led.length,led));
    const T=threats.map(t=>t.unit);
    // the opponent's strongest answer to one of my units, over all their army lines
    const answer=id=>theirArmy.map(o=>({line:o,...P(o.final,theirs,id,mine)})).sort((x,y)=>y.edge-x.edge)[0]||null;
    // avoid: my main lines the threats beat together, that beat none of them and that the opponent can answer
    const avoidRows=main.map(m=>{
      const by=T.map(u=>({unit:u,...P(u,theirs,m.final,mine)})).filter(p=>p.edge>0).sort((x,y)=>y.edge-x.edge);
      const hitsBack=T.some(u=>P(m.final,mine,u,theirs).edge>0.5);
      return {unit:m.final,root:m.root,by,score:sumPositive(by.map(p=>p.edge)),hitsBack,answer:answer(m.final)};
    }).filter(a=>a.score>=1&&!a.hitsBack&&a.answer&&a.answer.edge>=0.5).sort((x,y)=>y.score-x.score);
    const avoid=diverse(ref,avoidRows,2);
    const avoided=new Set(avoid.map(a=>a.root));
    // recommend: my lines that beat at least one threat, fully upgraded first, then how well they beat the threats
    // minus how well the opponent can answer them (a missing counter upgrade on their side helps)
    const recommend=myArmy.filter(m=>!avoided.has(m.root)).map(m=>{
      const vs=T.map(u=>({target:u,...P(m.final,mine,u,theirs)})).sort((x,y)=>y.edge-x.edge);
      const neg=vs.filter(v=>v.edge<0).reduce((a,v)=>a+v.edge,0),ans=answer(m.final);
      return {unit:m.final,root:m.root,full:m.status==='full',vs,beats:sumPositive(vs.map(v=>v.edge)),answer:ans,score:sumPositive(vs.map(v=>v.edge))+neg/2-Math.max(0,ans?.edge||0)/2};
    }).filter(r=>r.beats>=0.5).sort((x,y)=>Number(y.full)-Number(x.full)||y.score-x.score).slice(0,3);
    // gaps: their missing core lines, missing final upgrades, missing key techs (those that exist by the age)
    const inAge=(kind,id)=>!at||nodeAge(ref,kind,id)<=age;
    const theirLines=new Map(L(theirs).map(l=>[l.root,l]));
    const missingLines=CORE_LINES.filter(r=>inAge('u',r)&&(!theirLines.has(r)||theirLines.get(r).status==='none'));
    const missingTops=[...theirLines.values()].filter(l=>l.status==='partial'&&!NON_COMBAT.has(l.root)).map(l=>l.top);
    const missingKey=KEY_TECHS.filter(t=>inAge('t',t)&&(ref.civs[theirs].missing_techs||[]).includes(t));
    const smith=missingTechs(ref,theirs,'blacksmith').filter(t=>inAge('t',t)&&!missingKey.includes(t));
    return {age:at?age:null,threats,avoid,recommend,myArmy,theirArmy,gaps:{lines:missingLines,tops:missingTops,techs:[...missingKey,...smith]}};
  }
  const parts=(ref,h)=>h.parts.map(p=>`${className(ref,p.cls)} ${p.amount}`).join(', ');
  const civLabel=(ref,name)=>(global.SSAPOCivNames&&global.SSAPOCivNames[name])||ref?.civs?.[name]?.name_ko||name;
  const iconSrc=(ref,kind,id)=>{const n=node(ref,kind,id);return n?.icon!=null?`assets/${kind==='u'?'units':'techs'}/${n.icon}.png`:null;};
  function statsLine(ref,id,s){
    s=s||ref?.unit_stats?.[String(id)];
    if(!s)return '';
    const r=v=>Math.round(v*10)/10;
    const attack=s.pierce_attack>s.melee_attack?`원거리 공격 ${r(s.pierce_attack)}`:`근접 공격 ${r(s.melee_attack)}`;
    return `체력 ${r(s.hp)} · ${attack} · 방어 ${r(s.melee_armour)}/${r(s.pierce_armour)}`;
  }
  // One unit or tech as an icon; its name and evidence are in the tooltip (data-tip, shown on hover or tap).
  // label: the short name next to the icon (summary card); crossed: the civ lacks it.
  function icon(ref,kind,id,opts={}){
    const name=kind==='u'?unitName(ref,id):techName(ref,id),tip=opts.tip||name,src=iconSrc(ref,kind,id);
    const cls=`mu${opts.crossed?' mu-x':''}${opts.side?` mu-${opts.side}`:''}`;
    // noTip: the icon sits inside a row that carries the tooltip, so it is not focusable on its own
    return (opts.noTip?`<span class="${cls}" aria-hidden="true">`:`<span class="${cls}" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}">`)
      +(src?`<img src="${src}" alt="" loading="lazy">`:`<span class="mu-fallback">${esc(name.slice(0,2))}</span>`)
      +(opts.label?`<span class="mu-label">${esc(name)}</span>`:'')+'</span>';
  }
  const times=edge=>{const r=Math.pow(2,edge);return r>=10?"10+":r.toFixed(1);};
  const pairFigure=p=>`×${times(p.edge)}`;
  const sec=v=>`${Math.round(v*10)/10}초`;
  const SIDE_KO={mine:'내',theirs:'상대'};
  const other=side=>side==='mine'?'theirs':'mine';
  // Korean particle by the last syllable's final consonant: josa('미늘창병','은','는') → '은'
  const josa=(word,withFinal,without)=>{const c=String(word).trim().slice(-1).charCodeAt(0);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28?withFinal:without;};
  const sided=(ref,id,side)=>`${SIDE_KO[side]} ${unitName(ref,id)}`;
  // one line per bonus class: why the attacker's bonus lands on this target
  function whyLines(ref,a,d,p,sideA){
    const D=sided(ref,d,other(sideA)),A=sided(ref,a,sideA);
    return p.bonus.parts.map(x=>`왜: ${D}${josa(unitName(ref,d),'은','는')} '${className(ref,x.cls)}' 방어 클래스를 가짐 → ${A}의 추가 피해 +${x.amount} 적용`);
  }
  function pairTip(ref,a,d,p,sideA){
    return [`${sided(ref,a,sideA)} → ${sided(ref,d,other(sideA))}`,
      `타격당 피해 ${Math.round(p.dealt*10)/10}${p.bonus.parts.length?` (추가 피해 ${parts(ref,p.bonus)} 포함)`:''} · 받는 피해 ${Math.round(p.taken*10)/10}`,
      ...whyLines(ref,a,d,p,sideA),
      `1:1로 잡는 시간: ${unitName(ref,a)} ${sec(p.aKills)} · ${unitName(ref,d)} ${sec(p.dKills)}${p.approach?` (근접 쪽 접근 ${sec(p.approach)} 포함)`:''}`,
      `비용 ${Math.round(p.costA)} · ${Math.round(p.costD)} → 같은 자원이면 ${SIDE_KO[sideA]} 쪽이 ×${times(p.edge)} 유리`].join('\n');
  }
  // a horizontal sword, point to the right; .mc-sword-left mirrors it so the point faces the unit being hit
  const SWORD='<svg class="mc-sword" viewBox="0 0 52 16" aria-hidden="true"><rect x="1" y="6.4" width="7" height="3.2" rx="1" fill="#6b4f2e"/><circle cx="2" cy="8" r="2.3" fill="#b8913f"/><rect x="8" y="2" width="3.2" height="12" rx="1" fill="#b8913f"/><path d="M11.2 5.9H42L50.5 8 42 10.1H11.2Z" fill="#dfe5ea" stroke="#5f6b76" stroke-width=".9" stroke-linejoin="round"/><path d="M12 8H43" stroke="#9aa6b1" stroke-width=".7"/></svg>';
  const bonusOf=p=>Math.round((p.bonus?.total||0)*10)/10;
  // the figure on the sword: how much the same resources favour the attacker (the per-hit bonus alone
  // understates units that win on base stats, e.g. Ghulam +6 against archers yet ×10+)
  const swordFigure=p=>`×${times(p.edge)}`;
  // [subject icon] sword [other icon]; pointLeft: the other unit hits the subject
  function pairVisual(ref,subject,subjectSide,otherUnit,p,pointLeft){
    const big=(id,side)=>icon(ref,'u',id,{side,noTip:true});
    return `<span class="mc-pair">${big(subject,subjectSide)}<span class="mc-hit${pointLeft?' mc-hit-left':''}"><b>${esc(swordFigure(p))}</b>${SWORD}</span>${big(otherUnit,other(subjectSide))}</span>`;
  }
  // one plain sentence for a pair: the bonus when there is one, otherwise how much the same resources favour it
  function pairSentence(ref,p){
    const top=p.bonus.parts[0];
    return bonusOf(p)>0?`한 대당 +${bonusOf(p)} 추가 피해(${className(ref,top.cls)})`:`같은 자원이면 ${times(p.edge)}배 유리`;
  }
  const boostPhrase=(b,civ)=>b?`${civ} 보너스로 ${[...new Set(b.attrs.map(a=>ATTR_KO[a]).filter(Boolean))].join('·')} 강화${b.sources.includes('unique')?'(성 연구 포함)':''}`:'';
  // badge: a short note after the name (e.g. how many the opponent made in this age)
  function line(cls,visual,name,why,tip,badge){
    return `<div class="mc-line ${cls}" tabindex="0" role="button" aria-label="${esc(name+(badge?` (${badge})`:'')+' — '+why)}" data-tip="${esc(tip)}">${visual}<span class="mc-text"><b class="mc-name">${esc(name)}${badge?` <span class="mc-made">${esc(badge)}</span>`:''}</b><span class="mc-why">${esc(why)}</span></span></div>`;
  }
  function unitTip(ref,id,side,rows,extra,s){
    const out=[sided(ref,id,side),statsLine(ref,id,s)];
    for(const r of rows||[])if(r.edge>0)out.push(`→ ${sided(ref,r.target,other(side))} ${pairFigure(r)}`);
    return out.concat(extra||[]).filter(Boolean).join('\n');
  }
  const boostText=b=>b?`문명 보너스: ${[...new Set(b.attrs.map(a=>ATTR_KO[a]).filter(Boolean))].join('·')}${b.sources.includes('unique')?' (성 연구 포함)':''}`:'';
  function answerText(ref,ans){
    if(!ans)return '';
    const l=ans.line,missing=l.status==='partial'?` — 상대 ${unitName(ref,l.top)} 없음`:'';
    return `상대의 가장 강한 대응: ${unitName(ref,l.final)} ${ans.edge>0?pairFigure(ans):'(불리)'}${missing}`;
  }
  function section(cls,mark,title,body){
    return `<section class="mc-sec ${cls}"><h4 class="mc-title"><span class="mc-icon" aria-hidden="true">${mark}</span>${esc(title)}</h4>${body}</section>`;
  }
  // one age's four rows (avoid, threats, answers, gaps) and its folded details
  function agePanel(ref,mine,theirs,age,made){
    const s=summary(ref,mine,theirs,age,made);
    if(!s)return '';
    const them=civLabel(ref,theirs),me=civLabel(ref,mine);
    const S=(civ,id)=>statAt(ref,civ,id,age);
    const none=text=>`<p class="mc-none">${esc(text)}</p>`;
    const list=rows=>`<div class="mc-lines">${rows.join('')}</div>`;
    // avoid: my line, hit by their threat (the sword points at my unit)
    const avoid=s.avoid.length?list(s.avoid.map(a=>{
      const p=a.by[0],t=unitName(ref,p.unit);
      const why=`${them} ${t}${josa(t,'이','가')} ${pairSentence(ref,p)}`;
      return line('',pairVisual(ref,a.unit,'mine',p.unit,p,true),`${unitName(ref,a.unit)}만 모으기`,why,
        [pairTip(ref,p.unit,a.unit,p,'theirs'),...a.by.slice(1).map(q=>`또: 상대 ${unitName(ref,q.unit)} ${pairFigure(q)}`),answerText(ref,a.answer)].filter(Boolean).join('\n'));
    })):none('상대 핵심 병종이 함께 앞서는 내 계열 없음');
    // threats: their unit hitting the line of mine it beats most; the ones they made carry a badge
    const threats=s.threats.length?list(s.threats.map(t=>{
      const best=t.vs[0],won=best&&best.edge>0,name=unitName(ref,t.unit);
      const why=[t.boost?boostPhrase(t.boost,them):t.unique?`${them} 고유 유닛`:'',won?`내 ${unitName(ref,best.target)}에 ${pairSentence(ref,best)}`:''].filter(Boolean).join(' · ');
      const visual=won?pairVisual(ref,t.unit,'theirs',best.target,best,false):`<span class="mc-pair">${icon(ref,'u',t.unit,{side:'theirs',noTip:true})}</span>`;
      const badge=t.made?`상대가 실제로 뽑음 ×${t.made}`:'';
      return line('',visual,name,why||(t.made?'이 시대에 상대가 만든 병종':'완전 승급 계열'),[won?pairTip(ref,t.unit,best.target,best,'theirs'):unitTip(ref,t.unit,'theirs',[],[],S(theirs,t.unit)),t.unique?'고유 유닛':'',boostText(t.boost),
        t.made?`상대가 이 시대에 이 계열 생산 명령 ${t.made}기 (명령 기준 — 취소·자원 부족·생존은 리플에 없음)`:''].filter(Boolean).join('\n'),badge);
    })):none('뚜렷한 것 없음');
    // recommend: my line hitting their threat; a missing counter upgrade on their side is said too
    const recommend=s.recommend.length?list(s.recommend.map(r=>{
      const p=r.vs[0],ans=r.answer,gap=ans&&ans.line.status==='partial'?`${them}에는 ${unitName(ref,ans.line.top)}${josa(unitName(ref,ans.line.top),'이','가')} 없음`:'';
      const why=[`${unitName(ref,p.target)}에 ${pairSentence(ref,p)}`,gap].filter(Boolean).join(' · ');
      return line('',pairVisual(ref,r.unit,'mine',p.target,p,false),unitName(ref,r.unit),why,
        [pairTip(ref,r.unit,p.target,p,'mine'),r.full?'':'(이 시대 최종 업그레이드 아님)',answerText(ref,ans)].filter(Boolean).join('\n'));
    })):none('상대 핵심 병종에 앞서는 계열 없음');
    // gaps: icon + words, at most four; the rest behind one more chip; army lines first, key techs, siege last
    const g=s.gaps,siege=id=>buildingOf(ref,id)===49;
    const lineItems=[...g.lines.map(r=>['u',r,`${unitName(ref,r)} 계열 없음`]),...g.tops.map(id=>['u',id,`${unitName(ref,id)} 없음`])];
    const items=[...lineItems.filter(x=>!siege(x[1])),...g.techs.map(t=>['t',t,`${techName(ref,t)} 없음`]),...lineItems.filter(x=>siege(x[1]))];
    const chip=([kind,id,text])=>`<span class="mc-gapchip" tabindex="0" data-tip="${esc(`${them}: ${text}`)}">${icon(ref,kind,id,{side:'theirs',noTip:true})}<span>${esc(text)}</span></span>`;
    const rest=items.slice(4);
    const gaps=items.length?`<div class="mc-gaps">${items.slice(0,4).map(chip).join('')}${rest.length?`<span class="mc-gapchip mc-more" tabindex="0" data-tip="${esc(rest.map(x=>x[2]).join('\n'))}">외 ${rest.length}개</span>`:''}</div>`:none('이 시대 주요 계열·기술 결손 없음');
    // details: what this age's numbers include, per side
    const units=(civ,side,army)=>`<span class="mu-chain">${army.map(l=>icon(ref,'u',l.final,{side,tip:[sided(ref,l.final,side),statsLine(ref,l.final,S(civ,l.final)),boostText(boostAt(ref,civ,l.final,age))].filter(Boolean).join('\n')})).join('')}</span>`;
    const techs=(civ,side)=>{
      const have=techsAt(ref,civ,age).map(([id])=>Number(id));
      const lack=Object.entries(ref.tech_effects||{}).filter(([id,t])=>(t.age||1)<=age&&!have.includes(Number(id))).map(([id])=>Number(id));
      return `<span class="mu-chain">${have.map(id=>icon(ref,'t',id,{side,tip:`${SIDE_KO[side]}: ${techName(ref,id)} (계산에 넣음)`})).join('')}${lack.map(id=>icon(ref,'t',id,{side,crossed:true,tip:`${SIDE_KO[side]}: ${techName(ref,id)} 없음`})).join('')}</span>`;
    };
    const row=(label,a,b)=>`<tr><th scope="row">${esc(label)}</th><td>${a}</td><td>${b}</td></tr>`;
    const details=`<details class="matchup-more mc-agemore"><summary>자세히 — ${AGE_KO[age]}시대 계산에 넣은 것</summary><div class="table-scroll"><table class="timeline matchup-table matchup-grid"><thead><tr><th scope="col"></th><th scope="col">나 · ${esc(me)}</th><th scope="col">상대 · ${esc(them)}</th></tr></thead><tbody>`
      +row('유닛',units(mine,'mine',s.myArmy),units(theirs,'theirs',s.theirArmy))+row('업그레이드',techs(mine,'mine'),techs(theirs,'theirs'))+'</tbody></table></div>'
      +'<p class="compact-note">유닛 = 이 시대에 만들 수 있는 계열의 가장 높은 단계(공성·수도사 제외). 업그레이드 = 이 시대까지 연구할 수 있는 대장간·혈통·사육술·엄지 반지·파르티아 병법·종자·화학 중 그 문명에 있는 것, 모두 했다고 봄. 아이콘을 누르면 그 시대 수치.</p></details>';
    return section('mc-avoid','!','피해야 할 병력 구성',avoid)+section('mc-threat','▲','상대 핵심 위협',threats)
      +section('mc-counter','✓','추천 대응',recommend)+section('mc-gap','i','상대 기술적 빈틈',gaps)+details;
  }
  // the opponent's production orders per age (English unit names) → their line root → orders
  function madeByRoot(ref,civName,labels){
    if(!labels)return null;
    // one name can belong to several unit ids (a unit and its regional copy), so match any of them
    const byName=new Map();
    for(const [k,n] of Object.entries(ref?.nodes||{}))if(k[0]==='u'){if(!byName.has(n.name))byName.set(n.name,[]);byName.get(n.name).push(Number(k.slice(1)));}
    const lines=ref?.civs?.[civName]?.lines||[],out={};
    for(const [label,n] of Object.entries(labels)){
      const ids=byName.get(label)||[],chain=lines.find(c=>ids.some(id=>c.includes(id)));
      if(chain)out[chain[0]]=(out[chain[0]]||0)+n;
    }
    return out;
  }
  // ── actual armies (APP-17): both sides' production and research commands (full_timeline), side by side ──
  // Commands, not units: a queue command may be cancelled or fail for resources; deaths and survivors are not
  // in the replay. One click on a train button queues one unit, so quick repeated clicks (0.2–0.4 s apart on the
  // same buildings in the raw replay) are kept; only exact repeats (same name and amount within 0.05 s) count once.
  // A tech is researched once, so research clicks of the same tech within 5 s are one command; a later repeat
  // means the earlier one was cancelled, and the start of the last burst counts.
  const ATTACK_TECHS=new Set([67,68,75,199,200,201]); // Forging, Iron Casting, Blast Furnace, Fletching, Bodkin Arrow, Bracer
  const ARMOUR_TECHS=new Set([74,76,77,80,81,82,211,212,219]);
  const AGE_LABELS=new Set(['Feudal Age','Castle Age','Imperial Age']);
  const UP_GROUPS=[['smith','대장간'],['line','계열 업그레이드'],['mil','군사 기술'],['eco','경제·기타']];
  const mmss=s=>{s=Math.max(0,Math.round(s));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
  const minute=s=>`${Math.floor(s/60)}분`;
  const nameCache=new WeakMap();
  function nameIndex(ref){
    if(nameCache.has(ref))return nameCache.get(ref);
    const by=new Map();
    for(const [k,n] of Object.entries(ref?.nodes||{})){if(!by.has(n.name))by.set(n.name,[]);by.get(n.name).push(k);}
    // queue commands name the packed trebuchet "Trebuchet"
    for(const [alias,name] of [['Trebuchet','Trebuchet (Packed)']])if(!by.has(alias)&&by.has(name))by.set(alias,by.get(name));
    nameCache.set(ref,by);
    return by;
  }
  function cleanQueue(ev){
    const out=[];let dup=0,cancel=0;
    for(const e of ev||[]){
      if(e[1]!=='Q')continue;
      if(!(e[3]>0)){if(e[3]<0)cancel+=-e[3];continue;}
      let seen=false;
      for(let i=out.length-1;i>=0&&e[0]-out[i][0]<=0.05;i--)if(out[i][2]===e[2]&&out[i][3]===e[3])seen=true;
      if(seen){dup++;continue;}
      out.push(e);
    }
    return {list:out,dup,cancel};
  }
  function cleanResearch(ref,civName,ev){
    const by=new Map(),idx=nameIndex(ref),lines=ref?.civs?.[civName]?.lines||[];
    for(const e of ev||[]){
      if(e[1]!=='R'||AGE_LABELS.has(e[2]))continue;
      const r=by.get(e[2]);
      if(!r){by.set(e[2],{label:e[2],at:e[0],first:e[0],last:e[0],commands:1,bursts:1});continue;}
      r.commands++;
      if(e[0]-r.last>5){r.bursts++;r.at=e[0];}
      r.last=e[0];
    }
    const inLines=id=>lines.some(c=>c.indexOf(id)>0);
    return [...by.values()].map(r=>{
      const keys=idx.get(r.label)||[];
      const u=keys.filter(k=>k[0]==='u').map(k=>Number(k.slice(1))).find(inLines);
      if(u!=null)return {...r,kind:'u',id:u,group:'line'};
      const t=keys.find(k=>k[0]==='t'),id=t?Number(t.slice(1)):null,n=t?ref.nodes[t]:null;
      const group=!n?'eco':n.building===103?'smith':ref.tech_effects?.[String(id)]||KEY_TECHS.includes(id)||n.type==='UniqueTech'?'mil':'eco';
      return {...r,kind:t?'t':null,id,group};
    }).sort((x,y)=>x.at-y.at);
  }
  // a side's state at T: age reached, techs and line upgrades commanded by then, unique techs by their age
  function sideState(ref,res,reach,T){
    const age=[4,3,2].find(a=>reach?.[a]!=null&&reach[a]<=T)||1;
    const done=res.filter(r=>r.at<=T);
    const techs=new Set(done.filter(r=>r.kind==='t').map(r=>r.id));
    const uniqueAges=new Set(done.filter(r=>r.kind==='t'&&node(ref,'t',r.id)?.type==='UniqueTech').map(r=>Math.max(3,node(ref,'t',r.id).age||3)));
    return {T,age,techs,uniqueAges,ups:new Set(done.filter(r=>r.kind==='u').map(r=>r.id))};
  }
  const unitAt=(chain,st)=>{let u=chain[0];for(const id of chain.slice(1))if(st.ups.has(id))u=id;return u;};
  // stats with only what the side actually commanded: generic techs it researched, its civ bonus steps by the
  // age it had reached, and unique-tech steps only when it researched its unique tech of that age
  function statActual(ref,civName,id,st){
    const base=stat(ref,id);
    if(!base)return null;
    const s=JSON.parse(JSON.stringify(base));
    s.bonus=s.bonus||{};s.armour_classes=s.armour_classes||{};
    const applied=[];
    for(const [tid,t] of Object.entries(ref.tech_effects||{})){
      if(!st.techs.has(Number(tid)))continue;
      let hit=false;
      for(const [kind,unit,cls,attr,amount] of t.commands||[])
        if(unit===id||unit===-1&&cls>=0&&cls===base.class){applyCmd(s,kind,attr,amount);hit=true;}
      if(hit)applied.push(Number(tid));
    }
    const steps=cleanSteps(ref,civName,id).filter(x=>x[4]==='unique'?st.uniqueAges.has(stepAge(x)):x[0]<=st.age);
    for(const [,attr,kind,amount] of steps)applyCmd(s,kind,attr,amount);
    s.techs=applied;s.civSteps=steps.length;
    return s;
  }
  // production commands in [from, to): army lines (root → count) and villagers
  function produced(ref,civName,list,from,to){
    const idx=nameIndex(ref),lines=ref?.civs?.[civName]?.lines||[],rows=new Map();
    let vill=0;
    for(const e of list){
      if(e[0]<from||e[0]>=to)continue;
      if(e[2]==='Villager'){vill+=e[3];continue;}
      const ids=(idx.get(e[2])||[]).filter(k=>k[0]==='u').map(k=>Number(k.slice(1)));
      const chain=lines.find(c=>ids.some(id=>c.includes(id)))||null,key=chain?chain[0]:e[2];
      const r=rows.get(key)||{root:chain?chain[0]:null,chain,label:e[2],n:0,first:e[0]};
      r.n+=e[3];r.last=e[2];rows.set(key,r);
    }
    return {rows:[...rows.values()].sort((a,b)=>b.n-a.n||a.first-b.first),vill};
  }
  const isArmyRow=(ref,r)=>r.root!=null&&!NON_COMBAT.has(r.root)&&buildingOf(ref,r.root)!==49;
  // a side's main army lines: at least 3 commands and at least a quarter of its biggest line, two at most
  const mainRows=(ref,p)=>{const army=p.rows.filter(r=>isArmyRow(ref,r)),top=army[0]?.n||0;return army.filter(r=>r.n>=3&&r.n>=top/4).slice(0,2);};
  const armyCount=(ref,p)=>p.rows.filter(r=>isArmyRow(ref,r)).reduce((a,r)=>a+r.n,0);
  // each side's own window for an age (Dark Age orders count with Feudal); 'all' = the whole match
  function windowOf(reach,dur,age){
    if(age==='all')return [0,dur];
    const from=age===2?0:reach?.[age];
    if(from==null||from>=dur)return null;
    const next=[3,4,5].filter(a=>a>age).map(a=>reach?.[a]).find(v=>v!=null);
    return [from,Math.min(dur,next??dur)];
  }
  // everything the card needs from both timelines (null when the match has no usable timeline)
  function armyModel(ref,civs,army){
    if(!army||!ref?.civs?.[civs[0]]||!ref?.civs?.[civs[1]])return null;
    const dur=Number(army.dur);
    if(!(dur>0))return null;
    const sides=['mine','theirs'].map((k,i)=>{
      const q=cleanQueue(army.ev?.[k]);
      return {key:k,civ:civs[i],reach:army.reach?.[k]||{},queue:q.list,dup:q.dup,cancel:q.cancel,res:cleanResearch(ref,civs[i],army.ev?.[k]),
        builds:(army.ev?.[k]||[]).filter(e=>e[1]==='B').map(e=>e[0])};
    });
    if(!sides.some(s=>s.queue.length||s.res.length))return null;
    return {dur,sides};
  }
  // one line pair: my line against theirs at each side's own time, with what each had commanded by then
  function linePair(ref,M,mine,theirs,tm,tt){
    const [a,b]=M.sides,sa=sideState(ref,a.res,a.reach,tm),sb=sideState(ref,b.res,b.reach,tt);
    const u=unitAt(mine.chain,sa),v=unitAt(theirs.chain,sb),SU=statActual(ref,a.civ,u,sa),SV=statActual(ref,b.civ,v,sb);
    const p=pair(ref,u,v,SU,SV),q=pair(ref,v,u,SV,SU);
    return {u,v,SU,SV,p,q,mine,theirs,tm,tt};
  }
  function ageView(ref,M,age){
    const [a,b]=M.sides,wa=windowOf(a.reach,M.dur,age),wb=windowOf(b.reach,M.dur,age);
    const pa=wa?produced(ref,a.civ,a.queue,wa[0],wa[1]):null,pb=wb?produced(ref,b.civ,b.queue,wb[0],wb[1]):null;
    const ra=wa?a.res.filter(r=>r.at>=wa[0]&&r.at<wa[1]):[],rb=wb?b.res.filter(r=>r.at>=wb[0]&&r.at<wb[1]):[];
    const pairs=[];
    if(pa&&pb){
      const ma=mainRows(ref,pa),mb=mainRows(ref,pb);
      for(const x of ma)for(const y of mb)pairs.push(linePair(ref,M,x,y,wa[1],wb[1]));
      pairs.sort((x,y)=>y.mine.n*y.theirs.n-x.mine.n*x.theirs.n);
    }
    return {age,wa,wb,pa,pb,ra,rb,pairs:pairs.slice(0,4)};
  }
  // ── APP-19: one side had (almost) no army in an age ──
  // Military = every production command except villagers, trade carts/cogs, fishing and transport ships and monks
  // (monks and missionaries do not hold a fight on their own); siege, petards and warships count.
  const NON_MIL=new Set(['Villager','Trade Cart','Trade Cog','Fishing Ship','Transport Ship','Monk','Missionary']);
  const NON_MIL_ROOTS=new Set([125,128,17,13,545]);
  const isMil=r=>!NON_MIL.has(r.label)&&!NON_MIL_ROOTS.has(r.root);
  const milRows=p=>p.rows.filter(isMil);
  const milCount=p=>milRows(p).reduce((a,r)=>a+r.n,0);
  // thresholds: "few" = 2 commands or fewer; a side lacks an army when the other made 5 or more and it made
  // 2 or fewer, or under a quarter of that while still 10 or fewer (too few to be an army; 53 against 345 is two
  // armies and keeps the line comparison); both sides "few" counts when the age lasted 2 minutes or more
  const GAP={few:2,many:5,ratio:0.25,small:10,minSpan:120};
  function armyGap(V){
    if(!V.pa||!V.pb)return null;
    const n=[milCount(V.pa),milCount(V.pb)],span=[V.wa[1]-V.wa[0],V.wb[1]-V.wb[0]];
    const lacks=(x,y,t)=>t>=GAP.minSpan&&y>=GAP.many&&(x<=GAP.few||x<y*GAP.ratio&&x<=GAP.small);
    const kind=lacks(n[0],n[1],span[0])?'mine':lacks(n[1],n[0],span[1])?'theirs':n[0]<=GAP.few&&n[1]<=GAP.few&&Math.min(...span)>=GAP.minSpan?'both':null;
    if(!kind)return null;
    const vill=[V.pa.vill,V.pb.vill],share=n.map((x,i)=>x+vill[i]?x/(x+vill[i]):0),perMin=n.map((x,i)=>span[i]>0?x/(span[i]/60):0);
    return {kind,n,few:kind==='both'||n[kind==='mine'?0:1]<=GAP.few,share,perMin,span};
  }
  // a line is named by the unit its latest command named (Light Cavalry commands → 경기병), else by its root
  const rowName=(ref,r)=>{if(r.root==null)return r.label;const id=(r.chain||[]).find(u=>node(ref,'u',u)?.name===r.last);return unitName(ref,id??r.root);};
  const milList=(ref,p,k=3)=>milRows(p).slice(0,k).map(r=>`${rowName(ref,r)} ${r.n}`).join('·');
  // the opponent's (or my) army in a window: first military command and the busiest 5-minute band
  function milTiming(queue,win){
    const ev=queue.filter(e=>e[0]>=win[0]&&e[0]<win[1]&&!NON_MIL.has(e[2]));
    if(!ev.length)return null;
    const band=new Map();
    for(const e of ev){const f=Math.floor(e[0]/300)*300;band.set(f,(band.get(f)||0)+e[3]);}
    const peak=[...band.entries()].sort((x,y)=>y[1]-x[1]||x[0]-y[0])[0];
    return {first:ev[0][0],peak:{from:peak[0],to:Math.min(win[1],peak[0]+300),n:peak[1]},bands:band.size};
  }
  // the card header's 흐름 when the decided age had an army gap: counts first, then where my production went
  // (the age tab's box carries the full sentence, so this one adds rather than repeats)
  function gapFlow(ref,M,V,g,result){
    const ageKo=AGE_KO[V.age],count=`${ageKo}시대 군사 생산 명령은 나 ${g.n[0]} · 상대 ${g.n[1]}`;
    if(g.kind==='both')return `${ageKo}시대엔 양쪽 모두 병력이 거의 없었어요(군사 생산 명령 나 ${g.n[0]} · 상대 ${g.n[1]}).`;
    if(g.kind==='theirs')return `${count} — ${g.few?'상대 병력이 거의 없던':'상대 병력이 크게 모자랐던'} 시대예요.`;
    const builds=(M.sides[0].builds||[]).filter(t=>t>=V.wa[0]&&t<V.wa[1]).length;
    const went=[V.pa.vill?`주민 ${V.pa.vill}`:'',builds?`건물 ${builds}`:''].filter(Boolean).join('·');
    const lost=g.few?'병력이 없던 게 가장 큰 패인으로 보여요':'병력이 크게 모자랐던 게 큰 패인으로 보여요';
    const intoWord=went?`내 생산은 ${went}개 명령에 갔`:'';
    if(result==='loss')return `${count} — ${intoWord?intoWord+'고, ':''}${lost}.`;
    if(result==='win')return `${count} — ${g.few?'병력이 거의 없었는데도':'병력이 크게 모자랐는데도'} 이긴 경기예요.`;
    return `${count}${intoWord?` — ${intoWord}어요`:''}.`;
  }
  // one plain sentence. result: 'win' | 'loss' | anything else (unknown); decided: this is the age that decided the match
  function gapSentence(ref,V,g,decided,result){
    const ageWord=`${AGE_KO[V.age]}시대${decided?'(이 경기를 가른 시대)':''}`;
    if(g.kind==='both')return `${ageWord}엔 양쪽 모두 병력이 거의 없었어요(군사 생산 명령 나 ${g.n[0]} · 상대 ${g.n[1]})`;
    if(g.kind==='theirs')return g.few?`${ageWord}에 상대는 병력이 거의 없었어요(군사 생산 명령 ${g.n[1]}, 내 쪽은 ${milList(ref,V.pa)})`
      :`${ageWord}에 상대 병력이 크게 모자랐어요(군사 생산 명령 ${g.n[1]} 대 내 ${g.n[0]})`;
    const tail=result==='loss'?(decided?(g.few?'병력이 없던 게 가장 큰 패인으로 보여요':'병력이 크게 모자랐던 게 큰 패인으로 보여요')
        :(g.few?'이 시대엔 상대만 병력을 모았어요':'이 시대엔 병력이 크게 모자랐어요'))
      :result==='win'&&decided?(g.few?'병력이 거의 없었는데도 이긴 경기예요':'병력이 크게 모자랐는데도 이긴 경기예요')
      :(g.few?'이 시대엔 상대만 병력을 모았어요':'이 시대엔 병력 차이가 컸어요');
    return `${ageWord}에 내 군사 생산 명령은 ${g.n[0]}, 상대는 ${milList(ref,V.pb)} — ${tail}`;
  }
  // "흐름": one modest sentence from the decisive age's facts only (command counts, the opponent's line upgrades
  // and new main lines, attack/armour upgrade levels on the main lines)
  function flowSentence(ref,M,openAge,result){
    const age=AGES.includes(openAge)?openAge:3,[a,b]=M.sides;
    // APP-19: when one side had (almost) no army in the decided age, that is the point of the match
    const GV=ageView(ref,M,age),G=armyGap(GV);
    if(G)return gapFlow(ref,M,GV,G,result);
    const first=g=>{const v=[a.reach?.[g],b.reach?.[g]].filter(x=>x!=null);return v.length?Math.min(...v):null;};
    const start=first(age);
    if(start==null||start>=M.dur)return '';
    const end=Math.min(M.dur,[age+1,age+2].map(first).find(v=>v!=null)??M.dur),mid=Math.min(end,start+300);
    const P=(s,f,t)=>produced(ref,s.civ,s.queue,f,t);
    const all=[P(a,start,end),P(b,start,end)],early=[P(a,start,mid),P(b,start,mid)],late=[P(a,mid,end),P(b,mid,end)];
    const n=all.map(p=>armyCount(ref,p)),n0=early.map(p=>armyCount(ref,p)),n1=late.map(p=>armyCount(ref,p));
    if(n[0]+n[1]<3)return '';
    const lead=x=>{const r=mainRows(ref,x).concat(x.rows.filter(r=>isArmyRow(ref,r)))[0];return r?unitName(ref,r.root):'';};
    const ageKo=AGE_KO[age],clauses=[];
    let countClause='';
    if(end-mid>=180&&n0[0]+n0[1]>=3&&n1[0]+n1[1]>=3&&(n0[0]-n0[1])*(n1[0]-n1[1])<0&&Math.abs(n0[0]-n0[1])>=3&&Math.abs(n1[0]-n1[1])>=3){
      const meFirst=n0[0]>n0[1];
      countClause=`${ageKo} 초반(${minute(start)}~${minute(mid)})엔 ${meFirst?'내':'상대'} 군사 생산 명령이 더 많았지만(${lead(early[meFirst?0:1])} 위주), 뒤로 갈수록 ${meFirst?'상대':'내'} 쪽이 더 많았고`;
    }else if(Math.abs(n[0]-n[1])<Math.max(5,0.2*Math.max(n[0],n[1])))countClause=`${ageKo}시대 군사 생산 명령은 비슷했고(${n[0]} 대 ${n[1]})`;
    else{
      const meMore=n[0]>n[1];
      countClause=`${ageKo}시대 군사 생산 명령은 ${meMore?'내':'상대'} 쪽이 더 많았{BUT}(${n[0]} 대 ${n[1]}, ${lead(all[meMore?0:1])} 위주)`;
    }
    clauses.push(countClause);
    // the opponent's line upgrades and new main lines in that age
    const events=[];
    const armyUnit=id=>{const c=(ref.civs[b.civ].lines||[]).find(l=>l.includes(id));return c&&!NON_COMBAT.has(c[0])&&buildingOf(ref,c[0])!==49;};
    for(const r of b.res)if(r.kind==='u'&&armyUnit(r.id)&&r.at>=start&&r.at<end)events.push([r.at,`${minute(r.at)} ${unitName(ref,r.id)} 업그레이드`]);
    // a line is new in the age when it had fewer than 3 commands before it
    const before=produced(ref,b.civ,b.queue,0,start).rows;
    for(const r of mainRows(ref,all[1]))if(r.first>=start+60&&(before.find(x=>x.root===r.root)?.n||0)<3)events.push([r.first,`${minute(r.first)}부터 ${unitName(ref,r.root)} 생산`]);
    events.sort((x,y)=>x[0]-y[0]);
    if(events.length)clauses.push(`상대 쪽엔 ${events.slice(0,3).map(e=>e[1]).join(', ')} 명령이 있었고`);
    // attack / armour upgrade levels on each side's main lines by the end of the age
    const mains=[mainRows(ref,all[0]),mainRows(ref,all[1])];
    const st=[sideState(ref,a.res,a.reach,end),sideState(ref,b.res,b.reach,end)];
    // per main unit, the attack (armour) upgrades that apply to it; a side's level = its best-upgraded main unit
    const applied=i=>mains[i].map(r=>statActual(ref,M.sides[i].civ,unitAt(r.chain,st[i]),st[i])?.techs||[]);
    const ap=[applied(0),applied(1)],ups=[];
    for(const [kind,set] of [['공격',ATTACK_TECHS],['방어',ARMOUR_TECHS]]){
      if(!mains[0].length||!mains[1].length)continue;
      const best=ap.map(list=>list.map(t=>t.filter(x=>set.has(x))).sort((x,y)=>y.length-x.length)[0]||[]);
      if(best[0].length===best[1].length)continue;
      const hi=best[0].length>best[1].length?0:1,lo=1-hi,extra=best[hi].filter(t=>!best[lo].includes(t)).slice(-(best[hi].length-best[lo].length)).map(t=>techName(ref,t));
      ups.push(best[lo].length===0?`${kind} 업그레이드(${extra.join('·')})는 ${hi?'상대':'나'}만`:`${kind} 업그레이드는 ${hi?'상대':'내'}가 ${best[hi].length-best[lo].length}단계 더(${extra.join('·')})`);
    }
    const more=n[0]>n[1]?0:1,ahead=[];
    for(const [,set] of [['공격',ATTACK_TECHS],['방어',ARMOUR_TECHS]]){
      const best=ap.map(list=>Math.max(0,...list.map(t=>t.filter(x=>set.has(x)).length)));
      if(best[0]!==best[1])ahead.push(best[0]>best[1]?0:1);
    }
    const big=mains[0][0]&&mains[1][0]?linePair(ref,M,mains[0][0],mains[1][0],end,end):null;
    const behind=ahead.includes(1-more)||big&&(more===0?big.p.edge<0:big.p.edge>0);
    clauses[0]=clauses[0].replace('{BUT}',behind?'지만':'고');
    if(ups.length)clauses.push(ups.join(' 했고, ')+' 했어요');
    if(!clauses.length)return '';
    // the last clause closes the sentence: 많았지만/많았고/있었고 → 많았어요/있었어요
    return clauses.join(', ').replace(/(았|었)(?:지만|고)(\([^)]*\))?$/,'$1어요$2')+'.';
  }
  // ── actual armies: rendering ──
  const WHO={mine:'나',theirs:'상대'};
  const QUEUE_NOTE='명령 기준: 생산 버튼을 누른 수(한 번에 5기 예약은 5) — 취소·자원 부족·죽은 수·남은 수는 리플에 없음';
  // one side's production in a window: line icons with ×N (the unit the line stood at by the window's end) and
  // villagers as a small number; the row's left border is the side colour
  function prodRow(ref,side,prod,win,st){
    if(!prod)return `<div class="mc-prod mc-prod-${side}"><span class="mc-who">${WHO[side]}</span><span class="mc-none">이 시대 도달 안 함</span></div>`;
    const chips=prod.rows.map(r=>{
      if(r.root==null)return `<span class="mc-cnt mc-cnt-text" tabindex="0" data-tip="${esc(`${SIDE_KO[side]} 생산 명령 ${r.n}: ${r.label} (기술표에 없는 이름)`)}">${esc(r.label)} ×${r.n}</span>`;
      const u=st?unitAt(r.chain,st):r.root;
      const tip=[`${SIDE_KO[side]} ${unitName(ref,r.root)} 계열${u!==r.root?` (그때 ${unitName(ref,u)})`:''}`,`생산 명령 ${r.n} · ${mmss(win[0])}~${mmss(win[1])}`,QUEUE_NOTE].join('\n');
      return `<span class="mc-cnt" tabindex="0" data-tip="${esc(tip)}">${icon(ref,'u',u,{side,noTip:true})}<b>×${r.n}</b></span>`;
    }).join('');
    const vill=prod.vill?`<span class="mc-vill" tabindex="0" data-tip="${esc(`${SIDE_KO[side]} 주민 생산 명령 ${prod.vill} (명령 기준)`)}">주민 ${prod.vill}</span>`:'';
    return `<div class="mc-prod mc-prod-${side}"><span class="mc-who">${WHO[side]}</span><span class="mc-cnts">${chips||'<span class="mc-none">군사 생산 명령 없음</span>'}${vill}</span></div>`;
  }
  // my main line against theirs: the winner holds the sword, ×N = how much the same resources favour it
  function pairLine(ref,x){
    const mineWins=x.p.edge>=0,p=mineWins?x.p:x.q,U=unitName(ref,x.u),V=unitName(ref,x.v),e=Math.abs(x.p.edge);
    const who=mineWins?`내 ${U}`:`상대 ${V}`,whoWord=mineWins?U:V;
    const bonus=bonusOf(p)>0?` · 한 대당 +${bonusOf(p)} 추가 피해(${className(ref,p.bonus.parts[0].cls)})`:'';
    const why=Math.pow(2,e)<1.15?'같은 자원 1:1이면 거의 비슷':`같은 자원 1:1이면 ${who}${josa(whoWord,'이','가')} ${times(e)}배 유리${bonus}`;
    const ups=s=>(s?.techs||[]).map(t=>techName(ref,t));
    const side=(label,id,s)=>`${label}: ${statsLine(ref,id,s)}${ups(s).length?` — ${ups(s).join('·')}`:' — 업그레이드 없음'}${s?.civSteps?' (문명 보너스 포함)':''}`;
    const tip=[mineWins?pairTip(ref,x.u,x.v,p,'mine'):pairTip(ref,x.v,x.u,p,'theirs'),
      `기준: 나 ${mmss(x.tm)} · 상대 ${mmss(x.tt)}까지 낸 연구 명령`,side(`내 ${U}`,x.u,x.SU),side(`상대 ${V}`,x.v,x.SV),
      `생산 명령 나 ${x.mine.n} · 상대 ${x.theirs.n}`,'연구는 명령 시각 기준(완료 시각은 리플에 없음), 컨트롤·진형·병력 수는 제외'].join('\n');
    return line(mineWins?'mc-win':'mc-lose',pairVisual(ref,x.u,'mine',x.v,p,!mineWins),`${U} vs ${V}`,why,tip);
  }
  function upgradeTable(ref,ra,rb){
    if(!ra.length&&!rb.length)return '<p class="compact-note">이 구간 연구 명령 없음</p>';
    const chip=(r,side)=>{
      const nm=r.kind==='u'?unitName(ref,r.id):r.kind==='t'?techName(ref,r.id):r.label;
      const tip=[`${SIDE_KO[side]} ${nm}${r.kind==='u'?' 업그레이드':''} — 연구 명령 ${mmss(r.at)}`,
        r.commands>1?`같은 연구 명령 ${r.commands}번(첫 ${mmss(r.first)}) — ${r.bursts>1?'몇 초 넘게 떨어진 반복은 앞 명령이 취소된 것으로 보고 마지막 것':'몇 초 안의 반복은 한 번'}`:'',
        '명령 시각이지 완료 시각이 아님'].filter(Boolean).join('\n');
      const ic=r.kind?icon(ref,r.kind,r.id,{side,noTip:true}):`<span class="mu mu-${side}"><span class="mu-fallback">${esc(nm.slice(0,2))}</span></span>`;
      return `<span class="mc-up" tabindex="0" data-tip="${esc(tip)}">${ic}<small>${mmss(r.at)}</small></span>`;
    };
    const cell=(xs,side)=>xs.length?`<span class="mu-chain">${xs.map(r=>chip(r,side)).join('')}</span>`:'<span class="matchup-none">—</span>';
    const rows=UP_GROUPS.map(([g,label])=>{
      const a=ra.filter(r=>r.group===g),b=rb.filter(r=>r.group===g);
      return a.length||b.length?`<tr><th scope="row">${esc(label)}</th><td>${cell(a,'mine')}</td><td>${cell(b,'theirs')}</td></tr>`:'';
    }).join('');
    return `<div class="table-scroll"><table class="timeline matchup-table matchup-grid mc-uptable"><thead><tr><th scope="col"></th><th scope="col">나</th><th scope="col">상대</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function bandTable(ref,M){
    const rows=[];
    for(let f=0;f<M.dur;f+=300){
      const t=Math.min(M.dur,f+300);
      const cell=s=>{
        const p=produced(ref,s.civ,s.queue,f,t),st=sideState(ref,s.res,s.reach,t);
        const chips=p.rows.filter(r=>r.root!=null).map(r=>`<span class="mc-cnt mc-cnt-sm" tabindex="0" data-tip="${esc(`${SIDE_KO[s.key]} ${unitName(ref,r.root)} 계열 생산 명령 ${r.n} (${mmss(f)}~${mmss(t)})\n${QUEUE_NOTE}`)}">${icon(ref,'u',unitAt(r.chain,st),{side:s.key,noTip:true})}<b>×${r.n}</b></span>`).join('');
        return `<span class="mc-cnts">${chips}${p.vill?`<span class="mc-vill">주민 ${p.vill}</span>`:''}${!chips&&!p.vill?'<span class="matchup-none">—</span>':''}</span>`;
      };
      rows.push(`<tr><th scope="row">${Math.floor(f/60)}~${Math.ceil(t/60)}분</th><td>${cell(M.sides[0])}</td><td>${cell(M.sides[1])}</td></tr>`);
    }
    return `<div class="table-scroll"><table class="timeline matchup-table matchup-grid mc-bands"><thead><tr><th scope="col"></th><th scope="col">나</th><th scope="col">상대</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  // the "실제 병력" block of a tab: both sides' production, main-line pairs, folded upgrades (and 5-minute bands)
  // APP-19: the headline box when one side had (almost) no army in this age — replaces the empty pair section
  function gapBox(ref,M,V,g,opt){
    const [a,b]=M.sides,decided=opt?.decided===V.age,result=opt?.result;
    const head=`<p class="mc-gaphead">${esc(gapSentence(ref,V,g,decided,result))}</p>`;
    const stat=`군사 비중(주민 대비) 나 ${Math.round(g.share[0]*100)}% · 상대 ${Math.round(g.share[1]*100)}% · 분당 군사 명령 나 ${g.perMin[0].toFixed(1)} · 상대 ${g.perMin[1].toFixed(1)}`;
    if(g.kind!=='mine')return `<div class="mc-gapbox mc-gapbox-${g.kind}" tabindex="0" data-tip="${esc(stat+'\n'+QUEUE_NOTE)}">${head}</div>`;
    const sa=sideState(ref,a.res,a.reach,V.wa[1]),sb=sideState(ref,b.res,b.reach,V.wb[1]);
    const row=(label,body)=>`<div class="mc-gaprow"><span class="mc-gaplabel">${esc(label)}</span><span class="mc-cnts">${body}</span></div>`;
    // their army: line icons ×N, when it started and its busiest 5 minutes
    const T=milTiming(b.queue,V.wb);
    const chips=milRows(V.pb).map(r=>r.root==null?`<span class="mc-cnt mc-cnt-text">${esc(r.label)} ×${r.n}</span>`
      :`<span class="mc-cnt" tabindex="0" data-tip="${esc(`상대 ${unitName(ref,r.root)} 계열 생산 명령 ${r.n} · 첫 명령 ${mmss(r.first)}\n${QUEUE_NOTE}`)}">${icon(ref,'u',unitAt(r.chain,sb),{side:'theirs',noTip:true})}<b>×${r.n}</b></span>`).join('');
    const when=T?`<span class="mc-gapwhen">첫 명령 ${mmss(T.first)}${T.bands>1&&T.peak.n>=3?` · 가장 많던 때 ${Math.floor(T.peak.from/60)}~${Math.ceil(T.peak.to/60)}분(${T.peak.n})`:''}</span>`:'';
    // where my production went instead
    const builds=(a.builds||[]).filter(t=>t>=V.wa[0]&&t<V.wa[1]).length;
    const mineChips=milRows(V.pa).map(r=>`<span class="mc-vill">${esc(rowName(ref,r))} ${r.n}</span>`).join('');
    const went=[V.pa.vill?`<span class="mc-vill" tabindex="0" data-tip="${esc(`내 주민 생산 명령 ${V.pa.vill}`)}">주민 ${V.pa.vill}</span>`:'',
      builds?`<span class="mc-vill" tabindex="0" data-tip="${esc(`내 건물 짓기 명령 ${builds} (집·성벽 포함, 명령 기준)`)}">건물 ${builds}</span>`:'',
      V.ra.length?`<span class="mc-vill" tabindex="0" data-tip="${esc(`내 연구 명령 ${V.ra.length}: ${V.ra.map(r=>r.kind==='u'?unitName(ref,r.id):r.kind==='t'?techName(ref,r.id):r.label).join(', ')}`)}">연구 ${V.ra.length}</span>`:'',mineChips].filter(Boolean).join('');
    // what to make then: this age's recommended answers (my lines available then) against what they actually made
    const s=summary(ref,a.civ,b.civ,V.age,madeByRoot(ref,b.civ,opt?.made?.[V.age]));
    const rec=(s?.recommend||[]).map(r=>{const p=r.vs[0];return icon(ref,'u',r.unit,{side:'mine',label:true,tip:pairTip(ref,r.unit,p.target,p,'mine')});}).join('');
    return `<div class="mc-gapbox mc-gapbox-mine">${head}`
      +row('상대 병력',chips+when)+row('내 생산',went||'<span class="mc-none">명령 없음</span>')
      +(rec?row('이때 이걸 뽑았어야',rec):'')
      +`<p class="mc-gapnote" tabindex="0" data-tip="${esc(QUEUE_NOTE)}">${esc(stat)}</p></div>`;
  }
  function armySection(ref,M,age,opt){
    const V=ageView(ref,M,age),[a,b]=M.sides,span=age==='all'?'경기 전체':`${AGE_KO[age]}시대`;
    const g=age==='all'?null:armyGap(V);
    const title=`실제 생산 명령 — ${span}`;
    if(!V.wa&&!V.wb)return section('mc-army','⚔',title,`<p class="mc-none">이 경기에서 ${AGE_KO[age]}시대에 들어간 쪽이 없어요</p>`);
    const sa=V.wa?sideState(ref,a.res,a.reach,V.wa[1]):null,sb=V.wb?sideState(ref,b.res,b.reach,V.wb[1]):null;
    const when=[V.wa?`나 ${mmss(V.wa[0])}~${mmss(V.wa[1])}`:'',V.wb?`상대 ${mmss(V.wb[0])}~${mmss(V.wb[1])}`:''].filter(Boolean).join(' · ');
    const pairs=V.pairs.length?`<h5 class="mc-subhead">주력끼리 1:1 — 그때까지 실제로 낸 업그레이드로</h5><div class="mc-lines">${V.pairs.map(x=>pairLine(ref,x)).join('')}</div>`
      :g?'':'<p class="mc-none mc-subhead">양쪽 다 3기 이상 명령한 군사 계열이 있어야 맞대어 봐요</p>';
    const prods=prodRow(ref,'mine',V.pa,V.wa,sa)+prodRow(ref,'theirs',V.pb,V.wb,sb);
    // when I had no army the box above already shows their army and my production, so the rows fold away
    const folded=g?.kind==='mine';
    const details=`<details class="matchup-more mc-agemore"><summary>${folded?'양쪽 생산 명령 · ':''}업그레이드 연구 명령${age==='all'?' · 5분 단위 생산':''} — ${span}</summary>${folded?prods:''}${upgradeTable(ref,V.ra,V.rb)}`
      +(age==='all'?`<h4 class="matchup-heading">5분 단위 생산 명령</h4>${bandTable(ref,M)}`:'')
      +'<p class="compact-note">아이콘 아래 = 연구 명령 시각(완료 아님). 같은 연구를 몇 초 안에 다시 누른 것은 한 번으로, 한참 뒤 다시 누른 것은 앞 명령이 취소된 것으로 보고 마지막 시각을 써요. 무료로 받는 기술은 명령이 없어 빠져요.</p></details>';
    return section('mc-army','⚔',title,`<p class="mc-when">${esc(when)} · 명령 기준</p>`+(g?gapBox(ref,M,V,g,opt):'')+(folded?'':prods)+pairs+details);
  }
  // ctx (from context()): open = the age this match spent longest in, spent = seconds, made = orders per age
  function cardHtml(ref,mine,theirs,ctx){
    if(!ref?.civs?.[mine]||!ref?.civs?.[theirs])return '';
    const me=civLabel(ref,mine),them=civLabel(ref,theirs);
    const open=AGES.includes(ctx?.open)?ctx.open:3,decided=AGES.includes(ctx?.open)&&ctx.spent>0;
    // APP-17: both sides' actual production and research commands, on top of each age tab and in an "전체" tab
    const M=armyModel(ref,[mine,theirs],ctx?.army),flow=M?flowSentence(ref,M,ctx?.open,ctx?.result):'';
    const opt={decided:decided?ctx.open:null,result:ctx?.result,made:ctx?.made};
    const tabs=AGES.map(a=>`<button type="button" role="tab" class="mc-agetab" data-age="${a}" aria-selected="${a===open}">${AGE_KO[a]}${decided&&a===ctx.open?'<small>이 경기</small>':''}</button>`).join('')
      +(M?'<button type="button" role="tab" class="mc-agetab" data-age="all" aria-selected="false">전체<small>실제 명령</small></button>':'');
    const panels=AGES.map(a=>`<div class="mc-agepanel" role="tabpanel" data-age="${a}" aria-label="${AGE_KO[a]}시대"${a===open?'':' hidden'}>${M?armySection(ref,M,a,opt):''}${agePanel(ref,mine,theirs,a,madeByRoot(ref,theirs,ctx?.made?.[a]))}</div>`).join('')
      +(M?`<div class="mc-agepanel" role="tabpanel" data-age="all" aria-label="경기 전체" hidden>${armySection(ref,M,'all')}</div>`:'');
    const minutes=decided?Math.max(1,Math.round(ctx.spent/60)):0;
    return `<div class="matchup-card"><div class="mc-head"><span class="mc-kicker">MATCHUP · ${esc(me)}</span><strong class="mc-vs">VS ${esc(them)}</strong>`
      +`<span class="mc-legend"><span><span class="mc-key mc-key-mine"></span>초록 = 내 ${esc(me)}</span><span><span class="mc-key mc-key-theirs"></span>빨강 = 상대 ${esc(them)}</span><span>칼끝 = 맞는 쪽</span></span></div>`
      +`<div class="mc-ages" role="tablist" aria-label="시대별 매치업">${tabs}</div>`
      +(decided?`<p class="mc-decided">이 경기는 ${AGE_KO[ctx.open]}시대에서 갈렸어요 — 가장 오래 이어진 시대(약 ${minutes}분)</p>`:'')
      +(flow?`<p class="mc-flow"><b>흐름</b>${esc(flow)}</p>`:'')
      +panels
      +'<p class="mc-note">칼 위 ×N = 칼을 든 쪽이 같은 자원으로 싸울 때 유리한 정도(1:1 처치 시간 × 비용, 원거리 상대는 다가가는 시간 포함). 그 시대에 만들 수 있는 유닛만, 그때까지 할 수 있는 대장간·계열 업그레이드·문명 보너스는 모두 했다고 보고 계산(성에서 하는 연구는 성주시대부터) — 컨트롤·진형·병력 수는 제외. 줄을 누르면 근거 수치.</p></div>';
  }
  function chainCell(ref,l,side){
    if(l.final==null)return '<span class="matchup-none">—</span>';
    return `<span class="mu-chain">${l.chain.map(id=>icon(ref,'u',id,{side,crossed:l.missing.includes(id),tip:`${SIDE_KO[side]} ${unitName(ref,id)}${l.missing.includes(id)?' 없음':''}`})).join('')}</span>`;
  }
  // targetSide: whose units the rows are; the attackers are the other side
  function counterTable(ref,rows,targetTitle,attackerTitle,targetSide){
    if(!rows.length)return '<p class="compact-note">공격 보너스가 있는 조합 없음</p>';
    const attackerSide=other(targetSide);
    const cell=(target,h)=>{
      const why=h.parts.map(x=>`왜: ${sided(ref,target,targetSide)}${josa(unitName(ref,target),'은','는')} '${className(ref,x.cls)}' 방어 클래스를 가짐 → 추가 피해 +${x.amount}`);
      return `<span class="mu-hit">${icon(ref,'u',h.unit,{side:attackerSide,tip:[`${sided(ref,h.unit,attackerSide)} → ${sided(ref,target,targetSide)}`,`타격당 추가 피해 +${h.total} (${parts(ref,h)})`,...why].join('\n')})}<b>+${h.total}</b></span>`;
    };
    return `<div class="table-scroll"><table class="timeline matchup-table matchup-grid"><thead><tr><th scope="col">${esc(targetTitle)}</th><th scope="col">${esc(attackerTitle)}</th></tr></thead><tbody>`
      +rows.map(r=>`<tr><th scope="row">${icon(ref,'u',r.target,{side:targetSide,tip:unitTip(ref,r.target,targetSide)})}</th><td>${r.hits.map(h=>cell(r.target,h)).join('')}</td></tr>`).join('')+'</tbody></table></div>';
  }
  function html(ref,mine,theirs,ctx){
    const title='<div class="summary-label"><span id="civ-matchup-title">문명 매치업 및 전략 복기</span>'+(ref?.game_build?`<small>게임 빌드 ${esc(ref.game_build)} 기술표·유닛 데이터</small>`:'')+'</div>';
    const cmp=compare(ref,mine,theirs);
    if(!cmp){
      const lacking=[mine,theirs].filter(c=>!ref?.civs?.[c]).map(c=>civLabel(ref,c)||'문명 확인 전');
      return `<section class="civ-matchup" aria-labelledby="civ-matchup-title">${title}<p class="compact-note">${ref?`${esc(lacking.join(', '))}: 1v1 랭크 문명 기술표에 없는 문명이라 비교하지 않아요.`:'문명 기술표를 불러오지 못했어요.'}</p></section>`;
    }
    const names=[civLabel(ref,mine),civLabel(ref,theirs)];
    const head=`<thead><tr><th scope="col"></th><th scope="col">나 · ${esc(names[0])}</th><th scope="col">상대 · ${esc(names[1])}</th></tr></thead>`;
    const diff=cmp.lines.filter(l=>l.differs&&(l.a.final!=null||l.b.final!=null));
    const lineRows=diff.map(l=>`<tr><td>${chainCell(ref,l.a,'mine')}</td><td>${chainCell(ref,l.b,'theirs')}</td></tr>`).join('');
    const lineHead=`<thead><tr><th scope="col">나 · ${esc(names[0])}</th><th scope="col">상대 · ${esc(names[1])}</th></tr></thead>`;
    const techRows=cmp.techs.filter(t=>t.group!=='dock'&&(t.a.length||t.b.length)).map(t=>`<tr><th scope="row">${esc(GROUP_KO[t.group]||t.group)}</th>${[t.a,t.b].map((ids,i)=>`<td>${ids.length?`<span class="mu-chain">${ids.map(id=>icon(ref,'t',id,{side:i?'theirs':'mine',crossed:true,tip:`${i?'상대':'나'}: ${techName(ref,id)} 없음`})).join('')}</span>`:'<span class="matchup-none">—</span>'}</td>`).join('')}</tr>`).join('');
    const bonus=cmp.sides.map((s,i)=>`<section class="matchup-bonus-side"><b>${i?'상대':'나'} · ${esc(names[i])}</b>${(s.civ.description||[]).map(r=>r.startsWith('#')?`<b>${esc(r.slice(1))}</b>`:`<span>${esc(r)}</span>`).join('')}</section>`).join('');
    return `<section class="civ-matchup" aria-labelledby="civ-matchup-title">${title}${cardHtml(ref,mine,theirs,ctx)}`
      +`<details class="matchup-more"><summary>자세히 — 계열·기술 비교, 상성 수치, 문명 보너스</summary>`
      +`<h4 class="matchup-heading">병종 계열이 다른 곳 <small>흐린 ✕ = 없음</small></h4>${lineRows?`<div class="table-scroll"><table class="timeline matchup-table matchup-grid matchup-lines">${lineHead}<tbody>${lineRows}</tbody></table></div>`:'<p class="compact-note">공통 병종 계열은 양측 같음</p>'}`
      +`<h4 class="matchup-heading">기술 결손</h4>${techRows?`<div class="table-scroll"><table class="timeline matchup-table matchup-grid">${head}<tbody>${techRows}</tbody></table></div>`:'<p class="compact-note">양측 결손 없음</p>'}`
      +`<h4 class="matchup-heading">상대 병종 ← 공격 보너스를 갖는 내 병종</h4>${counterTable(ref,cmp.counters[0],`상대 · ${names[1]}`,`나 · ${names[0]} (타격당)`,'theirs')}`
      +`<h4 class="matchup-heading">내 병종 ← 공격 보너스를 갖는 상대 병종</h4>${counterTable(ref,cmp.counters[1],`나 · ${names[0]}`,`상대 · ${names[1]} (타격당)`,'mine')}`
      +`<details class="matchup-bonus"><summary>문명 보너스 (게임 문구)</summary><div class="matchup-bonus-grid">${bonus}</div></details>`
      +`<p class="compact-note">아래 두 표는 시대와 상관없이 각 계열의 최종 유닛끼리 방어 클래스별 공격 보너스(공격 − 상대 클래스 방어, 0 미만은 0)만 더한 값이에요. 기본 공격·방어·체력·비용, 대장간·문명 보너스는 넣지 않았어요.</p></details></section>`;
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
    // age tabs of the summary card
    document.addEventListener('click',e=>{
      const tab=e.target instanceof Element?e.target.closest('.civ-matchup .mc-agetab'):null;
      if(!tab)return;
      const card=tab.closest('.matchup-card'),age=tab.dataset.age;
      // keep the tab bar where it was on screen (APP-18): panels differ in height
      const bar=tab.closest('.mc-ages')||tab,before=bar.getBoundingClientRect().top;
      card.querySelectorAll('.mc-agetab').forEach(b=>b.setAttribute('aria-selected',String(b===tab)));
      card.querySelectorAll('.mc-agepanel').forEach(p=>{p.hidden=p.dataset.age!==age;});
      const moved=bar.getBoundingClientRect().top-before,scroller=tab.closest('.review-body')||document.scrollingElement;
      if(moved&&scroller)scroller.scrollTop+=moved;
    });
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
  // From the match: which age to open (the one the match spent longest in, from the first arrival of either
  // player to the next age's first arrival or the end) and the opponent's production orders per age (their own
  // arrivals; Dark Age orders count with Feudal). Missing data → that part is left out.
  const AGE_KEY={2:'봉건',3:'성주',4:'왕정'};
  function context(match){
    if(!match)return null;
    const reach=(m,a)=>{const v=m?.age_checkpoints?.[AGE_KEY[a]]?.reached_seconds;return Number.isFinite(v)?v:null;};
    const first=a=>{const v=[reach(match.mine,a),reach(match.theirs,a)].filter(x=>x!=null);return v.length?Math.min(...v):null;};
    const out={},dur=Number(match.duration);
    if(Number.isFinite(dur)&&dur>0){
      const t={2:first(2),3:first(3),4:first(4),5:null},spent=[];
      for(const a of AGES)if(t[a]!=null&&t[a]<dur)spent.push([a,Math.min(dur,t[a+1]??dur)-t[a]]);
      const best=spent.sort((x,y)=>y[1]-x[1]||y[0]-x[0])[0];
      if(best&&best[1]>0){out.open=best[0];out.spent=Math.round(best[1]);}
    }
    const tl=match.theirs?.full_timeline;
    if(Array.isArray(tl)){
      const r3=reach(match.theirs,3),r4=reach(match.theirs,4),made={2:{},3:{},4:{}};
      for(const e of tl){
        const n=Number(e?.amount);
        if(e?.kind!=='QUEUE'&&e?.kind!=='TRAIN'||!(n>0)||!e.label||e.label==='Villager')continue;
        const a=r4!=null&&e.seconds>=r4?4:r3!=null&&e.seconds>=r3?3:2;
        made[a][e.label]=(made[a][e.label]||0)+n;
      }
      out.made=made;
    }
    // APP-17: both sides' production and research commands, compact (also goes into the placeholder's data attribute)
    const ev=m=>Array.isArray(m?.full_timeline)?m.full_timeline.filter(e=>(e?.kind==='QUEUE'||e?.kind==='TRAIN'||e?.kind==='RESEARCH'||e?.kind==='BUILD')&&e.label&&Number.isFinite(e.seconds))
      .map(e=>e.kind==='RESEARCH'?[e.seconds,'R',e.label]:e.kind==='BUILD'?[e.seconds,'B',e.label]:[e.seconds,'Q',e.label,Number(e.amount)||0]).sort((x,y)=>x[0]-y[0]):null;
    const em=ev(match.mine),et=ev(match.theirs);
    if(Number.isFinite(dur)&&dur>0&&(em||et)){
      const R=m=>({2:reach(m,2),3:reach(m,3),4:reach(m,4)});
      out.army={dur,reach:{mine:R(match.mine),theirs:R(match.theirs)},ev:{mine:em||[],theirs:et||[]}};
    }
    // APP-19: the match result softens or sharpens the no-army sentence ('win' | 'loss'; anything else = unknown)
    if(match.result==='win'||match.result==='loss')out.result=match.result;
    return Object.keys(out).length?out:null;
  }
  // HTML now if the table is loaded; otherwise a placeholder that is filled once it loads.
  // match: {duration, mine: metrics, theirs: metrics} (optional)
  function mount(mine,theirs,match){
    const ctx=context(match);
    if(data)return html(data,mine,theirs,ctx);
    load().then(ref=>{
      if(typeof document==='undefined')return;
      document.querySelectorAll('[data-civ-matchup]').forEach(el=>{
        const [a,b,c]=JSON.parse(el.dataset.civMatchup||'[]');
        el.outerHTML=html(ref,a,b,c);
      });
    });
    return `<section class="civ-matchup" data-civ-matchup="${esc(JSON.stringify([mine,theirs,ctx]))}"><div class="summary-label"><span>문명 매치업 및 전략 복기</span></div><p class="compact-note">문명 기술표를 불러오는 중…</p></section>`;
  }
  const api={lineStatus,bonusVs,pair,compare,summary,html,mount,load,linesAt,statAt,boostAt,context,cardHtml,madeByRoot,
    cleanQueue,cleanResearch,sideState,statActual,produced,armyModel,ageView,flowSentence,armyGap,gapSentence,gapFlow,milTiming,GAP};
  if(typeof module==='object'&&module.exports)module.exports=api;else{global.SSAPOCivMatchup=api;installTips();}
})(typeof window==='undefined'?globalThis:window);
