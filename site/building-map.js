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
  // Tiles per side of the in-game footprint, only for buildings whose size is certain.
  // Build coordinates are footprint centres: even sizes sit on whole tiles, odd sizes on half tiles.
  const FOOTPRINT={'Town Center':4,House:2,Mill:2,'Lumber Camp':2,'Mining Camp':2,Farm:3,Barracks:3,'Archery Range':3,Stable:3,
    Blacksmith:3,Monastery:3,Market:4,University:4,'Siege Workshop':4,Castle:4,Dock:3,Krepost:3,Donjon:2,Wonder:5,
    Outpost:1,'Watch Tower':1,'Guard Tower':1,Keep:1,'Bombard Tower':1};
  const footprint=name=>Object.prototype.hasOwnProperty.call(FOOTPRINT,name)?FOOTPRINT[name]:null;
  // Marker half-width/half-height in map px. Known footprints are tile-aligned diamonds
  // (6x3 px per tile at `scale` 1), never narrower than `minHalfWidth` so they stay visible on
  // the full map. Unknown buildings keep the plain 10 px square.
  function markerShape(name,scale=1,minHalfWidth=0){
    const tiles=footprint(name);
    if(!tiles)return {diamond:false,tiles:null,hw:5,hh:5};
    const hw=Math.max(tiles*3*scale,minHalfWidth);
    return {diamond:true,tiles,hw,hh:hw/2};
  }
  // Starting resource tiles of one kind that lie within `reach` tiles of each other form one
  // patch. These are positions at game start only; amounts and depletion are not tracked.
  function resourcePatches(resources,reach=2){
    const left=(resources||[]).filter(r=>r&&Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.kind),patches=[];
    while(left.length){
      const group=[left.shift()];
      for(let i=0;i<group.length;i++)for(let j=left.length-1;j>=0;j--)
        if(left[j].kind===group[i].kind&&Math.abs(left[j].x-group[i].x)<=reach&&Math.abs(left[j].y-group[i].y)<=reach)group.push(left.splice(j,1)[0]);
      const mean=key=>group.reduce((sum,r)=>sum+r[key],0)/group.length;
      patches.push({kind:group[0].kind,count:group.length,x:mean('x'),y:mean('y')});
    }
    return patches;
  }
  // What the map key has to explain for this match, in display order.
  function legendItems(data,events=[]){
    const items=[{key:'build',text:'건설 요청'}];
    if([...(data.initial_buildings||[]),...events.filter(e=>e.kind==='BUILD')].some(e=>isWallPiece(e.label)))items.push({key:'wall',text:'성벽·성문'});
    const kinds=['gold','stone','berries'].filter(kind=>(data.resources||[]).some(r=>r.kind===kind));
    if(kinds.length)items.push({key:'resources',kinds,text:'시작 위치'});
    return items;
  }
  // Click reach in canvas px for a canvas shown at `cssScale` (CSS px per canvas px):
  // at least 22 CSS px around a marker, so a fingertip does not have to land on it.
  const hitRadius=cssScale=>Math.max(18,22/(cssScale>0?cssScale:1));
  const stackRadius=cssScale=>Math.max(8,5/(cssScale>0?cssScale:1));
  const SIDE={mine:'#64f28d',theirs:'#ff6f70'},RESOURCE={gold:'#f1cb3e',stone:'#c1c7ce',berries:'#b34dc8'};
  const RESOURCE_NAME={gold:'금',stone:'돌',berries:'열매'};
  function legendHtml(items){
    const swatch=(shape,color)=>`<i class="key-${shape}" style="background:${color}"></i>`;
    return `<ul class="map-key" aria-label="지도 표식 설명">${items.map(item=>item.key==='build'?`<li>${swatch('build',SIDE.mine)}${swatch('build',SIDE.theirs)}${item.text}</li>`:
      item.key==='wall'?`<li>${swatch('wall',SIDE.mine)}${swatch('wall',SIDE.theirs)}${item.text}</li>`:
      `<li>${item.kinds.map(kind=>`${swatch('resource',RESOURCE[kind])}${RESOURCE_NAME[kind]}`).join(' ')}<small>${item.text}</small></li>`).join('')}</ul>`;
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
    for(const r of data.resources||[]){const p=pos(r.x,r.y);bg.fillStyle=RESOURCE[r.kind]||'#fff';bg.fillRect(p.x-2,p.y-2,4,4);}
    const patches=resourcePatches(data.resources).map(r=>({...r,x:Math.round(r.x),y:Math.round(r.y),marker:'resource',p:pos(r.x,r.y)}));
    if(typeof canvas.insertAdjacentHTML==='function')canvas.insertAdjacentHTML('afterend',legendHtml(legendItems(data,events)));
    const ctx=canvas.getContext('2d');let hits=[],lastTime=0,focus=null,zoom=1,showActivity=true,selectedKey=null;
    const activityNames={MOVE:'이동 지시',ORDER:'대상 지시',PATROL:'순찰 지시',DE_ATTACK_MOVE:'공격 이동 지시',ATTACK_GROUND:'지면 공격 지시',AI_ORDER:'자동 이동 지시'};
    const short={'Town Center':'TC',House:'집',Farm:'농',Mill:'제',Barracks:'병',Stable:'기', 'Archery Range':'궁',Castle:'성',Market:'시',Monastery:'수','Lumber Camp':'목','Mining Camp':'광',Blacksmith:'대'};
    const sideColor=e=>SIDE[e.side==='mine'?'mine':'theirs'];
    const screen=p=>focus?{x:(p.x-focus.x)*zoom+360,y:(p.y-focus.y)*zoom+210}:p;
    // Label text stays about 11 CSS px tall however far the canvas is scaled down.
    const cssScale=()=>{const w=canvas.getBoundingClientRect?.()?.width;return w>0?w/720:1;};
    const fontSize=()=>Math.min(28,Math.max(10,11/cssScale()));
    const diamond=(p,hw,hh)=>{ctx.beginPath();ctx.moveTo(p.x-hw,p.y);ctx.lineTo(p.x,p.y-hh);ctx.lineTo(p.x+hw,p.y);ctx.lineTo(p.x,p.y+hh);ctx.closePath();};
    const labelRank=e=>e.initial?0:e.label==='Farm'?3:e.label==='House'?2:1;
    // Ring around the picked marker, so it is clear which one the info line describes.
    // Only the last `count` hits are looked at.
    function ring(count){
      const picked=count>0?hits.slice(-count).find(h=>h.key===selectedKey):null;if(!picked)return;
      const r=Math.max(picked.reach||0,7/zoom);
      for(const [width,color] of [[3,'#102117'],[1.5,'#fff']]){ctx.beginPath();ctx.arc(picked.x,picked.y,r,0,Math.PI*2);ctx.lineWidth=width/zoom;ctx.strokeStyle=color;ctx.stroke();}
    }
    function draw(time){
      lastTime=time;ctx.clearRect(0,0,720,420);ctx.save();
      if(focus){ctx.translate(360-focus.x*zoom,210-focus.y*zoom);ctx.scale(zoom,zoom);}
      ctx.drawImage(back,0,0);hits=[];
      const buildings=visibleBuildings(data,events,time),font=fontSize(),markers=[],labels=[];
      const hit=(p,e,reach=0)=>{const s=screen(p);hits.push({...p,sx:s.x,sy:s.y,reach,key:`b:${e.side}:${e.label}:${e.x}:${e.y}`,event:e});return s;};
      // Starting resource patches sit under everything, so any marker on top is picked first.
      for(const r of patches){const s=screen(r.p);hits.push({...r.p,sx:s.x,sy:s.y,reach:4,key:`r:${r.kind}:${r.x}:${r.y}`,event:r});}
      // Markers narrower than about 6 CSS px on screen are widened to that, so the full map stays readable on a phone.
      const minHalfWidth=3/cssScale()/zoom;
      // Wall runs are drawn first so they stay under town centers, houses, and the rest.
      for(const e of buildings){
        if(!isWallPiece(e.label))continue;
        const p=pos(e.x,e.y),r=/gate/i.test(e.label)?2:1.5;
        ctx.fillStyle=sideColor(e);ctx.strokeStyle='#18271e';ctx.lineWidth=.5/zoom;
        ctx.fillRect(p.x-r,p.y-r,r*2,r*2);ctx.strokeRect(p.x-r,p.y-r,r*2,r*2);
        hit(p,e,r+2);
      }
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${font/zoom}px sans-serif`;
      for(const e of buildings){
        if(isWallPiece(e.label))continue;
        const p=pos(e.x,e.y),isNew=!e.initial&&time-e.seconds<15;
        ctx.fillStyle=sideColor(e);ctx.strokeStyle=e.initial?'#fff':'#18271e';ctx.lineWidth=1/zoom;
        const shape=markerShape(e.label,scale,minHalfWidth),{hw,hh}=shape;
        if(shape.diamond){
          diamond(p,hw,hh);ctx.fill();ctx.stroke();
          if(isNew){ctx.strokeStyle='#fff';diamond(p,hw+4,hh+2);ctx.stroke();}
        }else{
          ctx.fillRect(p.x-hw,p.y-hh,hw*2,hh*2);ctx.strokeRect(p.x-hw,p.y-hh,hw*2,hh*2);
          if(isNew){ctx.strokeStyle='#fff';ctx.strokeRect(p.x-8,p.y-8,16,16);}
        }
        // A diamond leaves its bounding-box corners empty, so labels only have to stay off its middle.
        const s=hit(p,e,hw+2),id=markers.length,solid=shape.diamond?.6:1,bw=hw*zoom*solid,bh=hh*zoom*solid;
        markers.push({id,box:{x:s.x-bw,y:s.y-bh,w:bw*2,h:bh*2}});
        if(zoom>1||e.initial){
          const text=short[e.label]||label(e.label).slice(0,2),measured=ctx.measureText(text)?.width*zoom;
          const w=measured>0?measured:labelWidth(text,font);
          // Inside the marker only when its colour stays visible around the text, otherwise just above it.
          const inside=shape.diamond?font<=hh*zoom*1.2&&w<=hw*zoom*1.2:font<=hw*zoom*1.25,cy=inside?s.y:s.y-hh*zoom-2-font/2;
          labels.push({id,text,event:e,x:p.x,y:p.y+(cy-s.y)/zoom,clear:!inside&&!e.initial,box:{x:s.x-w/2,y:cy-font/2,w,h:font}});
        }
      }
      // The ring goes under the labels so it never crosses out a name; unit orders get theirs last.
      ring(hits.length);const activityFrom=hits.length;
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
        hits.push({...p,sx:s.x,sy:s.y,reach:radius+2/zoom,key:`a:${e.side}:${e.group}:${e.seconds}:${e.x}:${e.y}`,event:{...e,marker:'activity'}});
      }
      ctx.globalAlpha=1;
      ring(hits.length-activityFrom);
      ctx.restore();
    }
    canvas.addEventListener('click',e=>{
      const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*720/r.width,y=(e.clientY-r.top)*420/r.height;
      const k=r.width/720,pick=pickHit(hits,x,y,selectedKey,hitRadius(k),stackRadius(k)),selected=pick?pick.hit.event:null;
      selectedKey=pick?pick.hit.key:null;
      const more=pick&&pick.count>1?` · 겹친 표시 ${pick.index+1}/${pick.count}, 다시 누르면 다음`:'';
      info.textContent=selected?(selected.marker==='resource'?
        `${RESOURCE_NAME[selected.kind]} ${selected.count}칸 · 경기 시작 때 위치 · 좌표 ${selected.x}, ${selected.y}`:selected.marker==='activity'?
        `${selected.side==='mine'?'나':'상대'} · ${activityNames[selected.kind]||'유닛 지시'} · ${format(selected.seconds)}${Number.isInteger(selected.selected_count)?' · 선택 '+selected.selected_count+'대상':''} · 명령 지점 ${selected.x}, ${selected.y}`:
        `${selected.side==='mine'?'나':'상대'} · ${label(selected.label)} · ${selected.initial?'시작 배치':format(selected.seconds)+' 건설 요청'} · 좌표 ${selected.x}, ${selected.y}`)+more:'표식을 누르면 요청 시각·좌표가 나와요.';
      draw(lastTime);
    });
    // Label size follows the displayed width, so redraw when the canvas is shown or resized.
    if(typeof ResizeObserver==='function')new ResizeObserver(()=>draw(lastTime)).observe(canvas);
    return {draw,activity(show){showActivity=show;draw(lastTime);},focus(side){const e=data.initial_buildings.find(e=>e.side===side&&e.label==='Town Center');focus=e?pos(e.x,e.y):null;zoom=e?2.6:1;draw(lastTime);}};
  }
  const api={project,visibleBuildings,recentActivity,isWallPiece,boxesOverlap,labelWidth,placeLabels,pickHit,footprint,markerShape,resourcePatches,legendItems,hitRadius,stackRadius,mount};if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOBuildingMap=api;
})(typeof window==='undefined'?globalThis:window);
