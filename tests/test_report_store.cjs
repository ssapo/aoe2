const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore,newest,valid}=require('../site/report-store.js');
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
