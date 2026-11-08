const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../site/housing.js');
const h={min_block_seconds:10,own:{blocks:[{from_seconds:288.9,to_seconds:306.2,seconds:17.3,population:'15/15'}],blocked_seconds:17.3},opponent:{blocks:[],blocked_seconds:0}};
test('highlight shows only when a side was blocked',()=>{
 const html=H.highlight(h);
 assert.match(html,/봉건 전 인구 막힘 · 추정/);
 assert.match(html,/<strong>0:17<\/strong>/);
 assert.match(html,/상대 없음/);
 assert.match(html,/class="highlight behind"/);
 assert.match(html,/data-open-age="봉건"/);
 assert.equal(H.highlight({own:{blocks:[],blocked_seconds:0},opponent:{blocks:[],blocked_seconds:0}}),'');
 assert.equal(H.highlight(null),'');
});
test('rows list intervals and missing sides',()=>{
 assert.deepEqual(H.rows(h),[['봉건 전 인구 막힘 · 추정','0:17 (4:48~5:06 15/15)','없음']]);
 assert.deepEqual(H.rows({own:null,opponent:h.opponent}),[['봉건 전 인구 막힘 · 추정','—','없음']]);
 assert.deepEqual(H.rows({}),[]);
});
test('opponent blocked longer marks me ahead and text is escaped by the table',()=>{
 const other={...h,opponent:{blocks:[{from_seconds:60,to_seconds:120,seconds:60,population:'<b>'}],blocked_seconds:60}};
 assert.match(H.highlight(other),/class="highlight ahead"/);
 assert.match(H.note(other),/10초보다 짧은/);
 assert.doesNotMatch(H.highlight(other),/NaN|undefined/);
});
