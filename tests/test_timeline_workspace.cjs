const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

test('paging and field selection keep the flow tab and scroll position with one time control',()=>{
  const nodes=new Map();
  const node=()=>({value:'all',hidden:false,textContent:'',innerHTML:'',scrollTop:0,dataset:{},
    listeners:{},attributes:{},style:{values:{},setProperty(k,v){this.values[k]=v;}},classList:{toggle(){}},setAttribute(key,value){this.attributes[key]=value;},focus(){},
    addEventListener(type,fn){this.listeners[type]=fn;}});
  const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
  const tabs=['summary','timeline'].map(id=>({...node(),dataset:{panel:id}}));
  const panels=['summary','timeline'].map(id=>({...node(),id:`panel-${id}`}));
  const body=get('.review-body');
  let active=false;body.classList.toggle=(name,on)=>{if(name==='timeline-active')active=on;};
  get('#production-search').value='';
  get('#field-time-plot').dataset.duration='40';
  const track={...node(),getBoundingClientRect:()=>({left:100,width:400})};
  const root={querySelector:get,querySelectorAll:selector=>selector==='[role="tab"]'?tabs:selector==='[role="tabpanel"]'?panels:selector==='[data-field-track]'?[track]:[]};
  const code=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
  const ctx=vm.createContext({root,window:{},document:{querySelector:()=>({open:true})},
    label:String,esc:String,number:String,fmtTime:String,performance:{now:()=>0},
    splitTimeline:rows=>JSON.stringify(rows),timelineRows:events=>events,
    setInterval(){return 1;},clearInterval(){}});
  vm.runInContext(code.slice(code.indexOf('  function bindWorkspace('),code.indexOf('  function toast(')),ctx);
  const mine={full_timeline:Array.from({length:40},(_,i)=>({seconds:i+1,kind:'BUILD',label:'House'})),
    unit_orders:{Archer:{first_seconds:1,requested_amount:7,commands:4,unknown_amount_commands:1},
      Spearman:{first_seconds:2,requested_amount:3,commands:3}}};
  ctx.mine=mine;
  vm.runInContext('bindWorkspace(root,mine,{},null,{},null,{})',ctx);
  assert.doesNotMatch(get('#production-table').innerHTML,/요청 7/);
  assert.match(get('#production-table').innerHTML,/요청 —/);
  assert.match(get('#production-table').innerHTML,/요청 3/);
  tabs[1].listeners.click();assert.equal(active,true);
  body.scrollTop=480;
  get('#timeline-next').listeners.click();
  assert.equal(body.scrollTop,480);
  assert.equal(get('#timeline-page').textContent,'2 / 3');
  get('#timeline-prev').listeners.click();assert.equal(body.scrollTop,480);
  get('#record-next').listeners.click();assert.equal(get('#record-seek').value,'1');
  assert.equal(get('#record-clock').textContent,'1 / 40');
  get('#record-seek').value='20';get('#record-seek').listeners.input();
  assert.equal(get('#record-clock').textContent,'20 / 40');
  get('#record-play').listeners.click();assert.equal(get('#record-play').attributes['aria-label'],'일시정지');
  get('#record-play').listeners.click();assert.equal(get('#record-play').attributes['aria-label'],'재생');
  assert.equal(nodes.has('#record-events'),false);
  assert.equal(nodes.has('#field-seek'),false);
  get('#record-seek').value='15';get('#record-seek').listeners.input();
  assert.equal(get('#field-time-plot').style.values['--field-cursor'],'37.5%');
  assert.equal(body.scrollTop,480);
  track.listeners.click({clientX:300});assert.equal(active,true);assert.equal(get('#record-seek').value,'20');
  assert.equal(body.scrollTop,480);
  assert.equal(get('#field-time-plot').style.values['--field-cursor'],'50%');
  get('#record-next').listeners.click();assert.equal(get('#field-time-plot').style.values['--field-cursor'],'52.5%');
  track.listeners.click({clientX:50});assert.equal(get('#record-seek').value,'0');assert.equal(body.scrollTop,480);
  track.listeners.click({clientX:600});assert.equal(get('#record-seek').value,'40');assert.equal(body.scrollTop,480);
  tabs[0].listeners.click();assert.equal(active,false);
});
