const {test}=require('node:test'),assert=require('node:assert/strict');
const b=require('../site/ranked-benchmarks.js'),state=require('../site/state-curve.js');
const context={map:'Arabia',opening:'scouts',civilization:'Franks',profileId:99,matchId:999};
const sample=(match_id,profile_id,value)=>({match_id,profile_id,name:`P${profile_id}`,rating:2500,started_at:`2026-11-${String(match_id).padStart(2,'0')}`,map:'Arabia',opening:'scouts',opening_label:'정찰 기병',civilization:'Franks',ages:{봉건:value}});
const source={schema_version:1,min_rating:2000,samples:[...Array.from({length:8},(_,i)=>sample(i+1,1,100)),sample(9,2,1000)]};

test('reference balances players, excludes own and current match, keeps map strict and uses the narrowest tier with enough games',()=>{
 const r=b.select(source,context,s=>s.ages.봉건);
 assert.equal(r.median,550);assert.equal(r.players,2);assert.equal(r.matches,9);assert.equal(r.sameCiv,true);
 assert.equal(r.tier,'map');assert.deepEqual(r.maps,['Arabia']);assert.deepEqual(r.filters,['civ','opening']);assert.equal(b.basis(r),'같은 맵 · Franks · 정찰 기병 9경기');
 assert.equal(b.select(source,{...context,profileId:1},s=>s.ages.봉건),null);
 assert.equal(b.select(source,{...context,matchId:9},s=>s.ages.봉건),null);
 assert.equal(b.select(source,{...context,map:'Islands'},s=>s.ages.봉건),null);
 assert.equal(b.select(source,{...context,opening:'archers'},s=>s.ages.봉건).median,550);
 assert.equal(b.select(source,{...context,opening:null},s=>s.ages.봉건).median,550);
 const mixed=b.select(source,{...context,civilization:'Mayans'},s=>s.ages.봉건);
 assert.equal(mixed.sameCiv,false);
 assert.equal(b.select({...source,samples:source.samples.slice(0,3)},context,s=>s.ages.봉건),null);
});

test('resource and villager comparison uses same clock, age, TC intent and sufficient coverage',()=>{
 const s={schema_version:1,min_rating:2000,samples:Array.from({length:6},(_,i)=>({...sample(i+1,i%2+1,500),checkpoints:{600:{resources:{value:500,stage:'암흑',tc:'single'},villagers:{value:25,stage:'봉건',tc:'single'}}}}))};
 const match={id:999,map:'Arabia',analysis:{civilization:'Franks',duration_game_seconds:900,metrics:{full_timeline:[],age_checkpoints:{봉건:{command_seconds:400,reached_seconds:530}}},review:{own:{available:true,opening:'scouts',checkpoints:[{seconds:600,villager_requests:23}]}},state_curve:{points:Array.from({length:91},(_,i)=>[i*10,1000,500])}}};
 const c=b.compare(match,99,s,state);
 assert.equal(c.resources.length,1);assert.equal(c.resources[0].value,1000);assert.equal(c.resources[0].delta,500);
 assert.equal(c.villagers[0].delta,-2);assert.equal(c.ages[0].value,530);
 match.analysis.metrics.full_timeline.push({kind:'BUILD',label:'Town Center',seconds:550});
 assert.equal(b.compare(match,99,s,state).resources.length,0);
 match.analysis.metrics.full_timeline=[];
 match.analysis.state_curve.points=match.analysis.state_curve.points.filter(p=>p[0]<400||p[0]>500);
 assert.equal(b.compare(match,99,s,state).resources.length,0);
 match.analysis.metrics.recording_restored=true;
 assert.deepEqual(b.compare(match,99,s,state).ages,[]);
});

