const test=require('node:test');
const assert=require('node:assert/strict');
const createWatch=require('../site/collection-watch.js');
const status=(stamp,error=null)=>({schema_version:1,last_checked_at:stamp,sync_error:error});
function harness(fetchStatus,refreshReport=async()=>true) {
  let clock=0,sequence=0,isVisible=true;
  const timers=new Map(),states=[];
  const watch=createWatch({fetchStatus,refreshReport,onState:(...s)=>states.push(s),now:()=>clock,
    visible:()=>isVisible,setTimer:fn=>{timers.set(++sequence,fn);return sequence;},clearTimer:id=>timers.delete(id)});
  return {watch,states,timers,hide:()=>{isVisible=false;},
    tick:async(delta=15000)=>{clock+=delta;const [id,fn]=timers.entries().next().value;timers.delete(id);await fn();}};
}
test('unchanged published status never claims that a workflow started or finished',async()=>{
  let stamp='first',refreshes=0;
  const h=harness(async()=>status(stamp),async()=>{refreshes++;return true;});
  await h.watch.start();await h.tick();
  assert.equal(refreshes,0);assert.ok(h.states.every(s=>s[0]==='waiting'));
  stamp='second';await h.tick();
  assert.equal(refreshes,1);assert.equal(h.states.at(-1)[0],'updated');assert.equal(h.timers.size,0);
});
test('a newly published collection error refreshes preserved data and reports failure',async()=>{
  let stamp='old',refreshed=false;
  const h=harness(async()=>status(stamp,'collection failed'),async()=>{refreshed=true;return true;});
  await h.watch.start();assert.equal(refreshed,false);
  stamp='new';await h.tick();
  assert.equal(refreshed,true);assert.deepEqual(h.states.at(-1),['failed','collection failed']);
});
test('network and report refresh failures retry instead of reporting completion',async()=>{
  let fail=true,stamp='old',canRefresh=false;
  const h=harness(async()=>{if(fail)throw Error('offline');return status(stamp);},async()=>canRefresh);
  await h.watch.start();assert.equal(h.states.at(-1)[0],'retrying');
  fail=false;await h.tick();stamp='new';await h.tick();
  assert.equal(h.states.at(-1)[0],'retrying');
  canRefresh=true;await h.tick();assert.equal(h.states.at(-1)[0],'updated');
});
test('closing the watcher ignores an outstanding response and schedules nothing',async()=>{
  let resolve;
  const h=harness(()=>new Promise(r=>{resolve=r;}));
  const pending=h.watch.start();h.watch.stop();resolve(status('late'));await pending;
  assert.deepEqual(h.states,[['waiting']]);assert.equal(h.timers.size,0);
});
test('a hidden page does not download, and timeout never claims collection failed',async()=>{
  let calls=0;
  const h=harness(async()=>{calls++;return status('old');});h.hide();
  await h.watch.start();await h.tick(600000);
  assert.equal(calls,0);assert.equal(h.states.at(-1)[0],'timeout');assert.equal(h.timers.size,0);
});
