// APP-20 (user rule 11-17): "모든 정보는 모든 경기에서 표시되어야 해. 이 경기에만 뜨는 정보는 없어야 해."
// Renders the analysis window of very different real matches with the site's own code and checks that every
// one of them has the same sections (stable data-section ids) in the same order; an empty part says why.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

const site=path.join(__dirname,'../site');
const read=file=>fs.readFileSync(path.join(site,file),'utf8');
const json=file=>JSON.parse(read(file));

async function loadSite(){
  const ctx=vm.createContext({console,URL,Intl,Date,Math,JSON,Promise,setTimeout,clearTimeout});
  ctx.window=ctx;ctx.globalThis=ctx;
  for(const file of ['civ-info.js','field-control.js','state-curve.js','housing.js','engine-income.js','opening.js','ranked-benchmarks.js','civ-matchup.js'])
    vm.runInContext(read(file),ctx,{filename:file});
  const ref=json('data/civ-reference.json');
  await ctx.SSAPOCivMatchup.load(()=>Promise.resolve({ok:true,json:()=>ref}));
  const app=read('app.js');
  const body=app.slice(app.indexOf('  const fmtTime'),app.indexOf('  let loadRequest=null;'));
  vm.runInContext(`
    const $=()=>null,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let report={profile:{id:26260702,name:'ssapo'},matches:[]},filter='all',visible=12,rankedData=null,selectedProfile=26260702,selectedName='ssapo',collectBusy=false;
    ${body}
    globalThis.__app={workspaceHtml,setReport:r=>{report=r;},setRanked:d=>{rankedData=d;},renderMatches:null};
  `,ctx,{filename:'app.js'});
  ctx.__app.setRanked(json('data/ranked-benchmarks.json'));
  return ctx;
}

const main=json('data/report.json');
const byId=(r,id)=>r.matches.find(m=>m.id===id);
const old=json('data/profiles/199325/report.json');
// An analysis of an old revision (7), kept as a fixture: the published data is re-analysed whenever the
// revision goes up, so no old row may be left in site/data (518336528 of profile 199325 as of revision 31).
const oldest=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/old_revision_match.json'),'utf8'));
const unanalysed=old.matches.find(m=>!m.analysis);
const cases=[
  ['no analysis',unanalysed],
  [`old revision ${oldest?.analysis?.analysis_revision}`,oldest],
  ['Arena, no Feudal army (520397411)',byId(main,520397411)],
  ['long game, other build (516293031)',byId(main,516293031)],
  ['engine data (521358922)',byId(main,521358922)],
];
const sections=html=>[...html.matchAll(/data-section="([^"]+)"/g)].map(x=>x[1]);

test('every match draws the same sections in the same order (APP-20)',async()=>{
  const ctx=await loadSite();
  for(const [name,m] of cases)assert.ok(m,`missing sample: ${name}`);
  assert.ok(!cases[0][1].analysis&&cases[1][1].analysis.analysis_revision<15,'the sparse samples are really sparse');
  assert.ok(cases[4][1].analysis.engine_income&&!cases[3][1].analysis.engine_income);
  const lists=cases.map(([name,m])=>{
    ctx.__app.setReport({profile:{id:26260702,name:'ssapo'},matches:[m]});
    const html=ctx.__app.workspaceHtml(m);
    assert.doesNotMatch(html,/undefined|NaN|\[object Object\]/,name);
    return [name,sections(html),html];
  });
  const [first,list]=lists[0];
  for(const [name,other] of lists.slice(1))assert.deepEqual(other,list,`${name} vs ${first}`);
  // the parts the user named are among them, in this order
  const must=['housing','age-gaps','ranked-quick','practice','openings','findings','matchup','mc-decided','mc-flow','mc-army','mc-armybox','mc-prods','mc-pairs',
    'mc-upgrades','mc-avoid','mc-threat','mc-counter','mc-gap','mc-calc','mc-more','basics','ranked','state-curve','engine-income','numbers','ageup','production','field-activity','map','field-stats','history'];
  let at=-1;
  for(const id of must){const i=list.indexOf(id,at+1);assert.ok(i>at,`${id} after position ${at}`);at=i;}
  // the matchup card: 봉건 / 성주 / 왕정 / 전체 tabs and a 병력 비교 box in each of them
  for(const [name,,html] of lists){
    for(const age of ['2','3','4','all'])assert.match(html,new RegExp(`class="mc-agetab" data-age="${age}"`),name);
    assert.equal((html.match(/data-section="mc-armybox"/g)||[]).length,4,name);
    assert.equal((html.match(/data-ageup="/g)||[]).length,3,name);
    assert.equal((html.match(/data-numbers="/g)||[]).length,6,name);
    assert.equal((html.match(/data-review-stage="/g)||[]).length,5,name);
  }
});

test('empty parts say why in their own place',async()=>{
  const ctx=await loadSite();
  const html=m=>{ctx.__app.setReport({profile:{id:26260702,name:'ssapo'},matches:[m]});return ctx.__app.workspaceHtml(m);};
  const none=html(cases[0][1]);
  assert.match(none,/리플을 받지 못해 분석이 없어요|분석하지 못했어요|분석 전이에요/);
  const arena=html(cases[2][1]);
  // the Feudal tab of the Arena game: both sides made (almost) no army — the line may stay, the tab stays
  const feudal=arena.slice(arena.indexOf('data-age="2" aria-label'),arena.indexOf('data-age="3" aria-label'));
  assert.match(feudal,/양쪽 모두 병력이 거의 없었어요/);
  assert.match(arena,/엔진 재현이 원본과 맞는 구간이 5분 미만/);
  const longGame=html(cases[3][1]);
  assert.match(longGame,/게임 버전\(빌드 185872\)이 달라/);
  // a match where I never reached Imperial: the 왕정 parts are there with the reason
  assert.match(longGame,/나는 왕정시대에 가지 않았어요/);
  const engine=html(cases[4][1]);
  assert.match(engine,/data-section="engine-income"[^>]*><h3 class="detail-heading">자원별 누적 수입 <small>/);
  assert.match(engine,/data-section="animals"/);
  assert.match(html(cases[1][1]),/예전 분석\(개정 \d+\)/);
});
