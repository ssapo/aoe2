const test=require('node:test');const assert=require('node:assert');
const fs=require('node:fs');const path=require('node:path');
const cm=require('../site/civ-matchup.js');
const ref=JSON.parse(fs.readFileSync(path.join(__dirname,'../site/data/civ-reference.json'),'utf8'));

test('line status keeps the last available unit and the missing upgrades',()=>{
  const civ={missing_units:[569]};
  assert.deepStrictEqual(cm.lineStatus(civ,[38,283,569]),{root:38,chain:[38,283,569],final:283,top:569,missing:[569],status:'partial'});
  assert.strictEqual(cm.lineStatus({missing_units:[]},[38,283,569]).status,'full');
  assert.strictEqual(cm.lineStatus({missing_units:[329,330]},[329,330]).status,'none');
});

test('attack bonus is attack minus the target class armour, never negative',()=>{
  const fake={unit_stats:{
    1:{bonus:{8:10,30:5},armour_classes:{}},
    2:{bonus:{},armour_classes:{8:3}},
    3:{bonus:{},armour_classes:{30:9}},
    4:{bonus:{},armour_classes:{8:0}, bonus_resist:0.25},
  }};
  assert.deepStrictEqual(cm.bonusVs(fake,1,2),{total:7,parts:[{cls:8,amount:7}]});
  assert.strictEqual(cm.bonusVs(fake,1,3).total,0);
  assert.strictEqual(cm.bonusVs(fake,1,4).total,7.5);
  assert.strictEqual(cm.bonusVs(fake,1,99).total,0);
});

test('real data: halberdier bonus against knights comes from the cavalry class',()=>{
  const hit=cm.bonusVs(ref,359,38);
  assert.strictEqual(hit.total,32);
  assert.deepStrictEqual(hit.parts,[{cls:8,amount:32}]);
});

test('Vietnamese vs Mongols: tech tree differences and counters from the game data',()=>{
  const cmp=cm.compare(ref,'Vietnamese','Mongols');
  assert.ok(cmp);
  // Vietnamese reach Halberdier, Mongols stop at Pikeman
  assert.ok(cmp.edges[0].some(e=>e.kind==='further'&&e.final===359&&e.otherFinal===358));
  // Mongols reach Hussar, Vietnamese stop at Light Cavalry
  assert.ok(cmp.edges[1].some(e=>e.kind==='further'&&e.final===441&&e.otherFinal===546));
  // Bombard Cannon only on the Vietnamese side
  assert.ok(cmp.edges[0].some(e=>e.kind==='only'&&e.final===36));
  // Mongol blacksmith gap is listed with its techs
  const smith=cmp.techs.find(t=>t.group==='blacksmith');
  assert.ok(smith.b.includes(80)&&smith.b.includes(219));
  assert.ok(smith.a.includes(75));
  // counters against Mongol units: army targets come before siege workshop targets
  const rows=cmp.counters[0];
  assert.ok(rows.length>0);
  const firstSiege=rows.findIndex(r=>ref.nodes['u'+r.target].building===49);
  assert.ok(firstSiege===-1||rows.slice(firstSiege).every(r=>ref.nodes['u'+r.target].building===49));
  const hussar=rows.find(r=>r.target===441);
  assert.strictEqual(hussar.hits[0].unit,359);
});

test('html shows the section with game text and escapes it',()=>{
  const html=cm.html(ref,'Vietnamese','Mongols');
  assert.ok(html.includes('문명 매치업 및 전략 복기'));
  assert.ok(html.includes('게임 빌드 188329'));
  assert.ok(html.includes(ref.civs.Vietnamese.description[0]));
  assert.ok(html.includes('대장간·계열 업그레이드·문명 보너스는 모두 했다고 보고 계산'));
  const evil=JSON.parse(JSON.stringify(ref));evil.civs.Vietnamese.description=['<img src=x>'];
  assert.ok(!cm.html(evil,'Vietnamese','Mongols').includes('<img src=x>'));
});

test('a civilization outside the ranked table is not compared',()=>{
  assert.strictEqual(cm.compare(ref,'Spartans','Mongols'),null);
  const html=cm.html(ref,'Spartans','Mongols');
  assert.ok(html.includes('비교하지 않아요'));
  assert.ok(cm.html(null,'Vietnamese','Mongols').includes('불러오지 못했어요'));
});

test('mount gives a placeholder until the table loads, then html',async()=>{
  const placeholder=cm.mount('Vietnamese','Mongols');
  assert.ok(placeholder.includes('data-civ-matchup'));
  await cm.load(); // the placeholder's own load (no data file outside the browser) finishes first
  const loaded=await cm.load(async()=>({ok:true,json:async()=>ref}));
  assert.strictEqual(loaded.game_build,188329);
  assert.ok(!cm.mount('Vietnamese','Mongols').includes('data-civ-matchup'));
});

const ids=rows=>rows.map(r=>r.unit);