test('render keeps one hero, no fixed 1000 judgement or false rates, omits source names',()=>{
 const reference={median:500,q1:300,q3:700,sameCiv:false,players:2,matches:6,openingLabel:'정찰 기병',names:['<script>']};
 const r={minRating:2000,resources:[{label:'5–10분 평균',start:300,end:600,at:600,value:700,peak:900,reference,delta:200}],ages:[],villagers:[]};
 const html=b.render(r,true);
 assert.equal((html.match(/<article /g)||[]).length,1);assert.match(html,/2000\+ 중앙값/);
 assert.doesNotMatch(html,/1,000 이상|사용률|소비량|상대가|<script>|NaN|undefined/);
 assert.doesNotMatch(b.render(r),/script|비교 선수|문명 혼합|2명|6경기/);
 r.ages=[{label:'봉건 도달',age:'봉건',value:603.4,reference,delta:103.4}];
 assert.match(b.render(r,true),/10:03/);
 assert.equal(b.render({resources:[],ages:[],villagers:[]}), '');
});

test('own resource card survives missing or mismatched reference data without inventing benchmarks',()=>{
 const points=Array.from({length:61},(_,i)=>[i*10,2000,500]);
 const match={id:42,map:'Arabia',analysis:{duration_game_seconds:600,state_curve:{points}}};
 const c=b.compare(match,99,null,state),html=b.render(c,true);
 assert.equal(c.resources.length,0);assert.equal(c.ownResources[0].value,2000);
 assert.equal(c.ownResources[0].peak,2000);assert.equal(c.ownResources[0].opponent,500);
 assert.match(html,/내 자원 흐름/);assert.match(html,/최대 보유/);assert.match(html,/2,000/);
 assert.doesNotMatch(html,/2000\+|중앙값|1,000 이상|비교 선수|NaN|undefined/);
 const legacy={...match,analysis:{...match.analysis,state_curve:{points:points.map(p=>[p[0],p[1],null,p[2],999])}}};
 assert.deepEqual(b.compare(legacy,99,source,state).ownResources,c.ownResources);
 const gap={...match,analysis:{...match.analysis,state_curve:{points:[[300,2000,500],[600,2000,500]]}}};
 assert.equal(b.compare(gap,99,null,state).ownResources.length,0);
});

// Same development cases as the Python classifier, including defensive additions.
test('opening describes early investment sequence independently of the first unit',()=>{
 const opening=require('../site/opening.js'),cases=require('./fixtures/openings.json');
 for(const c of cases)assert.equal(opening.classify(c.metrics,c.duration).opening,c.opening,c.name);
});

test('a map with too few games falls back to its map group and says which maps; the same map is kept when it is enough',()=>{
 const on=(map,id,player,value,civilization='Franks')=>({...sample(id,player,value),map,civilization});
 const src={schema_version:1,min_rating:2000,samples:[on('Arabia',1,1,100),on('Arabia',2,2,300),...Array.from({length:6},(_,i)=>on('Arabian Desert',i+3,i%2+1,200,'Mayans')),on('Atacama',9,3,200),on('Arena',10,4,900),on('MegaRandom',11,5,900)]};
 const r=b.select(src,context,s=>s.ages.봉건);
 assert.equal(r.tier,'group');assert.equal(r.group,'open');assert.equal(r.matches,9);assert.equal(r.players,3);assert.equal(r.sameCiv,false);
 assert.deepEqual(r.maps,['Arabian Desert','Arabia','Atacama']);assert.equal(r.median,200);
 assert.deepEqual(r.filters,['opening']);assert.equal(b.basis(r),'열린 맵 · 정찰 기병 9경기');
 // the same civilization is preferred inside the group tier too
 const civ=b.select(src,{...context,civilization:'Mayans'},s=>s.ages.봉건);
 assert.equal(civ.tier,'group');assert.equal(civ.sameCiv,true);assert.equal(civ.matches,6);assert.deepEqual(civ.maps,['Arabian Desert']);
 // enough games on the map itself: the group is not used
 const desert=b.select(src,{...context,map:'Arabian Desert'},s=>s.ages.봉건);
 assert.equal(desert.tier,'map');assert.equal(desert.matches,6);assert.deepEqual(desert.maps,['Arabian Desert']);
 // closed maps do not borrow from open ones, and a map in no group borrows from nobody
 assert.deepEqual(b.choose(src,{...context,map:'Arena'},s=>s.ages.봉건),{reference:null,shortage:{same:1,group:1}});
 assert.deepEqual(b.choose(src,{...context,map:'Islands'},s=>s.ages.봉건),{reference:null,shortage:{same:0,group:null}});
 assert.equal(b.groupOf('Hideout').id,'closed');assert.equal(b.groupOf('MegaRandom'),null);
});

