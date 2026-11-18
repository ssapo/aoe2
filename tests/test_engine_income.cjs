const test=require('node:test');const assert=require('node:assert');
const income=require('../site/engine-income.js');
const curve={source:'engine_resimulation',verified_until_seconds:20,points:[[0,0,0,0,0,0,0,0,0],[10,50,20,0,0,30,40,0,0],[20,120,60,0,0,90,50,0,0]]};
test('summary totals, widest gap and shown resources',()=>{
  const s=income.summary(curve);
  assert.strictEqual(s.own,180);assert.strictEqual(s.opponent,140);
  assert.deepStrictEqual(s.widest,{seconds:20,gap:40});
  assert.deepStrictEqual(s.shown.map(r=>r[0]),['식량','나무']);
});
test('render draws one chart per gathered resource and names the verified span',()=>{
  const html=income.render(curve);
  assert.strictEqual((html.match(/<figure/g)||[]).length,2);
  assert.ok(html.includes('0:20까지 확인됨'));
});
test('missing or malformed data renders nothing',()=>{
  assert.strictEqual(income.render(null),'');
  assert.strictEqual(income.render({points:[[0,1]],verified_until_seconds:5}),'');
  assert.strictEqual(income.render({...curve,verified_until_seconds:undefined}),'');
});
const row=[20,100,50,0,30,20,0,0,10,0,60,0,40,0,0,0,0,10,5];
const withSources={...curve,by_source:{columns:[],points:[[10,1,1,0,1,1,0,0,0,0,1,0,1,0,0,0,0,0,0],row]}};
test('food sources: amounts, shares and every source row in every match (APP-20)',()=>{
  const s=income.sources(withSources);
  assert.strictEqual(s.seconds,20);
  assert.deepStrictEqual(s.own.food,[100,50,30,20,0,0]);
  assert.deepStrictEqual(s.foodShown.map(r=>r[0]),['가축','사냥','열매','농장','물고기','기타']);
  const html=income.render(withSources);
  assert.ok(html.includes('식량 출처'));assert.ok(html.includes('나 · 200'));assert.ok(html.includes('상대 · 100'));
  assert.ok(html.includes('width:50%'));assert.ok(html.includes('0:20까지'));
  assert.ok(html.includes('물고기'));
  assert.ok(html.includes('금 출처'));assert.ok(html.includes('금광'));
});
test('a source set up by the counted time is still known (setUp); every row is listed anyway',()=>{
  const early=[20,100,50,0,0,0,0,0,0,0,60,40,0,0,0,0,0,0,0];
  const d={...curve,by_source:{points:[early]}};
  const set=timelines=>[...income.sources(d,timelines).setUp].sort();
  assert.deepStrictEqual(set(),[]);
  assert.deepStrictEqual(set([[{seconds:12,kind:'BUILD',label:'Farm'}],[]]),[3]);
  assert.deepStrictEqual(set([[],[{seconds:20,kind:'BUILD',label:'Mill'}]]),[2]);
  assert.deepStrictEqual(set([[{seconds:21,kind:'BUILD',label:'Farm'},{seconds:3,kind:'QUEUE',label:'Farm'},{seconds:3,kind:'BUILD',label:'House'},{kind:'BUILD',label:'Mill'},null]]),[]);
  const html=income.render(d);
  assert.ok(html.includes('농장')&&html.includes('열매'));
});
test('gold split is always shown; without the by-source part each block says why',()=>{
  const plain=row.slice();plain[9]=0;plain[18]=0;
  const html=income.render({...curve,by_source:{points:[plain]}});
  assert.ok(html.includes('식량 출처'));assert.ok(html.includes('금 출처'));
  const bare=income.render(curve);
  assert.ok(bare.includes('data-section="food-sources"')&&bare.includes('data-section="gold-sources"')&&bare.includes('이 경기는 출처별 기록이 없어요'));
  for(const d of [{...curve,by_source:{points:[[20,1,2]]}},{...curve,by_source:{points:[row.map((v,i)=>i===3?'<b>':v)]}}])
    assert.ok(income.renderSources(d).includes('section-why'));
});
const animalRows={until_seconds:20,own:[{id:1,kind:'sheep',eaten:86.2,first_seconds:10,last_seconds:20},{id:2,kind:'sheep',eaten:40},{id:5,kind:'boar',eaten:290.4},{id:6,kind:'boar',eaten:281.6},{id:9,kind:'<b>',eaten:12}],opponent:[{id:7,kind:'deer',eaten:103.3},{id:8,kind:'deer',eaten:0},{id:10,kind:'boar',eaten:'x'}]};
test('animals: grouped by kind, one chip per animal, per-kind count and sum; no remainder without the full amount',()=>{
  const s=income.animals({...withSources,animals:animalRows});
  assert.strictEqual(s.seconds,20);
  assert.deepStrictEqual(s.own.map(k=>[k.kind,k.rows.length,Math.round(k.eaten),k.full]),[['sheep',2,126,null],['hunt',2,572,null],['other',1,12,null]]);
  assert.deepStrictEqual(s.opponent.map(k=>[k.kind,k.rows.length]),[['hunt',1]]);
  const html=income.render({...withSources,animals:animalRows});
  assert.ok(html.includes('동물별 먹은 양'));assert.ok(html.includes('사냥 2마리</b> · 572'));assert.ok(html.includes('나 · 5마리'));assert.ok(html.includes('상대 · 1마리'));
  assert.strictEqual((html.match(/<li>/g)||[]).length-(income.render(withSources).match(/<li>/g)||[]).length,6);
  assert.ok(html.includes('0:20까지'));assert.ok(html.includes('확인된 시각까지만'));
  assert.ok(!html.includes('남김'));assert.ok(!html.includes(' / '));assert.ok(!html.includes('<b>'+'</b>'));assert.ok(!/<b>[^<]*<b>|NaN|undefined/.test(html));
});
test('animals: the uneaten part shows only when the full amount is known and at least a fifth was left',()=>{
  const d={...withSources,animals:{until_seconds:20,own:[{id:5,kind:'boar',eaten:286,full:340},{id:6,kind:'boar',eaten:200,full:340}],opponent:[]}};
  const html=income.renderAnimals(d);
  assert.ok(html.includes('사냥 2마리</b> · 486 / 680'));
  assert.strictEqual((html.match(/class="left"/g)||[]).length,1);assert.ok(html.includes('남김 140'));assert.ok(!html.includes('남김 54'));
  assert.ok(html.includes('먹은 동물 없음'));
});
test('animals: absent or empty data keeps the block with why, and the rest as it was',()=>{
  assert.ok(income.renderAnimals(withSources).includes('동물별 기록이 없는 예전 분석이에요'));
  assert.ok(income.renderAnimals({animals:{until_seconds:20,own:[],opponent:[]}}).includes('확인된 구간(0:20) 안에 일꾼이 식량을 가져온 동물이 없어요'));
  assert.ok(income.renderAnimals({animals:{own:[{kind:'sheep',eaten:5}]}}).includes('data-section="animals"'));
  assert.ok(income.render(withSources).includes('data-section="animals"'));
});
test('the verified span names the engine that made it, when the result carries it',()=>{
  assert.ok(income.render({...curve,engine_version:{research_commit:'6780a04',patch_sha256:'26c6a1700ef1'}}).includes('0:20까지 확인됨 · 엔진 6780a04'));
  assert.ok(!income.render(curve).includes('엔진 '));
  assert.ok(income.render({...curve,engine_version:{research_commit:'<b>'}}).includes('엔진 &lt;b&gt;'));
});