test('pair: 1-on-1 kill times, resource for resource, melee walks across the range first',()=>{
  // halberdier against knight: 38 per hit (6 melee + 32 cavalry bonus − 2 armour) against 8 taken
  const p=cm.pair(ref,359,38);
  assert.ok(p.edge>0&&p.approach===0);
  assert.strictEqual(p.bonus.total,32);
  // archer against knight: the knight first walks 4 tiles at 1.35 tiles/s
  const q=cm.pair(ref,4,38);
  assert.ok(Math.abs(q.approach-4/1.35)<0.01);
  assert.ok(Math.abs(cm.pair(ref,38,4).edge+q.edge)<1e-9); // the same fight seen from the other side
});

// Reference matchups the user gave (screens from another site), compared with what the rules compute.
test('Vietnamese vs Mongols: threats are the boosted/unique Mongol lines, gaps favour the elephant',()=>{
  const s=cm.summary(ref,'Vietnamese','Mongols');
  // user: Mangudai, Hussar, Steppe Lancer are the Mongol core — not Heavy Camel or Elite Skirmisher
  assert.deepStrictEqual(new Set(ids(s.threats)),new Set([1372,441,561]));
  assert.ok(!ids(s.threats).includes(330)&&!ids(s.threats).includes(6));
  // Mongols have no Halberdier, so the elephant is not something to avoid; it is recommended
  assert.ok(!ids(s.avoid).includes(1134));
  assert.ok(ids(s.recommend).includes(1134));
  assert.ok(ids(s.recommend).includes(359));
  // avoid: lines the Steppe Lancer beats that beat none of the threats
  for(const a of s.avoid){assert.ok(a.score>=1&&!a.hitsBack);assert.ok(a.answer.edge>=0.5);}
  assert.deepStrictEqual(s.gaps.lines,[5,36]);
  assert.ok(s.gaps.tops.includes(359)&&s.gaps.tops.includes(569));
  assert.ok(s.gaps.techs.includes(80));
});

test('Britons vs Hindustanis: matches the reference threats, counters and gaps',()=>{
  const s=cm.summary(ref,'Britons','Hindustanis');
  // user: Ghulam / Imperial Camel / Hand Cannoneer
  assert.deepStrictEqual(new Set(ids(s.threats)),new Set([1749,207,5]));
  // user: Champion + Halberdier (+ archer support)
  assert.ok(ids(s.recommend).includes(567)&&ids(s.recommend).includes(359));
  // user: no Knight line, no Halberdier
  assert.ok(s.gaps.lines.includes(38));
  assert.ok(s.gaps.tops.includes(359));
  // user said "Longbowman alone / Knight alone"; the rules pick the ranged lines the Ghulam beats hardest
  // (Elite Skirmisher, Heavy Mounted Crossbowman) — same reason (Ghulam against archers), different unit
  for(const a of s.avoid)assert.strictEqual(a.by[0].unit,1749);
});

test('Britons vs Dravidians: matches the reference threats, avoid and knight pressure',()=>{
  const s=cm.summary(ref,'Britons','Dravidians');
  // user: Elite Skirmisher (fast firing) / Elephant Archer / Urumi
  assert.deepStrictEqual(new Set(ids(s.threats)),new Set([875,1737,6]));
  // user: careful with archers alone
  assert.ok(ids(s.avoid).includes(492));
  // user: knights against skirmishers (Britons stop at Cavalier)
  const cav=s.recommend.find(r=>r.unit===283);
  assert.ok(cav&&cav.vs[0].target===6);
  assert.ok(s.gaps.lines.includes(38));
});

test('summary rows are consistent with each other',()=>{
  for(const [a,b] of [['Vietnamese','Mongols'],['Britons','Hindustanis'],['Mongols','Vietnamese'],['Franks','Mongols']]){
    const s=cm.summary(ref,a,b);
    assert.ok(s.threats.length<=3&&s.avoid.length<=2&&s.recommend.length<=3);
    for(const t of s.threats)assert.notStrictEqual(ref.nodes['u'+t.unit].building,49);
    assert.ok(!s.avoid.some(x=>s.recommend.some(r=>r.root===x.root)));
    for(const r of s.recommend)assert.ok(r.beats>=0.5);
  }
});

