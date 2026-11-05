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
  const numberTabs=['core','requests','checkpoints','phases'].map(id=>({...node(),dataset:{numbers:id}}));
  const numberPanels=numberTabs.map(t=>({...node(),dataset:{numberPanel:t.dataset.numbers}}));
  const body=get('.review-body');
  let active=false;body.classList.toggle=(name,on)=>{if(name==='timeline-active')active=on;};
  get('#production-search').value='';
  get('#field-time-plot').dataset.duration='40';
  const track={...node(),getBoundingClientRect:()=>({left:100,width:400})};
  const root={querySelector:get,querySelectorAll:selector=>selector==='[role="tab"]'?tabs:selector==='[role="tabpanel"]'?panels:selector==='[data-field-track]'?[track]:selector==='[data-numbers]'?numberTabs:selector==='[data-number-panel]'?numberPanels:[]};
  const code=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
  const ctx=vm.createContext({root,window:{},document:{querySelector:()=>({open:true})},
    label:String,esc:String,number:String,fmtTime:String,performance:{now:()=>0},
    splitTimeline:rows=>JSON.stringify(rows),timelineRows:events=>events,
    setInterval(){return 1;},clearInterval(){}});
  vm.runInContext(code.slice(code.indexOf('  function bindWorkspace('),code.indexOf('  function toast(')),ctx);
  const mine={full_timeline:Array.from({length:40},(_,i)=>({seconds:i+1,kind:'BUILD',label:'House'}))};
  ctx.mine=mine;
  vm.runInContext('bindWorkspace(root,mine,{},null,{},null,{})',ctx);
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
  for(const tab of numberTabs){
    body.scrollTop=480;tab.listeners.click();assert.equal(body.scrollTop,480);
    assert.equal(numberPanels.filter(p=>!p.hidden).length,1);
    assert.equal(numberPanels.find(p=>!p.hidden).dataset.numberPanel,tab.dataset.numbers);
  }
  tabs[0].listeners.click();assert.equal(active,false);
});

test('numbers separate observed age timings from production requests',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
 const ctx=vm.createContext({ageList:['봉건'],checkpoint:(m,a)=>m.age_checkpoints?.[a]||{},number:String,fmtTime:String,esc:String,compareTable:rows=>JSON.stringify(rows)});
 vm.runInContext(code.slice(code.indexOf('  function renderNumbersPanel('),code.indexOf('\n  function ',code.indexOf('  function renderNumbersPanel(')+10)),ctx);
 const side={checkpoints:[],phases:[],villager_command_gaps:[],military_requests:50,villager_requests:40};
 const html=ctx.renderNumbersPanel({own:side,opponent:side,personal_benchmarks:[]},{eapm:30,age_checkpoints:{봉건:{reached_seconds:600}}},{eapm:40},null);
 const core=html.match(/<section data-number-panel="core">([\s\S]*?)<\/section>/)[1];
 assert.match(core,/봉건 도달/);assert.doesNotMatch(core,/생산 요청|병력 생산|주민 생산/);
 assert.match(html,/data-number-panel="requests" hidden/);
 assert.match(html,/5분별 요청/);assert.match(html,/시대별 요청/);
});
