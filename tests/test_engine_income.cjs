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
test('food sources: amounts, shares and only the sources someone used',()=>{
  const s=income.sources(withSources);
  assert.strictEqual(s.seconds,20);
  assert.deepStrictEqual(s.own.food,[100,50,0,30,20,0,0]);
  assert.deepStrictEqual(s.foodShown.map(r=>r[0]),['양','멧돼지','사슴','열매','농장']);
  const html=income.render(withSources);
  assert.ok(html.includes('식량 출처'));assert.ok(html.includes('나 · 200'));assert.ok(html.includes('상대 · 100'));
  assert.ok(html.includes('width:50%'));assert.ok(html.includes('0:20까지'));
  assert.ok(!html.includes('물고기'));
  assert.ok(html.includes('금 출처'));assert.ok(html.includes('금광'));
});
test('a source set up by the counted time is listed at zero on both sides; later or unrelated requests are not',()=>{
  const early=[20,100,50,0,0,0,0,0,0,0,60,40,0,0,0,0,0,0,0];
  const d={...curve,by_source:{points:[early]}};
  const shown=timelines=>income.sources(d,timelines).foodShown.map(r=>r[0]);
  assert.deepStrictEqual(shown(),['양','멧돼지']);
  assert.deepStrictEqual(shown([[{seconds:12,kind:'BUILD',label:'Farm'}],[]]),['양','멧돼지','농장']);
  assert.deepStrictEqual(shown([[],[{seconds:20,kind:'BUILD',label:'Mill'}]]),['양','멧돼지','열매']);
  assert.deepStrictEqual(shown([[{seconds:5,kind:'BUILD',label:'Folwark'},{seconds:6,kind:'BUILD',label:'Farm'}],undefined]),['양','멧돼지','열매','농장']);
  assert.deepStrictEqual(shown([[{seconds:21,kind:'BUILD',label:'Farm'},{seconds:3,kind:'QUEUE',label:'Farm'},{seconds:3,kind:'BUILD',label:'House'},{kind:'BUILD',label:'Mill'},null]]),['양','멧돼지']);
  const html=income.render(d,[[{seconds:12,kind:'BUILD',label:'Farm'}]]);
  assert.ok(html.includes('농장'));assert.ok(!html.includes('열매'));
});
test('gold split is hidden when no other gold, and nothing is drawn without the by-source part',()=>{
  const plain=row.slice();plain[9]=0;plain[18]=0;
  const html=income.render({...curve,by_source:{points:[plain]}});
  assert.ok(html.includes('식량 출처'));assert.ok(!html.includes('금 출처'));
  assert.ok(!income.render(curve).includes('income-sources'));
  assert.strictEqual(income.renderSources({...curve,by_source:{points:[[20,1,2]]}}),'');
  assert.strictEqual(income.renderSources({...curve,by_source:{points:[row.map((v,i)=>i===3?'<b>':v)]}}),'');
  assert.strictEqual(income.renderSources({...curve,by_source:{points:[row.map((v,i)=>i?0:v)]}}),'');
});

const animalRows={until_seconds:20,own:[{id:1,kind:'sheep',eaten:86.2,first_seconds:10,last_seconds:20},{id:2,kind:'sheep',eaten:40},{id:5,kind:'boar',eaten:290.4},{id:6,kind:'boar',eaten:281.6},{id:9,kind:'<b>',eaten:12}],opponent:[{id:7,kind:'deer',eaten:103.3},{id:8,kind:'deer',eaten:0},{id:10,kind:'boar',eaten:'x'}]};
test('animals: grouped by kind, one chip per animal, per-kind count and sum; no remainder without the full amount',()=>{
  const s=income.animals({...withSources,animals:animalRows});
  assert.strictEqual(s.seconds,20);
  assert.deepStrictEqual(s.own.map(k=>[k.kind,k.rows.length,Math.round(k.eaten),k.full]),[['sheep',2,126,null],['boar',2,572,null],['other',1,12,null]]);
  assert.deepStrictEqual(s.opponent.map(k=>[k.kind,k.rows.length]),[['deer',1]]);
  const html=income.render({...withSources,animals:animalRows});
  assert.ok(html.includes('동물별 먹은 양'));assert.ok(html.includes('멧돼지 2마리</b> · 572'));assert.ok(html.includes('나 · 5마리'));assert.ok(html.includes('상대 · 1마리'));
  assert.strictEqual((html.match(/<li>/g)||[]).length-(income.render(withSources).match(/<li>/g)||[]).length,6);
  assert.ok(html.includes('0:20까지'));assert.ok(html.includes('확인된 시각까지만'));
  assert.ok(!html.includes('남김'));assert.ok(!html.includes(' / '));assert.ok(!html.includes('<b>'+'</b>'));assert.ok(!/<b>[^<]*<b>|NaN|undefined/.test(html));
});
test('animals: the uneaten part shows only when the full amount is known and at least a fifth was left',()=>{
  const d={...withSources,animals:{until_seconds:20,own:[{id:5,kind:'boar',eaten:286,full:340},{id:6,kind:'boar',eaten:200,full:340}],opponent:[]}};
  const html=income.renderAnimals(d);
  assert.ok(html.includes('멧돼지 2마리</b> · 486 / 680'));
  assert.strictEqual((html.match(/class="left"/g)||[]).length,1);assert.ok(html.includes('남김 140'));assert.ok(!html.includes('남김 54'));
  assert.ok(html.includes('먹은 동물 없음'));
});
test('animals: absent or empty data draws nothing and leaves the rest as it was',()=>{
  assert.strictEqual(income.renderAnimals(withSources),'');
  assert.strictEqual(income.renderAnimals({animals:{until_seconds:20,own:[],opponent:[]}}),'');
  assert.strictEqual(income.renderAnimals({animals:{own:[{kind:'sheep',eaten:5}]}}),'');
  assert.ok(!income.render(withSources).includes('동물별'));
});
