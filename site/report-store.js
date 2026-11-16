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
 // APP-18: reports are combined match by match instead of one whole report replacing another. A direct
 // collection (this browser only) used to vanish as soon as a newer published report arrived, taking the
 // matches only it had listed or analysed with it.
 const LIMIT=200; // the collector keeps the latest 200 matches of a profile
 const revision=m=>Number(m?.analysis?.analysis_revision)||0;
 const analysed=m=>m?.analysis_status==='complete'&&!!m.analysis;
 // per match: higher analysis revision, then analysed over not analysed, then the copy from the newer report
 // (on a tie the earlier report passed wins, so pass the published one first)
 function better(a,b){
  if(revision(a.match)!==revision(b.match))return revision(a.match)>revision(b.match);
  if(analysed(a.match)!==analysed(b.match))return analysed(a.match);
  if(a.time!==b.time)return a.time>b.time;
  return a.order<b.order;
 }
 function merge(id,...reports){
  const list=reports.filter(r=>valid(r,id));
  if(list.length<2)return list[0]||null;
  const byId=new Map();
  list.forEach((r,order)=>{
   for(const match of r.matches){
    if(match?.id==null)continue;
    const row={match,time:time(r),order},kept=byId.get(match.id);
    if(!kept||better(row,kept))byId.set(match.id,row);
   }
  });
  const base=newest(id,...list),first=list[0];
  const latest=key=>list.map(r=>r[key]).filter(Boolean).sort((x,y)=>(Date.parse(y)||0)-(Date.parse(x)||0))[0]??base[key];
  const matches=[...byId.values()].map(r=>r.match).sort((x,y)=>(y.started_at||0)-(x.started_at||0)).slice(0,LIMIT);
  // profile: the first report's (the published one) over the others
  return {...base,profile:Object.assign({},...list.slice().reverse().map(r=>r.profile)),last_checked_at:latest('last_checked_at'),updated_at:latest('updated_at'),matches};
 }
 // cheap fingerprint to skip rewriting the stored copy when nothing changed
 const signature=r=>r?`${r.last_checked_at}|${r.matches.length}|${r.matches.map(m=>`${m.id}:${revision(m)}:${analysed(m)?1:0}`).join(',')}`:'';
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
 const api={createStore,newest,merge,signature,valid,time};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SSAPOReportStore=api;
})(typeof window==='undefined'?globalThis:window);