test('compare and render name the basis, or give one short reason when no tier has enough games',()=>{
 const on=(map,id,player)=>({...sample(id,player,500),map});
 const src={schema_version:1,min_rating:2000,samples:[...Array.from({length:6},(_,i)=>on('Arabian Desert',i+1,i%2+1)),on('Arena',7,3),on('Hideout',8,4)]};
 const match=map=>({id:999,map,analysis:{civilization:'Franks',duration_game_seconds:900,metrics:{full_timeline:[],age_checkpoints:{봉건:{command_seconds:400,reached_seconds:530}}},review:{own:{available:true,opening:'scouts',checkpoints:[]}}}});
 const arabia=b.compare(match('Arabia'),99,src,state);
 assert.equal(arabia.ages[0].reference.tier,'group');assert.equal(arabia.shortage,undefined);
 const html=b.render(arabia),quick=b.render(arabia,true);
 assert.match(html,/기준: 2000점 이상 · 열린 맵 · Franks · 정찰 기병 6경기/);assert.match(html,/같은 맵 기준 경기가 부족해서/);
 assert.match(quick,/열린 맵 · Franks · 정찰 기병 6경기/);assert.doesNotMatch(html+quick,/부족해요|undefined|NaN/);
 const desert=b.render(b.compare(match('Arabian Desert'),99,src,state));
 assert.match(desert,/기준: 2000점 이상 · 같은 맵 · Franks · 정찰 기병 6경기/);assert.doesNotMatch(desert,/열린 맵/);
 const arena=b.compare(match('Arena'),99,src,state);
 assert.deepEqual(arena.ages,[]);assert.deepEqual(arena.shortage,{same:1,group:2});
 assert.equal(b.shortageText(arena),'이 맵은 2000점 이상 기준 경기가 부족해요(같은 맵 1경기, 같은 종류 맵 2경기; 5경기·2명 이상 필요)');
 assert.match(b.render(arena,true),/ranked-shortage/);
 assert.equal(b.shortageText(b.compare(match('Islands'),99,src,state)),'이 맵은 2000점 이상 기준 경기가 부족해요(같은 맵 0경기, 열린 맵·닫힌 맵 어느 쪽에도 안 넣은 맵; 5경기·2명 이상 필요)');
 assert.equal(b.shortageText(arabia),'');assert.equal(b.render(b.compare(match('Arena'),99,null,state)),'');
 const evil=b.compare({...match('<img>'),map:'<img>'},99,src,state);
 assert.doesNotMatch(b.render(evil),/<img>/);
});

test('Socotra and Steppe count as open maps, Black Forest as closed',()=>{
  const b=require('../site/ranked-benchmarks.js');
  assert.equal(b.groupOf('Socotra').id,'open');assert.equal(b.groupOf('Steppe').id,'open');assert.equal(b.groupOf('Black Forest').id,'closed');
  assert.equal(b.groupOf('MegaRandom'),null);assert.equal(b.kindLabel(['Arena']),'닫힌 맵');
});

