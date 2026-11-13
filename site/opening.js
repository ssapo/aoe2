(function(global){
  'use strict';
  // Keep in parity with scripts/opening.py; labels describe development, not tactical intent.
  const families={'Scout Cavalry':'scouts','Camel Scout':'scouts',Archer:'archers',Militia:'militia','Man-at-Arms':'militia','Eagle Scout':'eagles','Eagle Warrior':'eagles',Spearman:'spears',Skirmisher:'skirmishers',Knight:'knights','Camel Rider':'camels','Cavalry Archer':'cavalry_archers'};
  const labels={scouts:'스카웃',archers:'궁사',militia:'시민군',eagles:'독수리 전사',spears:'창병',skirmishers:'척후병',knights:'기사',camels:'낙타',cavalry_archers:'궁기병'};
  const buildings={scouts:'Stable',archers:'Archery Range',eagles:'Barracks',militia:'Barracks'};
  const finite=v=>Number.isFinite(v)&&v>=0;
  function classify(metrics={},duration=0){
    const empty={opening:null,opening_label:null,opening_revision:2,opening_basis:'early_production_sequence_buildings_research'};
    if(!Array.isArray(metrics.full_timeline)||metrics.recording_restored)return empty;
    const timeline=metrics.full_timeline.filter(e=>finite(e.seconds)&&e.seconds<=duration).sort((a,b)=>a.seconds-b.seconds);
    const feudal=metrics.age_checkpoints?.봉건?.reached_seconds,castle=metrics.age_checkpoints?.성주?.reached_seconds;
    let anchor=finite(feudal)?feudal:metrics.age_commands?.봉건??600;if(!finite(anchor))anchor=600;
    const end=Math.min(duration,anchor+300,finite(castle)?castle:duration);
    const orders=timeline.filter(e=>['QUEUE','DE_QUEUE','MULTIQUEUE'].includes(e.kind)&&Number.isInteger(e.amount)&&e.amount>0&&families[e.label]);
    function group(family,start=0,stop=end){
      const events=orders.filter(e=>families[e.label]===family&&start<=e.seconds&&e.seconds<stop);
      return [events,events.reduce((n,e)=>n+e.amount,0)];
    }
    function commitment(family){
      const [events,count]=group(family);if(count<2)return null;
      for(let i=0;i<events.length;i++)if(events.slice(i).filter(e=>e.seconds<=events[i].seconds+120).reduce((n,e)=>n+e.amount,0)>=2)return events[i].seconds;
      return null;
    }
    const mains=['scouts','archers','militia','eagles'].map(f=>[commitment(f),f]).filter(([at])=>at!==null).sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1]));
    const sequence=[],add=(key,label=labels[key])=>sequence.push([key,label]);
    if(mains.length){
      const [at,family]=mains[0];
      for(const support of ['spears','skirmishers']){
        const [events,count]=group(support,0,at),buildingAt=timeline.find(e=>e.kind==='BUILD'&&e.label===buildings[family])?.seconds??at;
        if(count>=3&&at-events[0].seconds>=(buildingAt>=events[0].seconds?60:90)){add(support);break;}
      }
      for(let [at,family] of mains.slice(0,2)){
        let name=labels[family];
        if(family==='militia'){
          const maa=timeline.some(e=>e.kind==='RESEARCH'&&e.label==='Man-at-Arms'&&e.seconds<=end);
          name=maa?'무장 병사':finite(feudal)&&at<feudal?'드러시':'시민군';
          family=maa?'maa':name==='드러시'?'drush':family;
        }
        add(family,name);
      }
    }else if(finite(castle)&&castle<=duration){
      const late=[];
      for(const family of ['knights','camels','cavalry_archers','archers','eagles']){
        const [events,count]=group(family,castle,Math.min(duration+1,castle+240));if(count>=2)late.push([events[0].seconds,family]);
      }
      late.sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1]));
      if(late.length){add('castle','성주');add(late[0][1]);}
    }
    if(!sequence.length)for(const support of ['spears','skirmishers'])if(group(support)[1]>=3){add(support,labels[support]+' 중심');break;}
    return {...empty,opening:sequence.map(([k])=>k).join('_then_')||null,opening_label:sequence.map(([,v])=>v).join(' → ')||null};
  }
  const api={classify};
  if(typeof module==='object'&&module.exports)module.exports=api;else global.SSAPOOpening=api;
})(typeof window==='undefined'?globalThis:window);
