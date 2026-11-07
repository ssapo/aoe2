const {test}=require('node:test'),assert=require('node:assert/strict');
const b=require('../site/ranked-benchmarks.js'),state=require('../site/state-curve.js');
const context={map:'Arabia',opening:'scouts',civilization:'Franks',profileId:99,matchId:999};
const sample=(match_id,profile_id,value)=>({match_id,profile_id,name:`P${profile_id}`,rating:2500,started_at:`2026-11-${String(match_id).padStart(2,'0')}`,map:'Arabia',opening:'scouts',opening_label:'정찰 기병',civilization:'Franks',ages:{봉건:value}});
const source={schema_version:1,min_rating:2000,samples:[...Array.from({length:8},(_,i)=>sample(i+1,1,100)),sample(9,2,1000)]};

test('reference balances players, excludes own and current match, and keeps map strict without filtering by opening',()=>{
 const r=b.select(source,context,s=>s.ages.봉건);
 assert.equal(r.median,550);assert.equal(r.players,2);assert.equal(r.matches,9);assert.equal(r.sameCiv,true);
 assert.equal(b.select(source,{...context,profileId:1},s=>s.ages.봉건),null);
 assert.equal(b.select(source,{...context,matchId:9},s=>s.ages.봉건),null);
 assert.equal(b.select(source,{...context,map:'Arabian Desert'},s=>s.ages.봉건),null);
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
