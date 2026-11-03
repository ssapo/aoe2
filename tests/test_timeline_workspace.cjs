const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

test('record paging keeps the reading position and playback still seeks on either tab',()=>{
  const nodes=new Map();
  const node=()=>({value:'all',hidden:false,textContent:'',innerHTML:'',scrollTop:0,
    listeners:{},classList:{toggle(){}},setAttribute(){},focus(){},
    addEventListener(type,fn){this.listeners[type]=fn;}});
  const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
  const tabs=['summary','timeline'].map(id=>({...node(),dataset:{panel:id}}));
  const panels=['summary','timeline'].map(id=>({...node(),id:`panel-${id}`}));
  const body=get('.review-body');
  let active=false;body.classList.toggle=(name,on)=>{if(name==='timeline-active')active=on;};
  get('#production-search').value='';
  const root={querySelector:get,querySelectorAll:selector=>selector==='[role="tab"]'?tabs:selector==='[role="tabpanel"]'?panels:[]};
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
  tabs[0].listeners.click();assert.equal(active,false);
});