test('summary card html: rows read as sentences, sword between same-size icons, sides by ring colour',()=>{
  const html=cm.html(ref,'Vietnamese','Mongols');
  const card=html.slice(html.indexOf('matchup-card'),html.indexOf('<details class="matchup-more" data-section="mc-more">'));
  assert.ok(html.includes('<details class="matchup-more" data-section="mc-more">'));
  // without match data the Castle Age panel is open and no "decided" sentence is shown
  const p4=card.slice(card.indexOf('data-age="4" aria-label'));
  assert.ok(card.includes('data-age="3" aria-label="성주시대">')&&card.includes('data-age="4" aria-label="왕정시대" hidden>'));
  // APP-20: the line is always there; without match data it says why
  assert.ok(card.includes('이 경기를 가른 시대를 정할 수 없어요')&&!card.includes('시대에서 갈렸어요'));
  for(const title of ['피해야 할 병력 구성','상대 핵심 위협','추천 대응','상대 기술적 빈틈'])assert.ok(p4.includes(title));
  const text=p4.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<details[\s\S]*?<\/details>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  // every row: bold name + one plain sentence, readable without the mouse (Imperial Age values)
  assert.ok(text.includes('아바레스트병만 모으기 몽골인 정예 만구다이가 같은 자원이면 1.5배 유리'));
  assert.ok(text.includes('미늘창병 후사르에 한 대당 +32 추가 피해(기병)'));
  assert.ok(text.includes('정예 전투 코끼리 정예 만구다이에 같은 자원이면 3.2배 유리 · 몽골인에는 미늘창병이 없음'));
  assert.ok(text.includes('정예 만구다이 몽골인 보너스로 공격 속도 강화'));
  // gaps: icon + words, four at most, the rest behind one chip
  assert.ok(text.includes('총통병 계열 없음')&&text.includes('미늘창병 없음')&&text.includes('외 2개'));
  const p4card=p4.slice(0,p4.indexOf('data-section="mc-calc"'));
  assert.strictEqual((p4card.match(/class="mc-gapchip"/g)||[]).length,4);
  // pairs: both unit icons, a sword (inline SVG) whose point faces the unit being hit
  assert.ok(card.includes('<svg class="mc-sword"'));
  const avoidRow=p4.slice(p4.indexOf('mc-avoid'),p4.indexOf('mc-threat'));
  assert.ok(avoidRow.includes('mc-hit mc-hit-left'));        // their unit hits my arbalester on the left
  assert.ok(avoidRow.indexOf('mu mu-mine')<avoidRow.indexOf('mu mu-theirs'));
  const threatRow=p4.slice(p4.indexOf('mc-threat'),p4.indexOf('mc-counter'));
  assert.ok(!threatRow.includes('mc-hit-left')&&threatRow.indexOf('mu mu-theirs')<threatRow.indexOf('mu mu-mine'));
  assert.ok(!card.includes('mc-chip'));                      // no arrow-and-number chips left
  assert.ok(card.includes(`src="assets/units/${ref.nodes.u441.icon}.png"`));
  // the row's tooltip: whose unit is whose, why the bonus applies, the 1-on-1 numbers with Imperial upgrades
  assert.ok(p4.includes("data-tip=\"내 미늘창병 → 상대 후사르\n타격당 피해 38 (추가 피해 기병 32 포함) · 받는 피해 8\n왜: 상대 후사르는 &#39;기병&#39; 방어 클래스를 가짐 → 내 미늘창병의 추가 피해 +32 적용\n1:1로 잡는 시간: 미늘창병 7.5초 · 후사르 14.3초\n비용 60 · 80 → 같은 자원이면 내 쪽이 ×2.5 유리"));
  assert.ok(card.includes('mc-legend'));
  assert.ok(card.includes('컨트롤·진형·병력 수는 제외'));
  assert.strictEqual(cm.summary(ref,'Spartans','Mongols'),null);
});

test('obvious facts are left out: unique lines and unique upgrades are never compared',()=>{
  const cmp=cm.compare(ref,'Vietnamese','Mongols');
  const unique=id=>ref.nodes['u'+id].type==='UniqueUnit'||ref.nodes['u'+id].building===82;
  for(const l of cmp.lines){assert.ok(!unique(l.root));for(const id of [...l.a.chain,...l.b.chain])assert.notStrictEqual(ref.nodes['u'+id].type,'UniqueUnit');}
  for(const side of cmp.edges)for(const e of side)assert.ok(!unique(e.final));
  // the skirmisher line is the same for both once Imperial Skirmisher (Vietnamese unique upgrade) is left out
  assert.ok(!cmp.lines.find(l=>l.root===7).differs);
  const html=cm.html(ref,'Vietnamese','Mongols');
  assert.ok(!html.includes('상대 기술표에 없음'));
  assert.ok(!html.split('class="matchup-bonus"')[0].includes('고유 기술')); // the game's bonus text may say it
});

test('every icon the section can show is in site/assets',()=>{
  const used=new Set();
  for(const civ of Object.values(ref.civs))for(const line of civ.lines)for(const u of line)used.add(`units/${ref.nodes['u'+u].icon}.png`);
  for(const [k,n] of Object.entries(ref.nodes))if(k[0]==='t')used.add(`techs/${n.icon}.png`);
  const missing=[...used].filter(f=>!fs.existsSync(path.join(__dirname,'../site/assets',f)));
  assert.deepStrictEqual(missing,[]);
});

test('the camel case the user misread: their camel → my cavalry archer, and why it applies',()=>{
  // Mongol Heavy Camel against Vietnamese Heavy Cavalry Archer: the cavalry archer has the cavalry armour class
  const html=cm.html(ref,'Vietnamese','Mongols');
  const tip="상대 중형 낙타 기병 → 내 중형 기마 궁사\n타격당 추가 피해 +18 (기병 18)\n왜: 내 중형 기마 궁사는 &#39;기병&#39; 방어 클래스를 가짐 → 추가 피해 +18";
  assert.ok(html.includes(`data-tip="${tip}"`));
  const i=html.indexOf(`data-tip="${tip}"`);
  assert.ok(html.slice(html.lastIndexOf('<span class="mu',i),i).includes('mu-theirs'));
});

