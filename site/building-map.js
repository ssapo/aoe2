/* Initial replay map + building request targets. No game-state simulation. */
(function(global){
  'use strict';
  const project=(x,y,size)=>({x:360+(y+x-size)*3,y:30+(y+size-x)*1.5});
  function visibleBuildings(data,events,time){
    const sites=new Map();
    for(const e of [...data.initial_buildings,...events.filter(e=>e.kind==='BUILD'&&e.seconds<=time)]){
      if(!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.y<0||e.x>=data.size||e.y>=data.size)continue;
      // Repeated requests for the same type at the same location share one marker.
      sites.set(`${e.side}:${e.label}:${e.x}:${e.y}`,e);
    }
    return [...sites.values()];
  }
  function recentActivity(data,time){
    const groups=new Map();
    for(const [i,e] of (data.command_activity||[]).entries()){
      if(!Number.isFinite(e.seconds)||e.seconds>time||time-e.seconds>=30||
        !Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.y<0||e.x>=data.size||e.y>=data.size)continue;
      const key=e.group!==undefined?`${e.side}:${e.group}`:`event:${i}`;
      const previous=groups.get(key);if(!previous||previous.seconds<=e.seconds)groups.set(key,e);
    }
    return [...groups.values()].sort((a,b)=>a.seconds-b.seconds);
  }
  function mount(canvas,info,data,events,label,format){
    if(!data||!Array.isArray(data.terrain_runs))return {draw(){}};
    const size=data.size,scale=120/size;
    const pos=(x,y)=>project(x*scale,y*scale,120);
    const back=document.createElement('canvas');back.width=720;back.height=420;
    const bg=back.getContext('2d');bg.fillStyle='#18271e';bg.fillRect(0,0,720,420);
    let index=0;
    for(const [terrain,elevation,count] of data.terrain_runs){
      bg.fillStyle=data.terrain_names?.[terrain]?.colors?.level||'#879481';
      for(let i=0;i<count;i++,index++){
        const x=index%size,y=Math.floor(index/size),a=pos(x,y),b=pos(x+1,y),c=pos(x+1,y+1),d=pos(x,y+1);
        bg.beginPath();bg.moveTo(a.x,a.y);bg.lineTo(b.x,b.y);bg.lineTo(c.x,c.y);bg.lineTo(d.x,d.y);bg.closePath();bg.fill();
      }
    }
    for(const r of data.resources||[]){const p=pos(r.x,r.y);bg.fillStyle={gold:'#f1cb3e',stone:'#c1c7ce',berries:'#b34dc8'}[r.kind]||'#fff';bg.fillRect(p.x-2,p.y-2,4,4);}
    const ctx=canvas.getContext('2d');let hits=[],lastTime=0,focus=null,zoom=1,showActivity=true;
    const activityNames={MOVE:'이동 지시',ORDER:'대상 지시',PATROL:'순찰 지시',DE_ATTACK_MOVE:'공격 이동 지시',ATTACK_GROUND:'지면 공격 지시',AI_ORDER:'자동 이동 지시'};
    const short={'Town Center':'TC',House:'집',Farm:'농',Mill:'제',Barracks:'병',Stable:'기', 'Archery Range':'궁',Castle:'성',Market:'시',Monastery:'수','Lumber Camp':'목','Mining Camp':'광',Blacksmith:'대'};
    function draw(time){
      lastTime=time;ctx.clearRect(0,0,720,420);ctx.save();
      if(focus){ctx.translate(360-focus.x*zoom,210-focus.y*zoom);ctx.scale(zoom,zoom);}
      ctx.drawImage(back,0,0);hits=[];
      for(const e of visibleBuildings(data,events,time)){
        const p=pos(e.x,e.y),isNew=!e.initial&&time-e.seconds<15;
        ctx.fillStyle=e.side==='mine'?'#64f28d':'#ff6f70';ctx.strokeStyle=e.initial?'#fff':'#18271e';ctx.lineWidth=1/zoom;
        const radius=e.label==='Farm'?3:5;
        ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);ctx.strokeRect(p.x-radius,p.y-radius,radius*2,radius*2);
        if(isNew){ctx.strokeStyle='#fff';ctx.strokeRect(p.x-8,p.y-8,16,16);}
        if(zoom>1||e.initial){ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.lineWidth=2/zoom;ctx.strokeStyle='#102117';ctx.strokeText(short[e.label]||label(e.label).slice(0,2),p.x,p.y-8);ctx.fillStyle='#fff';ctx.fillText(short[e.label]||label(e.label).slice(0,2),p.x,p.y-8);}
        hits.push({...p,event:e});
      }
      if(showActivity)for(const e of recentActivity(data,time)){
        const p=pos(e.x,e.y),count=e.selected_count;
        const radius=(6+(Number.isInteger(count)&&count>0?Math.log2(count+1)*2:0))/zoom;
        ctx.globalAlpha=.8*(1-(time-e.seconds)/30);
        ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);
        ctx.fillStyle=e.side==='mine'?'#3fe47c':'#ff656b';ctx.fill();
        ctx.strokeStyle='#fff7dc';ctx.lineWidth=1/zoom;ctx.stroke();
        if(Number.isInteger(count)&&count>1){
          ctx.font=`bold ${10/zoom}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.lineWidth=2/zoom;ctx.strokeStyle='#15231a';ctx.strokeText(String(count),p.x,p.y);
          ctx.fillStyle='#fff';ctx.fillText(String(count),p.x,p.y);ctx.textBaseline='alphabetic';
        }
        hits.push({...p,event:{...e,marker:'activity'}});
      }
      ctx.globalAlpha=1;
      ctx.restore();
    }
    canvas.addEventListener('click',e=>{
      const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*720/r.width,y=(e.clientY-r.top)*420/r.height;
      let selected=null,best=18;
      for(const h of hits){const hx=focus?(h.x-focus.x)*zoom+360:h.x,hy=focus?(h.y-focus.y)*zoom+210:h.y,d=Math.hypot(x-hx,y-hy);if(d<best){selected=h.event;best=d;}}
      info.textContent=selected?(selected.marker==='activity'?
        `${selected.side==='mine'?'나':'상대'} · ${activityNames[selected.kind]||'유닛 지시'} · ${format(selected.seconds)}${Number.isInteger(selected.selected_count)?' · 선택 '+selected.selected_count+'대상':''} · 명령 지점 ${selected.x}, ${selected.y}`:
        `${selected.side==='mine'?'나':'상대'} · ${label(selected.label)} · ${selected.initial?'시작 배치':format(selected.seconds)+' 건설 요청'} · 좌표 ${selected.x}, ${selected.y}`):'표시를 누르면 지시 시각·선택 수·좌표를 볼 수 있어요.';
    });
    return {draw,activity(show){showActivity=show;draw(lastTime);},focus(side){const e=data.initial_buildings.find(e=>e.side===side&&e.label==='Town Center');focus=e?pos(e.x,e.y):null;zoom=e?2.6:1;draw(lastTime);}};
  }
  const api={project,visibleBuildings,recentActivity,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOBuildingMap=api;
})(typeof window==='undefined'?globalThis:window);
