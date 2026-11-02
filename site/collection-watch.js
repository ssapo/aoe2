(function (root) {
  'use strict';
  function createCollectionWatch({fetchStatus, refreshReport, onState, visible=()=>true,
    now=Date.now, setTimer=setTimeout, clearTimer=clearTimeout, interval=15000, timeout=600000}) {
    let active=null;
    const stop=()=>{if(active&&active.timer!==null)clearTimer(active.timer);active=null;};
    const finish=(watch,state,detail)=>{if(active!==watch)return;stop();onState(state,detail);};
    async function check(watch=active) {
      if(!watch||watch!==active||watch.busy)return;
      if(watch.timer!==null){clearTimer(watch.timer);watch.timer=null;}
      if(now()-watch.started>=timeout){finish(watch,'timeout');return;}
      if(!visible()){watch.timer=setTimer(()=>check(watch),interval);return;}
      watch.busy=true;
      try {
        const status=await fetchStatus();
        if(watch!==active)return;
        if(status.schema_version!==1||typeof status.last_checked_at!=='string'||!status.last_checked_at)throw Error('Invalid status');
        if(watch.baseline===null)watch.baseline=status.last_checked_at;
        else if(status.last_checked_at!==watch.baseline) {
          if(!await refreshReport(status))throw Error('Report refresh failed');
          finish(watch,status.sync_error?'failed':'updated',status.sync_error);
          return;
        }
        if(watch===active)onState('waiting');
      } catch(error) {
        if(watch===active)onState('retrying');
      } finally {
        watch.busy=false;
        if(watch===active)watch.timer=setTimer(()=>check(watch),interval);
      }
    }
    function start() {
      stop();active={started:now(),baseline:null,busy:false,timer:null};
      onState('waiting');return check(active);
    }
    return {start,stop,check};
  }
  if(typeof module==='object'&&module.exports)module.exports=createCollectionWatch;
  else root.createCollectionWatch=createCollectionWatch;
})(typeof window==='object'?window:globalThis);
