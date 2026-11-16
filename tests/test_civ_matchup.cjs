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
  const card=html.slice(html.indexOf('matchup-card'),html.indexOf('matchup-more'));
  for(const title of ['피해야 할 병력 구성','상대 핵심 위협','추천 대응','상대 기술적 빈틈'])assert.ok(card.includes(title));
  assert.ok(html.includes('<details class="matchup-more">'));
  const text=card.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  // every row: bold name + one plain sentence, readable without the mouse
  assert.ok(text.includes('아바레스트병만 모으기 몽골인 정예 초원 창기병이 같은 자원이면 2.4배 유리'));
  assert.ok(text.includes('미늘창병 후사르에 한 대당 +32 추가 피해(기병)'));
  assert.ok(text.includes('정예 전투 코끼리 정예 만구다이에 같은 자원이면 6.5배 유리 · 몽골인에는 미늘창병이 없음'));
  assert.ok(text.includes('정예 만구다이 몽골인 보너스로 공격 속도 강화'));
  // gaps: icon + words, four at most, the rest behind one chip
  assert.ok(text.includes('총통병 계열 없음')&&text.includes('미늘창병 없음')&&text.includes('외 2개'));
  assert.strictEqual((card.match(/class="mc-gapchip"/g)||[]).length,4);
  // pairs: both unit icons, a sword (inline SVG) whose point faces the unit being hit
  assert.ok(card.includes('<svg class="mc-sword"'));
  const avoidRow=card.slice(card.indexOf('mc-avoid'),card.indexOf('mc-threat'));
  assert.ok(avoidRow.includes('mc-hit mc-hit-left'));        // their lancer hits my arbalester on the left
  assert.ok(avoidRow.indexOf('mu mu-mine')<avoidRow.indexOf('mu mu-theirs'));
  const threatRow=card.slice(card.indexOf('mc-threat'),card.indexOf('mc-counter'));
  assert.ok(!threatRow.includes('mc-hit-left')&&threatRow.indexOf('mu mu-theirs')<threatRow.indexOf('mu mu-mine'));
  assert.ok(!card.includes('mc-chip'));                      // no arrow-and-number chips left
  assert.ok(card.includes(`src="assets/units/${ref.nodes.u359.icon}.png"`));
  // the row's tooltip: whose unit is whose, why the bonus applies, the 1-on-1 numbers
  assert.ok(card.includes("data-tip=\"내 미늘창병 → 상대 후사르\n타격당 피해 38 (추가 피해 기병 32 포함) · 받는 피해 7\n왜: 상대 후사르는 &#39;기병&#39; 방어 클래스를 가짐 → 내 미늘창병의 추가 피해 +32 적용\n1:1로 잡는 시간: 미늘창병 5.9초 · 후사르 16.3초\n비용 60 · 80 → 같은 자원이면 내 쪽이 ×3.7 유리"));
  assert.ok(card.includes('mc-legend'));
  assert.ok(card.includes('대장간·문명 보너스 수치·컨트롤 제외'));
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
