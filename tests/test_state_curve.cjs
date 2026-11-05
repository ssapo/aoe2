const {test}=require('node:test'),assert=require('node:assert/strict');
const {summary,render,valid}=require('../site/state-curve.js');
const curve={points:[[10,600,12,475,11],[400,1500,40,300,45],[2000,1200,200,2100,190]],summary:{float_line:1000,after_seconds:300,own_mean_resources:1350,opponent_mean_resources:1200,own_floating_seconds:645,opponent_floating_seconds:360,largest_swing:{from_seconds:1977,to_seconds:2035,change:31,own_from:170,own_to:203,opponent_from:198,opponent_to:200}}};
test('summary states means, floating time and the swing with its side',()=>{
 const s=summary(curve);
 assert.match(s.lines[0],/나 1,350 · 상대 1,200 \(내가 더 쌓아둠\)/);
 assert.match(s.lines[1],/나 10:45 · 상대 6:00/);
 assert.match(s.lines[2],/32:57~33:55, 나 쪽으로 31/);
});
test('invalid or short curves render nothing',()=>{
 assert.equal(render(null),'');assert.equal(render({points:[[1,2,3,4,5]]}),'');
 assert.equal(valid({points:[[1,2,3,4,'x'],[2,2,3,4,5]]}),false);
});
test('render escapes and draws two charts with both players',()=>{
 const html=render(curve);
 assert.equal((html.match(/<svg /g)||[]).length,2);
 assert.match(html,/state-line mine/);assert.match(html,/state-line theirs/);
 assert.doesNotMatch(html,/NaN|undefined/);
});