// ── APP-16: threats and answers per age (Feudal / Castle / Imperial) ──
const age=(u)=>ref.nodes['u'+u];
const units=s=>[...s.threats,...s.recommend,...s.avoid].map(x=>x.unit);
test('per age: Feudal vs Mongols is scouts/archer-type, Castle and Imperial bring Mangudai and light cavalry',()=>{
  for(const mine of ['Vietnamese','Britons','Spanish','Franks']){
    const f=cm.summary(ref,mine,'Mongols',2).threats.map(t=>t.unit);
    assert.ok(f.includes(448)||f.some(u=>[0,6].includes(ref.unit_stats[u].class)),`${mine} feudal ${f}`);
    assert.ok(!f.includes(11)&&!f.includes(561));
    for(const a of [3,4]){
      const t=cm.summary(ref,mine,'Mongols',a).threats.map(x=>x.unit);
      assert.ok(t.includes(a===3?11:561),`${mine} age ${a} mangudai ${t}`);
      assert.ok(t.includes(a===3?546:441),`${mine} age ${a} light cavalry ${t}`);
    }
  }
});
test('per age: Feudal Franks threaten with scouts (+20% hit points from Feudal), Castle Britons with archers',()=>{
  for(const mine of ['Britons','Vietnamese','Mongols'])assert.ok(cm.summary(ref,mine,'Franks',2).threats.some(t=>t.unit===448&&t.boost));
  for(const mine of ['Mongols','Franks','Vietnamese']){
    const t=cm.summary(ref,mine,'Britons',3).threats.map(x=>x.unit);
    assert.ok(t.includes(24)||t.includes(8),`${mine}: ${t}`);
  }
});
test('per age, every ranked pair: no castle unique unit in Feudal; answers and threats exist in that age; gaps not from later ages',()=>{
  const civs=Object.keys(ref.civs);
  for(const a of civs)for(const b of civs){
    if(a===b)continue;
    for(const g of [2,3,4]){
      const s=cm.summary(ref,a,b,g);
      if(g===2)for(const u of units(s))assert.ok(age(u).building!==82&&!(age(u).type==='UniqueUnit'&&age(u).age>2),`${a}/${b} feudal ${age(u).name}`);
      const has=(civ,u)=>age(u).age<=g&&!ref.civs[civ].missing_units.includes(u)&&(ref.civs[civ].unlock_ages?.[u]||0)<=g;
      for(const r of s.recommend)assert.ok(has(a,r.unit),`${a}/${b} ${g} answer ${age(r.unit).name}`);
      for(const t of s.threats)assert.ok(has(b,t.unit),`${a}/${b} ${g} threat ${age(t.unit).name}`);
      for(const id of [...s.gaps.lines,...s.gaps.tops])assert.ok(age(id).age<=g);
      for(const id of s.gaps.techs)assert.ok(ref.nodes['t'+id].age<=g);
    }
  }
});
test('per age stats: blacksmith tiers, line techs and civ bonuses by the age (known in-game values)',()=>{
  const st=(c,u,a)=>cm.statAt(ref,c,u,a);
  // Archer in Feudal: Fletching +1 attack/+1 range, Padded Archer Armour +1/+1
  assert.deepStrictEqual([st('Britons',4,2).pierce_attack,st('Britons',4,2).range,st('Britons',4,2).pierce_armour],[5,5,1]);
  // Britons foot archers +1 range in Castle and Imperial, Yeomen +1: Crossbowman 9, Arbalester 11
  assert.strictEqual(st('Britons',24,3).range,9);
  assert.strictEqual(st('Britons',492,4).range,11);
  // Franks cavalry +20% hit points (no Bloodlines): Scout 54 in Feudal, Knight 120 in Castle
  assert.strictEqual(Math.round(st('Franks',448,2).hp),54);
  assert.strictEqual(Math.round(st('Franks',38,3).hp),120);
  // the same unit is weaker earlier: a Feudal Archer has less than a Castle one
  assert.ok(st('Britons',4,2).pierce_attack<st('Britons',4,3).pierce_attack);
  // Mongol cavalry archers fire faster (×0.8) from the start
  assert.ok(st('Mongols',39,3).reload<st('Vietnamese',39,3).reload);
  // a civ that lacks a blacksmith tech does not get it (Mongols: no Ring Archer Armour in Imperial)
  assert.ok(ref.civs.Mongols.missing_techs.includes(219));
  assert.ok(!st('Mongols',39,4).techs.includes(219)&&st('Vietnamese',39,4).techs.includes(219));
});
test('match context: the age played longest opens, production orders per age, nothing without data',()=>{
  const cp=(f,c,i)=>({age_checkpoints:{봉건:{reached_seconds:f},성주:{reached_seconds:c},왕정:{reached_seconds:i}}});
  const theirs={...cp(600,900,2000),full_timeline:[
    {seconds:100,kind:'QUEUE',label:'Militia',amount:3},{seconds:700,kind:'QUEUE',label:'Scout Cavalry',amount:2},
    {seconds:950,kind:'QUEUE',label:'Mangudai',amount:5},{seconds:960,kind:'QUEUE',label:'Villager',amount:5},
    {seconds:2100,kind:'TRAIN',label:'Hussar',amount:4},{seconds:2200,kind:'QUEUE',label:'Hussar',amount:-1}]};
  const ctx=cm.context({duration:2400,mine:cp(620,880,null),theirs});
  assert.strictEqual(ctx.open,3);assert.strictEqual(ctx.spent,1120);
  assert.deepStrictEqual(ctx.made,{2:{Militia:3,'Scout Cavalry':2},3:{Mangudai:5},4:{Hussar:4}});
  assert.strictEqual(cm.context({duration:500,mine:{},theirs:{}}),null);
  assert.strictEqual(cm.context(null),null);
  // the card opens that age, says so in a plain sentence, and puts what they made first with a badge
  const html=cm.html(ref,'Vietnamese','Mongols',ctx);
  assert.ok(html.includes('이 경기는 성주시대에서 갈렸어요 — 가장 오래 이어진 시대(약 19분)'));
  assert.ok(html.includes('data-age="3" aria-selected="true">성주<small>이 경기</small>'));
  assert.ok(html.includes('data-age="2" aria-label="봉건시대" hidden>'));
  const castle=html.slice(html.indexOf('data-age="3" aria-label'),html.indexOf('data-age="4" aria-label'));
  const threats=castle.slice(castle.indexOf('mc-threat'),castle.indexOf('mc-counter'));
  assert.ok(threats.indexOf('만구다이 <span class="mc-made">상대가 실제로 뽑음 ×5</span>')>0);
  assert.strictEqual(cm.summary(ref,'Vietnamese','Mongols',3,{11:5}).threats[0].unit,11);
  // no match data: the reason line instead of the sentence, no badge
  const bare=cm.html(ref,'Vietnamese','Mongols');
  assert.ok(bare.includes('이 경기를 가른 시대를 정할 수 없어요')&&!bare.includes('mc-made'));
  // the placeholder keeps the context for when the table arrives, escaped
  const evil=cm.context({duration:100,mine:cp(10,null,null),theirs:{...cp(10,null,null),full_timeline:[{seconds:20,kind:'QUEUE',label:'<b>x',amount:1}]}});
  assert.ok(!cm.html(ref,'Vietnamese','Mongols',evil).includes('<b>x'));
});
test('lines the opponent made are all kept, even two of one class, and names map to their lines',()=>{
  const made=cm.madeByRoot(ref,'Franks',{'Scout Cavalry':90,Knight:69,'Throwing Axeman':22,Trebuchet:3,Spearman:2});
  assert.strictEqual(made[448],90);assert.strictEqual(made[38],69);
  const t=cm.summary(ref,'Chinese','Franks',4,made).threats.map(x=>x.unit);
  assert.deepStrictEqual(t.slice(0,2),[546,569]); // Franks have no Hussar: Light Cavalry in Imperial, then Paladin
  // a name used by two unit ids (Konnik from the castle and from the Krepost) still finds the line
  assert.ok(Object.keys(cm.madeByRoot(ref,'Bulgarians',{Konnik:20})).length===1);
});

