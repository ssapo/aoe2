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
  assert.ok(html.includes('생산 명령이지 완료가 아님'));
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

test('summary card rows come from bonus numbers in the table',()=>{
  const s=cm.summary(ref,'Vietnamese','Mongols');
  // threats: at most three, each with its biggest bonus against one of my fully upgraded army lines
  assert.ok(s.threats.length>0&&s.threats.length<=3);
  assert.strictEqual(s.threats[0].unit,330); // Heavy Camel Rider
  assert.strictEqual(s.threats[0].hits[0].total,cm.bonusVs(ref,330,s.threats[0].hits[0].target).total);
  for(const t of s.threats)assert.notStrictEqual(ref.nodes['u'+t.unit].building,49);
  // avoid: hit harder by a threat than it hits back
  for(const a of s.avoid){assert.ok(a.worst>a.dealt);assert.ok(a.by.some(h=>s.threats.some(t=>t.unit===h.unit)));}
  // recommend: halberdier first (full line, +26 against the camel)
  assert.strictEqual(s.recommend[0].unit,359);
  assert.strictEqual(s.recommend[0].vs[0].total,26);
  assert.ok(s.recommend.length<=3&&s.recommend.every(r=>r.score>0));
  assert.ok(!s.avoid.some(a=>s.recommend.some(r=>r.root===a.root)));
  // gaps: Mongols lack hand cannoneer and bombard lines, halberdier and paladin, plate barding
  assert.deepStrictEqual(s.gaps.lines,[5,36]);
  assert.ok(s.gaps.tops.includes(359)&&s.gaps.tops.includes(569));
  assert.ok(s.gaps.techs.includes(80));
});

test('summary card html: four rows of icons, names and numbers in tooltips',()=>{
  const html=cm.html(ref,'Vietnamese','Mongols');
  for(const title of ['피해야 할 단독 병력','상대 핵심 위협','추천 대응','상대 기술적 빈틈'])assert.ok(html.includes(title));
  assert.ok(html.indexOf('matchup-card')<html.indexOf('matchup-more'));
  assert.ok(html.includes('<details class="matchup-more">'));
  // halberdier chip: icon from the table's picture index, name next to it, the +26 relation with its class in the tooltip
  assert.ok(html.includes(`src="assets/units/${ref.nodes.u359.icon}.png"`));
  assert.ok(html.includes('<span class="mu-label">미늘창병</span>'));
  assert.ok(html.includes('data-tip="미늘창병 → 중형 낙타 기병\n타격당 보너스 +26 (낙타 26)"'));
  // gaps are crossed icons with the fact in the tooltip
  assert.ok(html.includes('data-tip="총통병 계열 없음"'));
  assert.ok(html.includes(`class="mu mu-x"`));
  assert.ok(html.includes('대장간·문명 보너스 제외'));
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
