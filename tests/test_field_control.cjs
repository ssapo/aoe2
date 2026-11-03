const {test}=require('node:test'),assert=require('node:assert/strict');
const {summarize}=require('../site/field-control.js');
const bases=[{side:'mine',label:'Town Center',x:10,y:50},{side:'theirs',label:'Town Center',x:100,y:50}];
const event=(side,seconds,x,y=50)=>({side,seconds,x,y,kind:'MOVE'});
const data=events=>({size:120,initial_buildings:bases,command_activity:events});
const pair=(t,x)=>[event('mine',t,x),event('theirs',t+1,x+2)];
test('home, central and away samples sum to 100 and direction reverses with the players',()=>{
 const d=data([...pair(1,15),...pair(21,50),...pair(41,95)]),a=summarize(d,60);
 assert.equal(a.total,30);assert.equal(a.enough,true);
 assert.deepEqual(a.seconds,{home:10,middle:10,away:10});
 assert.equal(Object.values(a.percentages).reduce((a,b)=>a+b),100);
 const reversed={...d,initial_buildings:bases.map(b=>({...b,side:b.side==='mine'?'theirs':'mine'})),command_activity:d.command_activity.map(e=>({...e,side:e.side==='mine'?'theirs':'mine'}))};
 const b=summarize(reversed,60);assert.equal(b.seconds.away,a.seconds.home);
});
test('repeated clicks and selection counts cannot multiply a time sample',()=>{
 const base=pair(3,95),a=summarize(data(base),60);
 const repeated=base.flatMap(e=>Array.from({length:30},()=>({...e,selected_count:99})));
 assert.deepEqual(summarize(data(repeated),60),a);assert.equal(a.enough,false);
});
test('same-side, distant, late and invalid targets produce no contact sample',()=>{
 const a=summarize(data([event('mine',1,15),event('mine',2,16),event('theirs',2,100),event('theirs',30,15),event('theirs',3,NaN),event('theirs',4,-1)]),60);
 assert.equal(a.total,0);assert.deepEqual(a.percentages,{home:0,middle:0,away:0});
 assert.equal(summarize({...data([]),initial_buildings:[]},60),null);
 assert.equal(summarize({...data([]),command_activity:undefined},60),null);
});
test('nearby commands across a window boundary match, while simultaneous zones share time',()=>{
 const a=summarize(data([event('mine',9.9,95),event('theirs',10.1,96)]),60);assert.equal(a.total,10);
 const b=summarize(data([...pair(1,15),...pair(1,95)]),60);assert.equal(b.total,10);assert.equal(b.seconds.home,5);assert.equal(b.seconds.away,5);
});
