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
  // Wall and gate pieces come in long runs, so they get a small mark and no text.
  const isWallPiece=name=>/\b(wall|gate)\b/i.test(String(name||''));
  const boxesOverlap=(a,b,gap=0)=>a.x<b.x+b.w+gap&&b.x<a.x+a.w+gap&&a.y<b.y+b.h+gap&&b.y<a.y+a.h+gap;
  // Fallback when the canvas cannot measure text: Hangul/CJK glyphs are about 1em wide,
  // bold Latin letters and digits about 0.68em.
  const labelWidth=(text,font)=>[...String(text)].reduce((w,ch)=>w+(ch.charCodeAt(0)>0x2e7f?1:.68)*font,0);
  // Decides which labels to draw, in the given priority order. A label is skipped when its
  // box touches a label already kept, or (clear:true) a marker box other than its own.
  // `slack` lets a label graze a marker by that many px, since glyphs do not fill their box.
  // Only text is dropped: markers are never moved or removed.
  function placeLabels(labels,markers=[],gap=1,slack=0){
    const kept=[];
    return labels.map(l=>{
      if(kept.some(k=>boxesOverlap(l.box,k,gap)))return false;
      if(l.clear&&markers.some(m=>m.id!==l.id&&boxesOverlap(l.box,m.box,-slack)))return false;
      kept.push(l.box);return true;
    });
  }
  // Nearest marker to a click; on a tie the one drawn last (on top) wins. Markers stacked on
  // the nearest one (within `stack` px) are reached by clicking again: the pick moves on.
  function pickHit(hits,x,y,previousKey,radius=18,stack=8){
    const near=hits.map((h,order)=>({h,order,d:Math.hypot(x-h.sx,y-h.sy)})).filter(c=>c.d<radius)
      .sort((a,b)=>a.d-b.d||b.order-a.order);
    if(!near.length)return null;
    const top=near[0].h,group=near.filter(c=>Math.hypot(c.h.sx-top.sx,c.h.sy-top.sy)<=stack);
    const at=group.findIndex(c=>c.h.key===previousKey),index=at<0?0:(at+1)%group.length;
    return {hit:group[index].h,index,count:group.length};
  }
  function mount(canvas,info,data,events,label,format){
    if(!data||!Array.isArray(data.terrain_runs))return {draw(){}};
    const size=data.size,scale=120/size;
    const pos=(x,y)=>project(x*scale,y*scale,120);
    const back=document.createElement('canvas');back.width=720;back.height=420;
    const bg=back.getContext('2d');bg.fillStyle='#eef1e8';bg.fillRect(0,0,720,420);
    let index=0;
    for(const [terrain,elevation,count] of data.terrain_runs){
      bg.fillStyle=data.terrain_names?.[terrain]?.colors?.level||'#879481';
      for(let i=0;i<count;i++,index++){
        const x=index%size,y=Math.floor(index/size),a=pos(x,y),b=pos(x+1,y),c=pos(x+1,y+1),d=pos(x,y+1);
        bg.beginPath();bg.moveTo(a.x,a.y);bg.lineTo(b.x,b.y);bg.lineTo(c.x,c.y);bg.lineTo(d.x,d.y);bg.closePath();bg.fill();
      }
    }
    for(const r of data.resources||[]){const p=pos(r.x,r.y);bg.fillStyle={gold:'#f1cb3e',stone:'#c1c7ce',berries:'#b34dc8'}[r.kind]||'#fff';bg.fillRect(p.x-2,p.y-2,4,4);}
    const ctx=canvas.getContext('2d');let hits=[],lastTime=0,focus=null,zoom=1,showActivity=true,selectedKey=null;
    const activityNames={MOVE:'이동 지시',ORDER:'대상 지시',PATROL:'순찰 지시',DE_ATTACK_MOVE:'공격 이동 지시',ATTACK_GROUND:'지면 공격 지시',AI_ORDER:'자동 이동 지시'};
    const short={'Town Center':'TC',House:'집',Farm:'농',Mill:'제',Barracks:'병',Stable:'기', 'Archery Range':'궁',Castle:'성',Market:'시',Monastery:'수','Lumber Camp':'목','Mining Camp':'광',Blacksmith:'대'};
    const sideColor=e=>e.side==='mine'?'#64f28d':'#ff6f70';
    const screen=p=>focus?{x:(p.x-focus.x)*zoom+360,y:(p.y-focus.y)*zoom+210}:p;
    // Label text stays about 11 CSS px tall however far the canvas is scaled down.
    const fontSize=()=>{const w=canvas.getBoundingClientRect?.()?.width;return Math.min(28,Math.max(10,11/(w>0?w/720:1)));};
    const labelRank=e=>e.initial?0:e.label==='Farm'?3:e.label==='House'?2:1;
    function draw(time){
      lastTime=time;ctx.clearRect(0,0,720,420);ctx.save();
      if(focus){ctx.translate(360-focus.x*zoom,210-focus.y*zoom);ctx.scale(zoom,zoom);}
      ctx.drawImage(back,0,0);hits=[];
      const buildings=visibleBuildings(data,events,time),font=fontSize(),markers=[],labels=[];
      const hit=(p,e)=>{const s=screen(p);hits.push({...p,sx:s.x,sy:s.y,key:`b:${e.side}:${e.label}:${e.x}:${e.y}`,event:e});return s;};
      // Wall runs are drawn first so they stay under town centers, houses, and the rest.
      for(const e of buildings){
        if(!isWallPiece(e.label))continue;
        const p=pos(e.x,e.y),r=/gate/i.test(e.label)?2:1.5;
        ctx.fillStyle=sideColor(e);ctx.strokeStyle='#18271e';ctx.lineWidth=.5/zoom;
        ctx.fillRect(p.x-r,p.y-r,r*2,r*2);ctx.strokeRect(p.x-r,p.y-r,r*2,r*2);
        hit(p,e);
      }
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${font/zoom}px sans-serif`;
      for(const e of buildings){
        if(isWallPiece(e.label))continue;
        const p=pos(e.x,e.y),isNew=!e.initial&&time-e.seconds<15;
        ctx.fillStyle=sideColor(e);ctx.strokeStyle=e.initial?'#fff':'#18271e';ctx.lineWidth=1/zoom;
        const radius=e.label==='Farm'?3:5;
        ctx.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);ctx.strokeRect(p.x-radius,p.y-radius,radius*2,radius*2);
        if(isNew){ctx.strokeStyle='#fff';ctx.strokeRect(p.x-8,p.y-8,16,16);}
        const s=hit(p,e),half=radius*zoom,id=markers.length;
        markers.push({id,box:{x:s.x-half,y:s.y-half,w:half*2,h:half*2}});
        if(zoom>1||e.initial){
          const text=short[e.label]||label(e.label).slice(0,2),measured=ctx.measureText(text)?.width*zoom;
          const w=measured>0?measured:labelWidth(text,font);
          // Inside the marker only when its colour stays visible around the text, otherwise just above it.
          const inside=font<=half*1.25,cy=inside?s.y:s.y-half-2-font/2;
          labels.push({id,text,event:e,x:p.x,y:p.y+(cy-s.y)/zoom,clear:!inside&&!e.initial,box:{x:s.x-w/2,y:cy-font/2,w,h:font}});
        }
      }
      // Rarer buildings first, then the newest request, so a crowded spot names what was added last.
      labels.sort((a,b)=>labelRank(a.event)-labelRank(b.event)||b.event.seconds-a.event.seconds);
      const shown=placeLabels(labels,markers,1,font*.15);
      ctx.lineJoin='round';ctx.lineWidth=Math.max(2,font/6)/zoom;ctx.strokeStyle='#102117';ctx.fillStyle='#fff';
      for(const [i,l] of labels.entries())if(shown[i]){ctx.strokeText(l.text,l.x,l.y);ctx.fillText(l.text,l.x,l.y);}
      ctx.textBaseline='alphabetic';
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
        const s=screen(p);
        hits.push({...p,sx:s.x,sy:s.y,key:`a:${e.side}:${e.group}:${e.seconds}:${e.x}:${e.y}`,event:{...e,marker:'activity'}});
      }
      ctx.globalAlpha=1;
      ctx.restore();
    }
    canvas.addEventListener('click',e=>{
      const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*720/r.width,y=(e.clientY-r.top)*420/r.height;
      const pick=pickHit(hits,x,y,selectedKey),selected=pick?pick.hit.event:null;
      selectedKey=pick?pick.hit.key:null;
      const more=pick&&pick.count>1?` · 겹친 표시 ${pick.index+1}/${pick.count}, 다시 누르면 다음`:'';
      info.textContent=selected?(selected.marker==='activity'?
        `${selected.side==='mine'?'나':'상대'} · ${activityNames[selected.kind]||'유닛 지시'} · ${format(selected.seconds)}${Number.isInteger(selected.selected_count)?' · 선택 '+selected.selected_count+'대상':''} · 명령 지점 ${selected.x}, ${selected.y}`:
        `${selected.side==='mine'?'나':'상대'} · ${label(selected.label)} · ${selected.initial?'시작 배치':format(selected.seconds)+' 건설 요청'} · 좌표 ${selected.x}, ${selected.y}`)+more:'표시를 누르면 지시 시각·선택 수·좌표를 볼 수 있어요.';
    });
    // Label size follows the displayed width, so redraw when the canvas is shown or resized.
    if(typeof ResizeObserver==='function')new ResizeObserver(()=>draw(lastTime)).observe(canvas);
    return {draw,activity(show){showActivity=show;draw(lastTime);},focus(side){const e=data.initial_buildings.find(e=>e.side===side&&e.label==='Town Center');focus=e?pos(e.x,e.y):null;zoom=e?2.6:1;draw(lastTime);}};
  }
  const api={project,visibleBuildings,recentActivity,isWallPiece,boxesOverlap,labelWidth,placeLabels,pickHit,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOBuildingMap=api;
})(typeof window==='undefined'?globalThis:window);
