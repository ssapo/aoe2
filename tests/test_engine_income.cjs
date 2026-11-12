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