// ── APP-17: both sides' actual production and research commands ──
const Q=(s,label,amount=1)=>({seconds:s,kind:'QUEUE',label,amount});
const R=(s,label)=>({seconds:s,kind:'RESEARCH',label});
const reached=(f,c,i)=>({age_checkpoints:{봉건:{reached_seconds:f},성주:{reached_seconds:c},...(i?{왕정:{reached_seconds:i}}:{})}});
test('production commands: repeated clicks are kept, exact repeats and cancels are not counted',()=>{
  const q=cm.cleanQueue([[10,'Q','Knight',1],[10.4,'Q','Knight',1],[10.42,'Q','Knight',1],[11,'Q','Knight',-1],[12,'R','Forging']]);
  assert.deepStrictEqual(q.list.map(e=>e[0]),[10,10.4]); // 0.4 s apart = a second click, queues one more
  assert.strictEqual(q.dup,1);assert.strictEqual(q.cancel,1);
});
test('research commands: one per tech, a burst of clicks is one, a later repeat replaces a cancelled one',()=>{
  const r=cm.cleanResearch(ref,'Franks',[[441.7,'R','Feudal Age'],[1207.7,'R','Forging'],[1374,'R','Forging'],[1374.2,'R','Forging'],[1895.5,'R','Light Cavalry'],[1895.7,'R','Light Cavalry'],[300,'R','Loom']]);
  const by=Object.fromEntries(r.map(x=>[x.label,x]));
  assert.ok(!by['Feudal Age']);
  assert.strictEqual(by.Forging.at,1374);assert.strictEqual(by.Forging.commands,3);assert.strictEqual(by.Forging.bursts,2);assert.strictEqual(by.Forging.group,'smith');
  assert.deepStrictEqual([by['Light Cavalry'].kind,by['Light Cavalry'].id,by['Light Cavalry'].group,by['Light Cavalry'].commands],['u',546,'line',2]);
  assert.strictEqual(by.Loom.group,'eco');
});
test('actual stats use only the upgrades a side commanded',()=>{
  const st=(res,T,reach={2:500,3:1300})=>cm.sideState(ref,cm.cleanResearch(ref,'Bulgarians',res),reach,T);
  // Konnik without Stirrups keeps its base attack speed; with Stirrups researched it gets the bonus
  assert.strictEqual(cm.statActual(ref,'Bulgarians',1225,st([],2000)).reload,2.4);
  assert.ok(cm.statActual(ref,'Bulgarians',1225,st([[1500,'R','Stirrups']],2000)).reload<2.4);
  const k=cm.statActual(ref,'Bulgarians',1225,st([[1349,'R','Forging'],[2390,'R','Iron Casting']],2500));
  assert.strictEqual(k.melee_attack,14);assert.deepStrictEqual(k.techs.sort(),[67,68]);
  // Franks cavalry hit points from their civ bonus by the age reached, no blacksmith without a command
  const f=cm.statActual(ref,'Franks',38,cm.sideState(ref,[],{2:500,3:1300},1400));
  assert.strictEqual(f.hp,120);assert.strictEqual(f.melee_attack,10);
});
// a small match shaped like 520592057 (Franks knights vs Bulgarian pikemen and Konniks)
const franksBulgarians=()=>{
  const mine={...reached(570,1427),full_timeline:[Q(100,'Villager'),Q(630,'Scout Cavalry'),Q(640,'Scout Cavalry'),Q(650,'Scout Cavalry'),R(1374,'Forging'),R(1374.2,'Forging'),
    ...[1442,1442.4,1456,1456.4,1491,1491.4,1501,1501.4,1551,1551.4,1642,1642.4,1712,1712.4,1755,1755.4,1799,1799.4].map(s=>Q(s,'Knight')),R(1862,'Chain Barding Armor')]};
  const theirs={...reached(575,1381),full_timeline:[Q(627,'Spearman'),Q(762,'Spearman'),Q(846,'Spearman'),R(1349,'Forging'),R(1384,'Pikeman'),Q(1765,'Spearman',5),
    Q(1703,'Konnik'),Q(1703.2,'Konnik'),Q(1771,'Konnik'),Q(1805,'Konnik'),Q(1842,'Konnik'),R(2390,'Iron Casting'),Q(2400,'<b>x',1)]};
  return {duration:2519,mine,theirs};
};
test('actual armies per age: both sides, main-line pairs at the upgrades each had, and the flow sentence',()=>{
  const ctx=cm.context(franksBulgarians());
  const M=cm.armyModel(ref,['Franks','Bulgarians'],ctx.army);
  const castle=cm.ageView(ref,M,3);
  assert.strictEqual(castle.pa.rows[0].root,38);assert.strictEqual(castle.pa.rows[0].n,18);
  assert.deepStrictEqual(castle.pb.rows.slice(0,2).map(r=>[r.root,r.n]),[[1225,5],[93,5]]); // a tie keeps the earlier line first
  const pike=castle.pairs.find(p=>p.v===358);
  assert.ok(pike&&pike.u===38&&pike.p.edge<0,'knight vs pikeman favours the pikeman'); // Pikeman research → the line stands at Pikeman
  const kon=castle.pairs.find(p=>p.v===1225);
  assert.strictEqual(kon.SV.melee_attack,14);assert.strictEqual(kon.SV.reload,2.4);assert.strictEqual(kon.SU.hp,120);
  const feudal=cm.ageView(ref,M,2);
  assert.deepStrictEqual(feudal.pa.rows.map(r=>r.root),[448]);assert.strictEqual(feudal.pa.vill,1);
  assert.strictEqual(cm.ageView(ref,M,4).wa,null);
  const flow=cm.flowSentence(ref,M,3);
  // the first five minutes are mine (knights), the rest theirs (pikemen ×5, Konniks)
  assert.ok(flow.startsWith('성주 초반(23분~28분)엔 내 군사 생산 명령이 더 많았지만(기사 위주), 뒤로 갈수록 상대 쪽이 더 많았고, '),flow);
  assert.ok(flow.includes('23분 장창병 업그레이드')&&flow.includes('28분부터 콘니크 생산'),flow);
  assert.ok(flow.endsWith('공격 업그레이드는 상대가 1단계 더(철 거푸집) 했고, 방어 업그레이드(체인 마갑)는 나만 했어요.'),flow);
  const html=cm.html(ref,'Franks','Bulgarians',ctx);
  assert.ok(html.includes('data-age="all"')&&html.includes('mc-prod-mine')&&html.includes('mc-prod-theirs')&&html.includes('명령 기준'));
  assert.ok(html.includes('<p class="mc-flow" data-section="mc-flow"><b>흐름</b>'));
  assert.ok(!html.includes('<b>x')&&html.includes('&lt;b&gt;x ×1'));
  assert.ok(!/생존 병력|생산한 유닛|뽑은 유닛 수/.test(html));
});
test('no timeline: the actual-army block, the "전체" tab and the flow line stay with the reason (APP-20)',()=>{
  const ctx=cm.context({duration:2000,mine:reached(500,1300),theirs:reached(510,1290)});
  assert.ok(!ctx?.army);
  const html=cm.html(ref,'Franks','Bulgarians',ctx);
  assert.ok(html.includes('data-age="all"')&&html.includes('data-section="mc-army"')&&html.includes('data-section="mc-flow"'));
  assert.ok(html.includes('생산 명령 기록이 없어 병력을 비교할 수 없어요')&&html.includes('생산 명령 기록이 없어 흐름 문장을 만들 수 없어요'));
});
// ── APP-19: one side had (almost) no army in an age ──
const repeat=(from,step,n,label,amount=1)=>Array.from({length:n},(_,i)=>Q(from+i*step,label,amount));
// Franks (me) vs Mongols, Castle Age from ~10 min to 25 min; Feudal from 0 to ~10 min
const noArmy=(myArmy,theirArmy,extra={})=>{
  const mine={...reached(400,600),full_timeline:[...repeat(20,25,20,'Villager'),...repeat(610,20,30,'Villager'),
    {seconds:700,kind:'BUILD',label:'House'},{seconds:720,kind:'BUILD',label:'University'},R(800,'Wheelbarrow'),...myArmy].sort((a,b)=>a.seconds-b.seconds)};
  const theirs={...reached(390,620),full_timeline:[...repeat(20,25,20,'Villager'),...theirArmy].sort((a,b)=>a.seconds-b.seconds)};
  return {duration:1500,mine,theirs,...extra};
};
const castleKnights=[...repeat(700,30,11,'Knight'),...repeat(1210,20,4,'Light Cavalry')];
test('APP-19 thresholds: me none, opponent none, both little, and two real armies are not a gap',()=>{
  const view=(m,age=3)=>{const ctx=cm.context(m);const M=cm.armyModel(ref,['Franks','Mongols'],ctx.army);return cm.ageView(ref,M,age);};
  const me=cm.armyGap(view(noArmy([],castleKnights)));
  assert.strictEqual(me.kind,'mine');assert.deepStrictEqual(me.n,[0,15]);assert.ok(me.few);
  assert.strictEqual(me.share[0],0);assert.ok(me.perMin[1]>0.9&&me.perMin[1]<1.1,String(me.perMin[1]));
  // 2 commands is still "none"; 6 against 30 (under a quarter, 10 or fewer) is "short"; 8 against 30 is not
  assert.strictEqual(cm.armyGap(view(noArmy(repeat(800,10,2,'Archer'),castleKnights))).kind,'mine');
  const short=cm.armyGap(view(noArmy(repeat(800,10,6,'Archer'),[...castleKnights,...castleKnights.map(e=>({...e,seconds:e.seconds+5}))])));
  assert.strictEqual(short.kind,'mine');assert.ok(!short.few);
  assert.strictEqual(cm.armyGap(view(noArmy(repeat(800,10,8,'Archer'),[...castleKnights,...castleKnights.map(e=>({...e,seconds:e.seconds+5}))]))),null);
  // a big army against a bigger one is two armies (pairs stay)
  assert.strictEqual(cm.armyGap(view(noArmy(repeat(700,2,40,'Archer'),repeat(700,1,170,'Knight')))),null);
  const them=cm.armyGap(view(noArmy(castleKnights.map(e=>({...e})),[Q(900,'Mangudai')])));
  assert.strictEqual(them.kind,'theirs');assert.deepStrictEqual(them.n,[15,1]);
  const both=cm.armyGap(view(noArmy([Q(900,'Archer')],[Q(950,'Mangudai'),Q(960,'Monk',3)])));
  assert.strictEqual(both.kind,'both');assert.deepStrictEqual(both.n,[1,1]); // monks are not counted as army
  // villagers, trade carts, fishing ships do not count; siege does
  assert.strictEqual(cm.armyGap(view(noArmy([Q(900,'Trade Cart',4),Q(910,'Fishing Ship',5)],[...castleKnights,Q(900,'Battering Ram',2)]))).n.join(),'0,17');
});
test('APP-19 sentence and card: me none in the decided age leads the block and the flow; softened for a win',()=>{
  const ctx=cm.context(noArmy([],castleKnights,{result:'loss'}));
  assert.strictEqual(ctx.result,'loss');assert.strictEqual(ctx.open,3);
  const M=cm.armyModel(ref,['Franks','Mongols'],ctx.army),V=cm.ageView(ref,M,3),g=cm.armyGap(V);
  assert.strictEqual(cm.gapSentence(ref,V,g,true,'loss'),'성주시대(이 경기를 가른 시대)에 내 군사 생산 명령은 0, 상대는 기사 11·경기병 4 — 병력이 없던 게 가장 큰 패인으로 보여요');
  assert.ok(cm.gapSentence(ref,V,g,true,'win').endsWith('병력이 거의 없었는데도 이긴 경기예요'));
  assert.ok(!/패인/.test(cm.gapSentence(ref,V,g,true,'win'))&&!/패인/.test(cm.gapSentence(ref,V,g,true,undefined)));
  assert.ok(cm.gapSentence(ref,V,g,false,'loss').endsWith('이 시대엔 상대만 병력을 모았어요'));
  assert.strictEqual(cm.flowSentence(ref,M,3,'loss'),'성주시대 군사 생산 명령은 나 0 · 상대 15 — 내 생산은 주민 30·건물 2개 명령에 갔고, 병력이 없던 게 가장 큰 패인으로 보여요.');
  assert.strictEqual(cm.flowSentence(ref,M,3,'win'),'성주시대 군사 생산 명령은 나 0 · 상대 15 — 병력이 거의 없었는데도 이긴 경기예요.');
  assert.strictEqual(cm.flowSentence(ref,M,3),'성주시대 군사 생산 명령은 나 0 · 상대 15 — 내 생산은 주민 30·건물 2개 명령에 갔어요.');
  const html=cm.html(ref,'Franks','Mongols',ctx);
  const castle=html.slice(html.indexOf('data-age="3" aria-label'),html.indexOf('data-age="4" aria-label'));
  assert.ok(castle.includes('mc-gapbox mc-gapbox-mine'));
  assert.ok(castle.indexOf('mc-gapbox')<castle.indexOf('mc-prod-mine'),'the headline comes before the (folded) production rows');
  assert.ok(castle.includes('첫 명령 11:40')&&castle.includes('주민 30')&&castle.includes('건물 2')&&castle.includes('연구 1'),castle.replace(/<[^>]+>/g,' ').slice(0,900));
  assert.ok(castle.includes('이때 이걸 뽑았어야'));
  // APP-20: the pair section stays, with why it is empty
  assert.ok(castle.includes('주력끼리 1:1')&&castle.includes('내 군사 계열이 3기 미만이라 맞대어 볼 주력이 없어요'));
  // the recommended units are mine and exist for Franks in Castle Age
  const rec=cm.summary(ref,'Franks','Mongols',3,cm.madeByRoot(ref,'Mongols',ctx.made[3])).recommend;
  assert.ok(rec.length>0);
  const avail=new Set(cm.linesAt(ref,'Franks',3).map(l=>l.final));
  for(const r of rec)assert.ok(avail.has(r.unit),String(r.unit));
  assert.ok(html.includes('<p class="mc-flow" data-section="mc-flow"><b>흐름</b>성주시대 군사 생산 명령은 나 0 · 상대 15 — '));
});
test('APP-19 mirror and both: a short line, no empty pair section; two armies keep the pairs',()=>{
  const ctx=cm.context(noArmy(castleKnights.map(e=>({...e})),[Q(900,'Mangudai')],{result:'win'}));
  const html=cm.html(ref,'Franks','Mongols',ctx);
  const castle=html.slice(html.indexOf('data-age="3" aria-label'),html.indexOf('data-age="4" aria-label'));
  assert.ok(castle.includes('mc-gapbox mc-gapbox-theirs')&&castle.includes('상대는 병력이 거의 없었어요(군사 생산 명령 1, 내 쪽은 기사 11·경기병 4)'));
  assert.ok(castle.includes('mc-prod-mine')&&castle.includes('주력끼리 1:1')&&!castle.includes('이때 이걸 뽑았어야'));
  assert.ok(html.includes('<b>흐름</b>성주시대 군사 생산 명령은 나 15 · 상대 1 — 상대 병력이 거의 없던 시대예요.'));
  const both=cm.html(ref,'Franks','Mongols',cm.context(noArmy([Q(900,'Archer')],[Q(950,'Mangudai')])));
  assert.ok(both.includes('<b>흐름</b>성주시대엔 양쪽 모두 병력이 거의 없었어요(군사 생산 명령 나 1 · 상대 1).'));
  // the APP-17 example keeps its pairs and its flow (no gap)
  const fb=cm.context(franksBulgarians()),M=cm.armyModel(ref,['Franks','Bulgarians'],fb.army);
  assert.strictEqual(cm.armyGap(cm.ageView(ref,M,3)),null);
  assert.ok(cm.html(ref,'Franks','Bulgarians',fb).includes('주력끼리 1:1'));
});
test('APP-19 the match result reaches the card through context()',()=>{
  assert.strictEqual(cm.context({duration:100,mine:{},theirs:{},result:'win'}).result,'win');
  assert.strictEqual(cm.context({duration:100,mine:{},theirs:{},result:'unknown'})?.result,undefined);
  const app=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
  assert.ok(app.includes('theirs:other?.metrics,result:m.result}'));
});
