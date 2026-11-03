(function(root){
 'use strict';
 function createClient({fetch:request=root.fetch.bind(root),onState,applyReport,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now}){
  let generation=0;
  const stop=()=>{generation++;};
  async function start(endpoint,profileId){
   const mine=++generation,active=()=>mine===generation;
   if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(endpoint))throw Error('수집 서버가 아직 연결되지 않았어요.');
   const began=now();onState('waking');
   let ready=false;
   while(active()&&now()-began<120000){
    try{const r=await request(endpoint+'/health',{signal:AbortSignal.timeout(20000)});ready=r.ok&&(await r.json()).status==='ok';if(ready)break;}catch(e){}
    await wait(3000);
   }
   if(!active())return;
   if(!ready)throw Error('수집 서버를 깨우지 못했어요. 잠시 후 다시 눌러주세요.');
   onState('requesting');
   // One explicit POST; uncertain writes are never replayed automatically.
   const response=await request(endpoint+'/collect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile_id:profileId}),signal:AbortSignal.timeout(20000)});
   const job=await response.json();if(!active())return;
   if(!response.ok)throw Error(job.error||'수집 요청을 접수하지 못했어요.');
   if(!/^[a-f0-9]{32}$/.test(job.job_id)||job.profile_id!==profileId)throw Error('수집 요청 응답이 맞지 않아요.');
   while(active()&&now()-began<480000){
    onState('running');await wait(2500);if(!active())return;
    const result=await request(endpoint+'/jobs/'+job.job_id,{signal:AbortSignal.timeout(20000)});const data=await result.json();if(!active())return;
    if(!result.ok||data.profile_id!==profileId)throw Error(data.error||'수집 상태를 확인하지 못했어요.');
    if(data.state==='failed')throw Error(data.message||'수집하지 못했어요.');
    if(data.state==='complete'){
     if(data.report?.profile?.id!==profileId||!Array.isArray(data.report.matches)||data.report.sync_error)throw Error('결과 파일의 계정이 맞지 않아요.');
     await applyReport(data.report);if(active())onState('complete');return;
    }
   }
   if(active())throw Error('수집 결과를 기다리는 시간이 길어졌어요. 잠시 후 다시 확인해 주세요.');
  }
  return {start,stop};
 }
 if(typeof module==='object'&&module.exports)module.exports=createClient;else root.createCollectionClient=createClient;
})(typeof window==='undefined'?globalThis:window);
