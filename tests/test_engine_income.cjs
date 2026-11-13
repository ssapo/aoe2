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
test('gold split is hidden when no other gold, and nothing is drawn without the by-source part',()=>{
  const plain=row.slice();plain[9]=0;plain[18]=0;
  const html=income.render({...curve,by_source:{points:[plain]}});
  assert.ok(html.includes('식량 출처'));assert.ok(!html.includes('금 출처'));
  assert.ok(!income.render(curve).includes('income-sources'));
  assert.strictEqual(income.renderSources({...curve,by_source:{points:[[20,1,2]]}}),'');
  assert.strictEqual(income.renderSources({...curve,by_source:{points:[row.map((v,i)=>i===3?'<b>':v)]}}),'');
  assert.strictEqual(income.renderSources({...curve,by_source:{points:[row.map((v,i)=>i?0:v)]}}),'');
});
