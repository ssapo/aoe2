const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore,newest,merge,signature,valid}=require('../site/report-store.js');
const rep=(id,at,n=1)=>({schema_version:1,profile:{id},last_checked_at:at,matches:Array.from({length:n},(_,i)=>({id:i}))});
function fakeIdb(){
 const data=new Map();let opened=0;
 const later=f=>setTimeout(f,0);
 return {data,get opened(){return opened;},open(){
  const req={};
  later(()=>{opened++;const db={
   transaction(){const tx={};const store={
    get(k){const r={};later(()=>{r.result=structuredClone(data.get(k));later(()=>tx.oncomplete());});return r;},
    put(v,k){const r={};later(()=>{data.set(k,structuredClone(v));r.result=k;later(()=>tx.oncomplete());});return r;}
   };tx.objectStore=()=>store;return tx;},
   createObjectStore(){},close(){}};
   req.result=db;if(opened===1&&req.onupgradeneeded)req.onupgradeneeded();req.onsuccess();});
  return req;}};
}
test('newest prefers the later report and the first on a tie',()=>{
 const a=rep(5,'2026-11-09T10:00:00Z'),b=rep(5,'2026-11-09T11:00:00Z'),c=rep(5,'2026-11-09T10:00:00Z');
 assert.equal(newest(5,a,b),b);assert.equal(newest(5,a,c),a);assert.equal(newest(5,c,a),c);
});
test('newest skips missing, foreign and malformed reports',()=>{
 const own=rep(5,'2026-11-09T10:00:00Z');
 assert.equal(newest(5,null,undefined,rep(6,'2030-01-01T00:00:00Z'),{profile:{id:5},matches:[]},own),own);
 assert.equal(newest(5,null,{matches:[]}),null);
 assert.equal(valid({schema_version:1,profile:{id:5},matches:{}},5),false);
});
test('a saved direct collection survives a reload and beats an older published report',async()=>{
 const idb=fakeIdb(),store=createStore(idb);
 const direct=rep(5,'2026-11-10T01:00:00Z',3),published=rep(5,'2026-11-09T23:00:00Z',2);
 assert.equal(await store.put(direct),true);
 const saved=await createStore(idb).get(5);       // a new page load
 assert.deepEqual(saved,direct);
 assert.equal(newest(5,published,undefined,saved).matches.length,3);
 assert.equal(newest(5,rep(5,'2026-11-10T02:00:00Z',4),undefined,saved).matches.length,4);
 assert.equal(await store.get(6),null);
});
test('without IndexedDB the store quietly does nothing',async()=>{
 const store=createStore(undefined);
 assert.equal(await store.put(rep(5,'2026-11-10T01:00:00Z')),false);
 assert.equal(await store.get(5),null);
});
// APP-18: combine by match instead of one whole report replacing another
const m=(id,started,rev,extra={})=>({id,started_at:started,analysis_status:rev?'complete':'pending',...(rev?{analysis:{analysis_revision:rev}}:{}),...extra});
const full=(id,at,matches,profile={id})=>({schema_version:1,profile,last_checked_at:at,updated_at:at,matches});
test('a newer published report keeps the matches only a direct collection had or analysed',()=>{
 const direct=full(5,'2026-11-10T01:00:00Z',[m(30,300,15),m(20,200,15),m(10,100,0)]);
 const published=full(5,'2026-11-10T03:00:00Z',[m(40,400,31),m(20,200,0),m(10,100,31)],{id:5,name:'pub'});
 const r=merge(5,published,undefined,direct);
 assert.deepEqual(r.matches.map(x=>x.id),[40,30,20,10]);              // union, newest game first
 assert.equal(r.matches.find(x=>x.id===20).analysis.analysis_revision,15); // analysed beats not analysed
 assert.equal(r.matches.find(x=>x.id===10).analysis.analysis_revision,31); // higher revision wins
 assert.equal(r.profile.name,'pub');assert.equal(r.last_checked_at,'2026-11-10T03:00:00Z');
});
test('same revision: the copy from the newer report wins, a tie keeps the first report passed',()=>{
 const a=full(5,'2026-11-10T01:00:00Z',[m(1,1,31,{result:'old'})]),b=full(5,'2026-11-10T02:00:00Z',[m(1,1,31,{result:'new'})]);
 assert.equal(merge(5,a,b).matches[0].result,'new');assert.equal(merge(5,b,a).matches[0].result,'new');
 const c=full(5,'2026-11-10T01:00:00Z',[m(1,1,31,{result:'c'})]);
 assert.equal(merge(5,a,c).matches[0].result,'old');
 // the published profile name stays even when the direct report is newer
 assert.equal(merge(5,full(5,'2026-11-10T00:00:00Z',[],{id:5,name:'pub'}),full(5,'2026-11-10T05:00:00Z',[],{id:5,name:'tab'})).profile.name,'pub');
});
test('merge skips foreign or broken reports, returns a lone report as is and keeps 200 matches',()=>{
 const own=full(5,'2026-11-10T01:00:00Z',[m(1,1,31)]);
 assert.equal(merge(5,null,own,full(6,'2030-01-01T00:00:00Z',[m(9,9,31)])),own);
 assert.equal(merge(5,null,undefined),null);
 const many=n=>full(5,'2026-11-10T01:00:00Z',Array.from({length:n},(_,i)=>m(i+1,i+1,31)));
 const r=merge(5,many(150),full(5,'2026-11-10T02:00:00Z',Array.from({length:100},(_,i)=>m(1000+i,1000+i,31))));
 assert.equal(r.matches.length,200);assert.equal(r.matches[0].id,1099);assert.equal(r.matches.at(-1).id,51);
});
test('signature changes only when matches or the check time change',()=>{
 const a=full(5,'2026-11-10T01:00:00Z',[m(1,1,31)]);
 assert.equal(signature(a),signature(structuredClone(a)));
 assert.notEqual(signature(a),signature(full(5,'2026-11-10T01:00:00Z',[m(1,1,30)])));
 assert.notEqual(signature(a),signature(null));
});
