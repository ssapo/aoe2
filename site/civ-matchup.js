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
  // ctx (from context()): open = the age this match spent longest in, spent = seconds, made = orders per age
  function cardHtml(ref,mine,theirs,ctx){
    if(!ref?.civs?.[mine]||!ref?.civs?.[theirs])return '';
    const me=civLabel(ref,mine),them=civLabel(ref,theirs);
    const open=AGES.includes(ctx?.open)?ctx.open:3,decided=AGES.includes(ctx?.open)&&ctx.spent>0;
    const tabs=AGES.map(a=>`<button type="button" role="tab" class="mc-agetab" data-age="${a}" aria-selected="${a===open}">${AGE_KO[a]}${decided&&a===ctx.open?'<small>이 경기</small>':''}</button>`).join('');
    const panels=AGES.map(a=>`<div class="mc-agepanel" role="tabpanel" data-age="${a}" aria-label="${AGE_KO[a]}시대"${a===open?'':' hidden'}>${agePanel(ref,mine,theirs,a,madeByRoot(ref,theirs,ctx?.made?.[a]))}</div>`).join('');
    const minutes=decided?Math.max(1,Math.round(ctx.spent/60)):0;
    return `<div class="matchup-card"><div class="mc-head"><span class="mc-kicker">MATCHUP · ${esc(me)}</span><strong class="mc-vs">VS ${esc(them)}</strong>`
      +`<span class="mc-legend"><span><span class="mc-key mc-key-mine"></span>초록 = 내 ${esc(me)}</span><span><span class="mc-key mc-key-theirs"></span>빨강 = 상대 ${esc(them)}</span><span>칼끝 = 맞는 쪽</span></span></div>`
      +`<div class="mc-ages" role="tablist" aria-label="시대별 매치업">${tabs}</div>`
      +(decided?`<p class="mc-decided">이 경기는 ${AGE_KO[ctx.open]}시대에서 갈렸어요 — 가장 오래 이어진 시대(약 ${minutes}분)</p>`:'')
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
      card.querySelectorAll('.mc-agetab').forEach(b=>b.setAttribute('aria-selected',String(b===tab)));
      card.querySelectorAll('.mc-agepanel').forEach(p=>{p.hidden=p.dataset.age!==age;});
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
  const api={lineStatus,bonusVs,pair,compare,summary,html,mount,load,linesAt,statAt,boostAt,context,cardHtml,madeByRoot};
  if(typeof module==='object'&&module.exports)module.exports=api;else{global.SSAPOCivMatchup=api;installTips();}
})(typeof window==='undefined'?globalThis:window);