test('tier order: place first, then civilization, then opening; label names the filters in Korean when names are known',()=>{
 const on=(id,player,civilization,opening,map='Arabia')=>({...sample(id,player,100+id),civilization,opening,opening_label:opening==='scouts'?'스카웃':'궁사',map});
 // 3 Franks-scouts, 3 Franks-archers, 4 Mayans-scouts on Arabia; 6 Franks-scouts on Arabian Desert
 const src={schema_version:1,min_rating:2000,samples:[on(1,1,'Franks','scouts'),on(2,2,'Franks','scouts'),on(3,1,'Franks','scouts'),on(4,2,'Franks','archers'),on(5,1,'Franks','archers'),on(6,2,'Franks','archers'),
  on(7,3,'Mayans','scouts'),on(8,4,'Mayans','scouts'),on(9,3,'Mayans','scouts'),on(10,4,'Mayans','scouts'),...Array.from({length:6},(_,i)=>on(20+i,5+i%2,'Franks','scouts','Arabian Desert'))]};
 const pick=s=>s.ages.봉건;
 let r=b.select(src,context,pick); // map+civ+opening has 3 -> map+civ has 6
 assert.equal(r.tier,'map');assert.deepEqual(r.filters,['civ']);assert.equal(r.matches,6);
 r=b.select(src,{...context,civilization:'Mayans'},pick); // map+Mayans+scouts has 4 games but 2 players -> 4 < 5; map+civ 4; map+opening 7
 assert.deepEqual(r.filters,['opening']);assert.equal(r.matches,7);
 r=b.select(src,{...context,civilization:'Celts',opening:'eagles'},pick);
 assert.deepEqual(r.filters,[]);assert.equal(r.matches,10);assert.equal(b.basis(r),'같은 맵 10경기');
 r=b.select(src,{...context,map:'Atacama'},pick); // nothing on Atacama: open group, Franks+scouts = 3+6
 assert.equal(r.tier,'group');assert.deepEqual(r.filters,['civ','opening']);assert.equal(r.matches,9);
 globalThis.SSAPOCivNames={Franks:'프랑크'};
 try{assert.equal(b.basis(r),'열린 맵 · 프랑크 · 스카웃 9경기');}finally{delete globalThis.SSAPOCivNames;}
 assert.equal(b.basis({tier:'group',maps:['Arena'],matches:5,filters:[]}),'닫힌 맵 5경기');
 // older references without filters still read
 assert.equal(b.basis({tier:'map',matches:5,sameCiv:false}),'같은 맵 5경기');
});

const engine=(until,own,opp,animals)=>({verified_until_seconds:until,by_source:{points:Array.from({length:Math.floor(until/10)},(_,i)=>{const t=(i+1)*10,k=t/until;return [t,...own.map(v=>Math.round(v*k)),...opp.map(v=>Math.round(v*k))];})},animals});
test('engine food at whole minutes: hunt joins boar and deer, rest joins fish and other, left counts only finished animals with full',()=>{
 const animals={until_seconds:300,own:[{kind:'sheep',eaten:80,full:100,last_seconds:200},{kind:'boar',eaten:300,full:400,last_seconds:290},{kind:'deer',eaten:100,last_seconds:250},{kind:'sheep',eaten:50,full:100,last_seconds:310}],opponent:[]};
 const f=b.foodAt(engine(310,[600,200,100,90,0,5,5,0,0],[0,0,0,0,0,0,0,0,0],animals));
 assert.equal(f.until,310);assert.deepEqual(Object.keys(f.at).map(Number),[60,120,180,240,300]);
 assert.deepEqual(f.at[300],[581,291,87,0,10]);assert.equal(f.left[300],120);assert.equal(f.left[240],20);
 assert.equal(f.left[360],undefined);
 assert.equal(b.foodAt(engine(310,[1,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],{until_seconds:300,own:[{kind:'sheep',eaten:80,last_seconds:100}],opponent:[]})).left,undefined); // engine without full
 assert.equal(b.foodAt(engine(310,[1,0,0,0,0,0,0,0,0],[2,0,0,0,0,0,0,0,0]),1).at[300][0],2);
 assert.equal(b.foodAt(null),null);assert.equal(b.foodAt({verified_until_seconds:300}),null);
});

