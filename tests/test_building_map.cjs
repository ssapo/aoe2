const {test}=require('node:test'),assert=require('node:assert/strict');
const {project,visibleBuildings,recentActivity,mount}=require('../site/building-map.js');
test('command circles expire, rewind, and replace the same group without merging players',()=>{
 const e=(seconds,side,group,x=30)=>({seconds,side,group,x,y:40,selected_count:12});
 const data={size:120,command_activity:[e(1,'mine',1),e(10,'mine',1,35),e(10,'theirs',1),e(21,'mine',2),e(15,'mine',3,-1)]};
 assert.equal(recentActivity(data,0).length,0);
 assert.equal(recentActivity(data,5)[0].x,30);
 const active=recentActivity(data,20);assert.equal(active.length,2);assert.equal(active[0].x,35);
 assert.equal(recentActivity(data,40).length,1);
 assert.equal(recentActivity(data,60).length,0);
 assert.equal(recentActivity(data,5)[0].seconds,1);
});
test('time seeking uses targets without inventing future buildings',()=>{
 const data={size:120,initial_buildings:[{x:22,y:50,side:'mine',label:'Town Center',initial:true}]};
 const events=[{kind:'BUILD',x:31,y:49,seconds:3.75,side:'mine',label:'House'},{kind:'BUILD',x:31,y:49,seconds:5,side:'mine',label:'House'},{kind:'BUILD',x:88,y:63,seconds:4.55,side:'theirs',label:'House'},{kind:'BUILD',x:-1,y:4,seconds:1,side:'mine',label:'Farm'}];
 assert.equal(visibleBuildings(data,events,0).length,1);assert.equal(visibleBuildings(data,events,4).length,2);assert.equal(visibleBuildings(data,events,6).length,3);assert.equal(visibleBuildings(data,events,2).length,1);
});
test('map corners and asymmetric coordinates retain orientation',()=>{
 assert.deepEqual(project(0,0,120),{x:0,y:210});assert.deepEqual(project(120,120,120),{x:720,y:210});assert.deepEqual(project(31,49,120),{x:240,y:237});
});
test('renderer can draw actual sample data and focus either base',()=>{
 const report=require('../site/data/report.json');const a=report.matches.find(m=>m.analysis?.map_view)?.analysis;if(!a)return;
 const ctx=new Proxy({},{get:(o,key)=>o[key]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 global.document={createElement:()=>({getContext:()=>ctx})};
 const canvas={getContext:()=>ctx,addEventListener(){}};
 const events=[...[a.metrics,...a.opponents.map(p=>p.metrics)].flatMap((m,i)=>m.full_timeline.map(e=>({...e,side:i?'theirs':'mine'})))];
 const viewer=mount(canvas,{},a.map_view,events,String,String);viewer.draw(0);viewer.draw(900);viewer.focus('mine');viewer.focus('theirs');viewer.focus('all');viewer.draw(5);
});
