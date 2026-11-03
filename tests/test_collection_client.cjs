const {test}=require('node:test'),assert=require('node:assert/strict');
const create=require('../site/collection-client.js');const id=199325,key='a'.repeat(32),response=(body,ok=true)=>({ok,json:async()=>body});
function harness(fetch){let clock=0;const states=[],reports=[];const client=create({fetch,onState:s=>states.push(s),applyReport:async r=>reports.push(r),wait:async ms=>{clock+=ms;},now:()=>clock});return {client,states,reports};}
test('one click warms server, posts once and displays exact profile',async()=>{
 const calls=[];const h=harness(async(url,options)=>{calls.push([url,options]);if(url.endsWith('/health'))return response({status:'ok'});if(url.endsWith('/collect'))return response({job_id:key,profile_id:id});return response({state:'complete',profile_id:id,report:{profile:{id},matches:[]}});});
 await h.client.start('https://example.onrender.com',id);assert.equal(calls.filter(x=>x[1]?.method==='POST').length,1);assert.equal(h.reports.length,1);assert.equal(h.states.at(-1),'complete');
});
test('rate limit does not start a poll or erase prior results',async()=>{
 const h=harness(async url=>url.endsWith('/health')?response({status:'ok'}):response({error:'busy'},false));await assert.rejects(h.client.start('https://example.onrender.com',id),/busy/);assert.equal(h.reports.length,0);assert(!h.states.includes('complete'));
});
test('account mismatch is never applied',async()=>{
 const h=harness(async url=>url.endsWith('/health')?response({status:'ok'}):url.endsWith('/collect')?response({job_id:key,profile_id:id}):response({profile_id:id,state:'complete',report:{profile:{id:1},matches:[]}}));await assert.rejects(h.client.start('https://example.onrender.com',id));assert.equal(h.reports.length,0);
});
test('cancelled collection ignores an outstanding result',async()=>{
 let resolve;const h=harness(async url=>url.endsWith('/health')?response({status:'ok'}):url.endsWith('/collect')?response({job_id:key,profile_id:id}):new Promise(r=>{resolve=r;}));const task=h.client.start('https://example.onrender.com',id);while(!resolve)await new Promise(r=>setImmediate(r));h.client.stop();resolve(response({profile_id:id,state:'complete',report:{profile:{id},matches:[]}}));await task;assert.equal(h.reports.length,0);
});
