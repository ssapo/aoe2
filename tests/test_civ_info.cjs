const test=require('node:test');const assert=require('node:assert');
const civ=require('../site/civ-info.js');
test('known civilizations have bonus lines and headers render bold',()=>{
  assert.ok(civ.lines('Franks').length>5);
  assert.ok(civ.lines('Maya'));
  const html=civ.html('Franks','프랑크');
  assert.ok(html.includes('<strong class="civ-info-title">프랑크</strong>'));
  assert.ok(/<b>[^<]+:<\/b>/.test(html));
});
test('unknown civilizations give nothing',()=>{
  assert.strictEqual(civ.lines('Spartans'),null);
  assert.strictEqual(civ.html('toString'),'');
});