test('food rows compare shares and food left at the clamped common time with pros verified that long; nothing when data is missing',()=>{
 const sampleFood=(id,player,until,at,left)=>({...sample(id,player,500),food:{until,at,left}});
 const pro=(id,player,until=700)=>sampleFood(id,player,until,{'300':[400,300,200,100,0],'600':[500,900,400,200,0]},{'300':40,'600':150});
 const src={schema_version:1,min_rating:2000,samples:[...Array.from({length:6},(_,i)=>pro(i+1,i%2+1)),sampleFood(7,3,350,{'300':[0,1000,0,0,0]},{'300':999})]};
 const animals={until_seconds:700,own:[{kind:'sheep',eaten:60,full:100,last_seconds:500}],opponent:[]};
 const analysis={civilization:'Franks',duration_game_seconds:1200,metrics:{full_timeline:[],age_checkpoints:{}},review:{own:{available:true,opening:'scouts',checkpoints:[]}},engine_income:engine(705,[700,500,200,300,300,0,0,0,0],[0,0,0,0,0,0,0,0,0],animals)};
 const r=b.compare({id:999,map:'Arabia',analysis},99,src,state);
 assert.equal(r.food.seconds,600);
 const by=Object.fromEntries(r.food.rows.map(x=>[x.label,x]));
 assert.equal(by['가축 비율'].value,35);assert.equal(by['가축 비율'].reference.median,25);assert.equal(by['사냥 비율'].reference.median,45);
 assert.equal(by['사냥 비율'].reference.matches,6); // the game verified only to 5:50 is left out at 10:00
 assert.equal(by['남긴 식량'].value,40);assert.equal(by['남긴 식량'].reference.median,150);
 const html=b.render(r),quick=b.render(r,true);
 assert.match(html,/식량 출처 비교 <small>10:00 시점<\/small>/);assert.match(html,/가축 비율<\/th><td>35%<\/td><td>25%<\/td><td>10%p 높음/);
 assert.match(html,/남긴 식량<\/th><td>40<\/td><td>150<\/td><td>110 적음/);assert.match(html,/기준: 2000점 이상 · 같은 맵 · Franks · 정찰 기병 6경기/);
 assert.match(quick,/10:00 (가축|사냥|열매|농장) 비율/);assert.match(quick,/10:00 남긴 식량 <b>40<\/b>/);
 assert.doesNotMatch(html+quick,/undefined|NaN/);
 // an early verified end: compared at 5:00, the short game counts too
 const early=b.compare({id:999,map:'Arabia',analysis:{...analysis,engine_income:engine(330,[700,500,200,300,300,0,0,0,0],[0,0,0,0,0,0,0,0,0])}},99,src,state);
 assert.equal(early.food.seconds,300);assert.equal(early.food.rows.find(x=>x.label==='사냥 비율').reference.matches,7);
 assert.equal(early.food.rows.some(x=>x.left),false); // no `full` in this game: no food-left row
 // too short, no engine, or no pro food: nothing
 assert.equal(b.compare({id:999,map:'Arabia',analysis:{...analysis,engine_income:engine(230,[1,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0])}},99,src,state).food,null);
 assert.equal(b.compare({id:999,map:'Arabia',analysis:{...analysis,engine_income:null}},99,src,state).food,null);
 const none=b.compare({id:999,map:'Arabia',analysis},99,{...src,samples:src.samples.map(({food,...s})=>s)},state);
 assert.equal(none.food,null);assert.doesNotMatch(b.render(none),/식량 출처/);
 // escaped label text
 const evil=b.compare({id:999,map:'Arabia',analysis:{...analysis,civilization:'<b>x'}},99,{...src,samples:src.samples.map(s=>({...s,civilization:'<b>x',opening_label:'<i>'}))},state);
 assert.doesNotMatch(b.render(evil)+b.render(evil,true),/<b>x|<i>/);
});
