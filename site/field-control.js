/* Contact candidates from nearby opposing command targets, never confirmed combat. */
(function(global){
  'use strict';
  const zones=['home','middle','away'];
  function summarize(data,duration){
    const bases=zones.slice(0,2).map((_,i)=>(data?.initial_buildings||[]).find(e=>e.side===(i?'theirs':'mine')&&e.label==='Town Center'));
    const [home,away]=bases;
    if(!home||!away||!Array.isArray(data?.command_activity))return null;
    const dx=away.x-home.x,dy=away.y-home.y,length2=dx*dx+dy*dy;
    if(!Number.isFinite(length2)||length2<1)return null;
    const end=Number.isFinite(duration)&&duration>0?duration:Infinity;
    const kinds=new Set(['MOVE','ORDER','PATROL','DE_ATTACK_MOVE','ATTACK_GROUND','AI_ORDER']);
    const events=data.command_activity.filter(e=>kinds.has(e.kind)&&['mine','theirs'].includes(e.side)&&
      Number.isFinite(e.seconds)&&e.seconds>=0&&e.seconds<=end&&
      Number.isFinite(e.x)&&Number.isFinite(e.y)&&e.x>=0&&e.y>=0&&e.x<data.size&&e.y<data.size)
      .sort((a,b)=>a.seconds-b.seconds);
    const bins=new Map();
    for(let i=0;i<events.length;i++){
      const a=events[i];
      for(let j=i-1;j>=0&&a.seconds-events[j].seconds<=10;j--){
        const b=events[j];
        if(a.side===b.side||(a.x-b.x)**2+(a.y-b.y)**2>64)continue;
        const progress=(((a.x+b.x)/2-home.x)*dx+((a.y+b.y)/2-home.y)*dy)/length2;
        const zone=progress<1/3?'home':progress>2/3?'away':'middle';
        const bin=Math.floor((a.seconds+b.seconds)/2/10);
        if(!bins.has(bin))bins.set(bin,new Set());
        bins.get(bin).add(zone);
      }
    }
    const seconds={home:0,middle:0,away:0},intervals=[];let samples=0;
    for(const [bin,set] of [...bins].sort((a,b)=>a[0]-b[0])){
      const start=bin*10,stop=Math.min(start+10,end),span=stop-start;
      if(span<=0)continue;samples++;
      const active=zones.filter(z=>set.has(z));
      for(const z of active)seconds[z]+=span/active.length;
      const previous=intervals[intervals.length-1];
      if(previous&&previous.end===start&&previous.zones.join()===active.join())previous.end=stop;
      else intervals.push({start,end:stop,zones:active});
    }
    const total=Math.round(zones.reduce((n,z)=>n+seconds[z],0)*1e6)/1e6;
    // Largest remainders keep the three displayed percentages at exactly 100.
    const percentages=Object.fromEntries(zones.map(z=>[z,total?Math.floor(seconds[z]/total*100):0]));
    if(total){
      const ordered=[...zones].sort((a,b)=>(seconds[b]/total*100-percentages[b])-(seconds[a]/total*100-percentages[a]));
      const remainder=100-zones.reduce((n,z)=>n+percentages[z],0);
      for(let i=0;i<remainder;i++)percentages[ordered[i]]++;
    }
    return {seconds,percentages,total,intervals,bins:samples,enough:total>=30,
      basis:'opposing_command_targets_8_tiles_10_seconds_initial_tc_axis_thirds'};
  }
  const api={summarize};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOFieldControl=api;
})(typeof window==='undefined'?globalThis:window);
