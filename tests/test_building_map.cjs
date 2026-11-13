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
const {isWallPiece,boxesOverlap,labelWidth,placeLabels,pickHit}=require('../site/building-map.js');
test('wall and gate pieces are recognised, other buildings are not',()=>{
 for(const name of ['Stone Wall','Palisade Wall','Fortified Wall','Gate','Gate (up.)','Gate (down.)','Palisade Gate'])assert.equal(isWallPiece(name),true,name);
 for(const name of ['Town Center','House','Castle','Watch Tower','Barracks',undefined])assert.equal(isWallPiece(name),false,String(name));
});
test('label boxes that touch are dropped in priority order while markers stay',()=>{
 const box=(x,y,w=10,h=10)=>({x,y,w,h});
 assert.equal(boxesOverlap(box(0,0),box(9,9)),true);assert.equal(boxesOverlap(box(0,0),box(10,0)),false);assert.equal(boxesOverlap(box(0,0),box(10,0),1),true);
 assert.equal(labelWidth('집',10),10);assert.ok(Math.abs(labelWidth('TC',10)-13.6)<1e-9);
 // Second label overlaps the first and is dropped; the third is clear of both.
 assert.deepEqual(placeLabels([{id:0,box:box(0,0)},{id:1,box:box(6,0)},{id:2,box:box(30,0)}]),[true,false,true]);
 // A dropped label does not block later ones: 2 only touches the dropped 1.
 assert.deepEqual(placeLabels([{id:0,box:box(0,0)},{id:1,box:box(8,0)},{id:2,box:box(19,0)}]),[true,false,true]);
 // clear:true also keeps a label off other markers, but not off its own marker.
 const markers=[{id:0,box:box(0,0)},{id:1,box:box(0,12)}];
 assert.deepEqual(placeLabels([{id:1,clear:true,box:box(0,1)}],markers),[false]);
 assert.deepEqual(placeLabels([{id:0,clear:true,box:box(0,1)}],markers),[true]);
 assert.deepEqual(placeLabels([{id:1,box:box(0,1)}],markers),[true]);
});
test('clicks pick the nearest marker and cycle through markers stacked on it',()=>{
 const hits=[{sx:100,sy:100,key:'a'},{sx:103,sy:100,key:'b'},{sx:130,sy:100,key:'c'},{sx:100,sy:100,key:'d'}];
 assert.equal(pickHit(hits,300,300,null),null);
 assert.equal(pickHit(hits,128,100,null).hit.key,'c');assert.equal(pickHit(hits,128,100,null).count,1);
 // Same spot: the one drawn last is on top, then repeated clicks walk the stack and wrap.
 const first=pickHit(hits,100,100,null);assert.equal(first.hit.key,'d');assert.equal(first.count,3);assert.equal(first.index,0);
 const second=pickHit(hits,100,100,'d');assert.equal(second.hit.key,'a');
 const third=pickHit(hits,100,100,'a');assert.equal(third.hit.key,'b');assert.equal(third.index,2);
 assert.equal(pickHit(hits,100,100,'b').hit.key,'d');
 // A previous pick outside the stack does not change the result.
 assert.equal(pickHit(hits,100,100,'c').hit.key,'d');
});
test('zoomed base view draws no wall text, no overlapping labels, and keeps every marker selectable',()=>{
 const report=require('../site/data/report.json');
 const samples=report.matches.filter(m=>m.analysis?.map_view?.initial_buildings?.length);if(!samples.length)return;
 const walled=samples.find(m=>m.analysis.map_view.initial_buildings.some(e=>isWallPiece(e.label)));
 for(const match of [samples[0],walled].filter(Boolean))for(const width of [720,330]){
  const a=match.analysis,texts=[],rects=[],state={font:''};let clicked;
  const ctx=new Proxy(state,{get:(o,key)=>key in o?o[key]:key==='fillText'?(text,x,y)=>texts.push({text,x,y,font:parseFloat(o.font.split(' ')[1])}):
   key==='fillRect'?(x,y,w,h)=>rects.push({x,y,w,h}):key==='fill'?()=>rects.push({path:true}):key==='measureText'?()=>undefined:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  global.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})};
  const canvas={getContext:()=>ctx,addEventListener:(_,fn)=>{clicked=fn;},getBoundingClientRect:()=>({left:0,top:0,width,height:width*420/720})};
  const events=[a.metrics,...a.opponents.map(p=>p.metrics)].flatMap((m,i)=>m.full_timeline.map(e=>({...e,side:i?'theirs':'mine'})));
  const info={},viewer=mount(canvas,info,a.map_view,events,String,String);
  for(const side of ['mine','theirs'])for(const time of [0,390,600]){
   viewer.activity(false);viewer.focus(side);texts.length=0;rects.length=0;viewer.draw(time);
   assert.ok(texts.length>0);assert.ok(!texts.some(t=>isWallPiece(t.text)||t.text==='성벽'||t.text==='St'||t.text==='Ga'));
   // Drawn in zoomed space: 2.6x gives the on-canvas size. Text is centred on (x,y).
   const boxes=texts.map(t=>{const f=t.font*2.6,w=labelWidth(t.text,f);return {x:t.x*2.6-w/2,y:t.y*2.6-f/2,w,h:f};});
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.equal(boxesOverlap(boxes[i],boxes[j]),false,`${match.match_id} ${side} ${time} ${texts[i].text}/${texts[j].text}`);
   const shown=visibleBuildings(a.map_view,events,time);assert.equal(rects.length,shown.length);
   // Clicking the exact spot of each building reaches it, cycling when several share the spot.
   const tc=a.map_view.initial_buildings.find(e=>e.side===side&&e.label==='Town Center'),c=project(tc.x*120/a.map_view.size,tc.y*120/a.map_view.size,120);
   for(const e of shown.filter(e=>!e.initial).slice(0,12)){
    const p=project(e.x*120/a.map_view.size,e.y*120/a.map_view.size,120),sx=(p.x-c.x)*2.6+360,sy=(p.y-c.y)*2.6+210,want=` ${e.x}, ${e.y}`;
    let found=false;for(let i=0;i<40&&!found;i++){clicked({clientX:sx*width/720,clientY:sy*width/720});found=info.textContent.includes(want)&&info.textContent.includes(e.label);}
    assert.ok(found,`${e.label} ${e.x},${e.y}`);
   }
  }
 }
});
const {footprint,markerShape,resourcePatches,legendItems,hitRadius,stackRadius}=require('../site/building-map.js');
test('known footprints become tile-aligned diamonds and unknown buildings keep the square',()=>{
 assert.equal(footprint('House'),2);assert.equal(footprint('Farm'),3);assert.equal(footprint('Town Center'),4);assert.equal(footprint('Watch Tower'),1);
 for(const name of ['Yurt E','Building 2556','Stone Wall','toString',undefined])assert.equal(footprint(name),null,String(name));
 // One tile is 6x3 px on the 120-tile canvas, so a 2x2 house is 12x6 and a 4x4 town center 24x12.
 assert.deepEqual(markerShape('House'),{diamond:true,tiles:2,hw:6,hh:3});
 assert.deepEqual(markerShape('Town Center'),{diamond:true,tiles:4,hw:12,hh:6});
 // Smaller maps are stretched onto the same canvas, and tiny markers are widened, never shrunk.
 assert.deepEqual(markerShape('Farm',120/96),{diamond:true,tiles:3,hw:11.25,hh:5.625});
 assert.deepEqual(markerShape('Watch Tower',1,7),{diamond:true,tiles:1,hw:7,hh:3.5});
 assert.deepEqual(markerShape('House',1,4),{diamond:true,tiles:2,hw:6,hh:3});
 assert.deepEqual(markerShape('Yurt E',1,7),{diamond:false,tiles:null,hw:5,hh:5});
 // The recorded centres agree with the table: even sizes on whole tiles, odd sizes on half tiles.
 const report=require('../site/data/report.json');
 for(const m of report.matches){const a=m.analysis;if(!a?.map_view)continue;
  for(const e of [...a.map_view.initial_buildings,...[a.metrics,...a.opponents.map(p=>p.metrics)].flatMap(p=>p.full_timeline.filter(e=>e.kind==='BUILD'))]){
   const tiles=footprint(e.label);if(!tiles||!Number.isFinite(e.x))continue;
   assert.equal(Math.abs(e.x%1)===.5,tiles%2===1,`${e.label} ${e.x}`);
  }
 }
});
test('starting resources group into patches by kind without inventing amounts',()=>{
 const r=(kind,x,y)=>({kind,x,y});
 const patches=resourcePatches([r('gold',10.5,10.5),r('gold',11.5,10.5),r('stone',12.5,10.5),r('gold',13.5,11.5),r('gold',40.5,40.5),r('berries',NaN,1),r('gold',11.5,11.5)]);
 assert.deepEqual(patches.map(p=>[p.kind,p.count]),[['gold',4],['stone',1],['gold',1]]);
 assert.deepEqual([patches[0].x,patches[0].y],[11.75,11]);
 assert.deepEqual(Object.keys(patches[0]).sort(),['count','kind','x','y']);
 assert.deepEqual(resourcePatches(undefined),[]);
});
test('map key lists only what the match shows and touch reach grows on small screens',()=>{
 const wall={label:'Stone Wall'},house={kind:'BUILD',label:'House'},gate={kind:'BUILD',label:'Palisade Gate'};
 assert.deepEqual(legendItems({initial_buildings:[],resources:[]},[house]).map(i=>i.key),['build']);
 assert.deepEqual(legendItems({initial_buildings:[wall],resources:[{kind:'stone'},{kind:'gold'}]},[house]),
  [{key:'build',text:'건설 요청'},{key:'wall',text:'성벽·성문'},{key:'resources',kinds:['gold','stone'],text:'시작 위치'}]);
 assert.deepEqual(legendItems({initial_buildings:[]},[gate]).map(i=>i.key),['build','wall']);
 // 22 CSS px of reach: 18 canvas px is enough on a wide canvas, a 310 px wide phone canvas needs about 51.
 assert.equal(hitRadius(1.3),18);assert.ok(Math.abs(hitRadius(310/720)-51.1)<.1);assert.equal(hitRadius(0),22);
 assert.equal(stackRadius(1),8);assert.ok(stackRadius(310/720)>11&&stackRadius(310/720)<12);
});
