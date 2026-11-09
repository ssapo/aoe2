/* Keeps the newest report of each profile in this browser (IndexedDB), so a direct collection's
   result or the last good report survives a reload, a Pages deploy or a failed fetch. */
(function(root){
 'use strict';
 const DB='ssapo-aoe2',STORE='reports';
 const time=r=>Date.parse(r?.last_checked_at)||0;
 const valid=(r,id)=>!!(r&&r.schema_version===1&&Array.isArray(r.matches)&&r.profile?.id===id);
 // The newest valid report; on a tie the earlier candidate wins (pass the published one first).
 function newest(id,...reports){
  let best=null;
  for(const r of reports)if(valid(r,id)&&(!best||time(r)>time(best)))best=r;
  return best;
 }
 function createStore(idb=root.indexedDB){
  function open(){
   return new Promise((resolve,reject)=>{
    if(!idb)return reject(Error('IndexedDB unavailable'));
    const request=idb.open(DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
   });
  }
  async function run(mode,work){
   const db=await open();
   return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode),request=work(tx.objectStore(STORE));
    tx.oncomplete=()=>{db.close();resolve(request.result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};
   });
  }
  return {
   async get(id){try{const r=await run('readonly',s=>s.get(id));return valid(r,id)?r:null;}catch(e){return null;}},
   async put(report){try{await run('readwrite',s=>s.put(report,report.profile.id));return true;}catch(e){return false;}}
  };
 }
 const api={createStore,newest,valid,time};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SSAPOReportStore=api;
})(typeof window==='undefined'?globalThis:window);
