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
  const root={querySelector:get,querySelectorAll:selector=>selector==='.review-tabs [role="tab"]'?tabs:selector==='[role="tabpanel"][id^="panel-"]'?panels:selector==='[data-field-track]'?[track]:selector==='[data-numbers]'?numberTabs:selector==='[data-number-panel]'?numberPanels:[]};
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
 const ctx=vm.createContext({ageList:['봉건'],checkpoint:(m,a)=>m.age_checkpoints?.[a]||{},number:String,fmtTime:String,esc:String,why:t=>`<p class="section-why">${t}</p>`,compareTable:rows=>JSON.stringify(rows)});
 vm.runInContext(code.slice(code.indexOf('  function renderNumbersPanel('),code.indexOf('\n  function ',code.indexOf('  function renderNumbersPanel(')+10)),ctx);
 const side={checkpoints:[],phases:[],villager_command_gaps:[],military_requests:50,villager_requests:40};
 const html=ctx.renderNumbersPanel({own:side,opponent:side,personal_benchmarks:[]},{eapm:30,age_checkpoints:{봉건:{reached_seconds:600}}},{eapm:40},null);
 const core=html.match(/<section data-number-panel="core">([\s\S]*?)<\/section>/)[1];
 assert.match(core,/봉건 도달/);assert.doesNotMatch(core,/생산 요청|병력 생산|주민 생산/);
 assert.match(html,/data-number-panel="requests" hidden/);
 assert.match(html,/5분별/);assert.match(html,/시대별/);
 // APP-20: 시장 and 내 기록 are always there, with why when empty; no review → the same six with the reason
 assert.match(html,/data-number-panel="market" hidden><p class="section-why">/);assert.match(html,/data-number-panel="benchmark" hidden><p class="section-why">/);
 const bare=ctx.renderNumbersPanel(null,{},{},null,'분석 없음');
 assert.equal((bare.match(/data-numbers=/g)||[]).length,6);assert.equal((bare.match(/분석 없음/g)||[]).length,6);
});

test('sub-tabs keep the scroll place and the matchup card age tabs are left to the card (APP-18)',()=>{
  const nodes=new Map();
  const node=extra=>({value:'all',hidden:false,textContent:'',innerHTML:'',scrollTop:0,dataset:{},
    listeners:{},attributes:{},style:{values:{},setProperty(k,v){this.values[k]=v;}},classList:{toggle(){}},setAttribute(key,value){this.attributes[key]=value;},focus(){},
    addEventListener(type,fn){this.listeners[type]=fn;},...extra});
  const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
  const tabs=['summary','ages'].map(id=>node({dataset:{panel:id}}));
  const panels=['summary','ages'].map(id=>node({id:`panel-${id}`}));
  const ageTabs=['봉건','성주'].map(age=>node({dataset:{ageup:age}}));
  const agePanels=['봉건','성주'].map((age,i)=>node({dataset:{agePanel:age},hidden:i>0}));
  // the matchup card (APP-16) carries data-age="2|3|4|all" on its tabs and panels
  const cardNodes=['2','3','all'].map(age=>node({dataset:{age}}));
  const stageTabs=['전체','봉건'].map(stage=>node({dataset:{reviewStage:stage}}));
  const body=get('.review-body');
  get('#production-search').value='';
  const lists={'.review-tabs [role="tab"]':tabs,'[role="tabpanel"][id^="panel-"]':panels,'[data-ageup]':ageTabs,'[data-age-panel]':agePanels,'[data-age]':cardNodes,'[data-review-stage]':stageTabs};
  const root={querySelector:get,querySelectorAll:selector=>lists[selector]||[]};
  const code=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
  const ctx=vm.createContext({root,window:{},document:{querySelector:()=>({open:true})},
    label:String,esc:String,number:String,fmtTime:String,performance:{now:()=>0},findingSide:()=>'',
    splitTimeline:rows=>JSON.stringify(rows),timelineRows:events=>events,setInterval(){return 1;},clearInterval(){}});
  vm.runInContext(code.slice(code.indexOf('  function bindWorkspace('),code.indexOf('  function toast(')),ctx);
  vm.runInContext('bindWorkspace(root,{},{},null,{own_findings:[],opponent_findings:[]},null,{})',ctx);
  assert.ok(cardNodes.every(n=>!n.listeners.click),'the workspace must not bind the matchup card age tabs/panels');
  body.scrollTop=480;ageTabs[1].listeners.click();
  assert.equal(body.scrollTop,480);
  assert.deepEqual(agePanels.map(p=>p.hidden),[true,false]);
  body.scrollTop=480;stageTabs[1].listeners.click();assert.equal(body.scrollTop,480);
  tabs[1].listeners.click();assert.equal(body.scrollTop,0,'the big analysis tabs still start at the top');
});
