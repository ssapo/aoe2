const {test}=require('node:test'),assert=require('node:assert/strict');
const {summary,render,valid}=require('../site/state-curve.js');
const curve={points:[[10,600,12,475,11],[400,1500,40,300,45],[2000,1200,200,2100,190]],summary:{float_line:1000,after_seconds:300,own_mean_resources:1350,opponent_mean_resources:1200,own_floating_seconds:645,opponent_floating_seconds:360,largest_swing:{from_seconds:1977,to_seconds:2035,change:31,own_from:170,own_to:203,opponent_from:198,opponent_to:200}}};
test('summary recomputes old cached means and skips unobserved gaps',()=>{
 assert.equal(summary(curve).lines.length,0);
 const s=summary({points:[[300,2000,0],[310,0,0],[330,0,0]],summary:curve.summary});
 assert.match(s.lines[0],/나 667 · 상대 0/);
 assert.match(s.lines[1],/나 0:10 · 상대 0:00/);
});
test('invalid or short curves render nothing',()=>{
 assert.equal(render(null),'');assert.equal(render({points:[[1,2,3,4,5]]}),'');
 assert.equal(valid({points:[[1,2,3,'x',5],[2,2,3,4,5]]}),false);
});
test('render escapes and draws one resource chart with both players',()=>{
 const html=render(curve);
 assert.equal((html.match(/<svg /g)||[]).length,1);
 assert.match(html,/state-line mine/);assert.match(html,/state-line theirs/);
 assert.doesNotMatch(html,/NaN|undefined/);
});

test('new resource-only curves match legacy output and ignore object fields',()=>{
 const resource={...curve,points:curve.points.map(p=>[p[0],p[1],p[3]])};
 assert.equal(render(resource),render(curve));
 assert.equal(render({...curve,points:curve.points.map(p=>[p[0],p[1],null,p[3],'unknown'])}),render(resource));
 assert.doesNotMatch(render(curve),/오브젝트|규모|격차가|state-swing/);
});

const {stats,ageStats}=require('../site/state-curve.js');
test('weighted estimates clip at age boundaries and omit long gaps',()=>{
 const p=[[0,2000,500],[10,0,500],[30,1000,500],[100,9999,500]];
 assert.deepEqual(stats(p,1,5,25),{mean:500,floating:5,covered:20});
 assert.deepEqual(stats(p,1,30,100),null);
});
test('each player uses actual arrival not age click; restored games omit age table',()=>{
 const c={points:[[0,2000,500],[10,0,500],[20,1000,500],[30,0,500]]};
 const m={age_checkpoints:{봉건:{command_seconds:1,reached_seconds:15}}};
 const a=ageStats(c,m,1);
 assert.equal(a[0].end,15);assert.equal(a[1].start,15);
 assert.equal(a[1].mean,667);
 assert.equal(ageStats(c,{...m,recording_restored:true},1).length,0);
 assert.match(render(c,m,m),/시대별 보유 자원/);
});
test('negative resources, duplicate timestamps and backwards time are rejected',()=>{
 for(const points of [[[1,-1,2],[2,1,2]],[[1,1,2],[1,2,3]],[[2,1,2],[1,2,3]]])assert.equal(render({points}),'');
});
