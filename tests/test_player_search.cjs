const {test}=require('node:test'),assert=require('node:assert/strict');
const {profileId,search}=require('../site/player-search.js');
const players=[{id:199325,name:'VIT | Hera',rank:3,rating:3000},{id:12,name:'Hera fan',rank:200},{id:14,name:'SameName',rank:50},{id:15,name:'SameName',rank:60}];
test('Hera Korean alias and ID resolve without confusing names',()=>{assert.equal(search(players,'헤라')[0].id,199325);assert.equal(search(players,'199325').length,1);assert.equal(search(players,'hera').length,2);});
test('same names retain separate profile IDs and casefolding',()=>{assert.equal(search(players,'samename').length,2);assert.equal(search(players,'ＳａｍｅＮａｍｅ').length,2);});
test('profile paths accept only bounded positive integers',()=>{for(const x of ['../1','1/2','1;echo hi','0','-1','1e3','https://x', '999999999999999999'])assert.equal(profileId(x),null);assert.equal(profileId(' 199325 '),199325);});
test('late account response cannot overwrite the newly selected profile',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),code=fs.readFileSync(require('node:path').join(__dirname,'../site/app.js'),'utf8');
 const pending=new Map(),controls={disabled:false};
 const ctx=vm.createContext({window:{SSAPOReportStore:require('../site/report-store.js')},console,Date,loadRankedBenchmarks:async()=>null,render(){},$:()=>controls,fetch:url=>new Promise(resolve=>pending.set(url,resolve))});
 vm.runInContext("let selectedProfile=199325,selectedName='Hera',report={matches:[]};const liveReports=new Map();const Stored=window.SSAPOReportStore,reportStore={get:async()=>null,put:async()=>true};const dataPath=(id,file)=>`data/profiles/${id}/${file}`;",ctx);
 vm.runInContext(code.slice(code.indexOf('  let loadRequest=null;'),code.indexOf('  async function selectProfile(')),ctx);
 const first=vm.runInContext('load()',ctx);vm.runInContext('selectedProfile=123;selectedName="Other";',ctx);const second=vm.runInContext('load()',ctx);
 const urls=[...pending.keys()];pending.get(urls[1])({ok:true,status:200,json:async()=>({schema_version:1,profile:{id:123,name:'Other'},matches:[]})});await second;
 pending.get(urls[0])({ok:true,status:200,json:async()=>({schema_version:1,profile:{id:199325,name:'Hera'},matches:[]})});await first;
 assert.equal(vm.runInContext('report.profile.id',ctx),123);
});
function appContext(fetch,saved){
 const fs=require('node:fs'),vm=require('node:vm'),code=fs.readFileSync(require('node:path').join(__dirname,'../site/app.js'),'utf8');
 const controls={disabled:false},puts=[];
 const ctx=vm.createContext({window:{SSAPOReportStore:require('../site/report-store.js')},console:{warn(){}},Date,loadRankedBenchmarks:async()=>null,render(){},$:()=>controls,fetch,puts,saved});
 vm.runInContext("let selectedProfile=199325,selectedName='Hera',report={profile:{id:199325},matches:[]};const liveReports=new Map();const Stored=window.SSAPOReportStore,reportStore={get:async()=>saved,put:async r=>{puts.push(r);return true;}};const dataPath=(id,file)=>`data/profiles/${id}/${file}`;",ctx);
 vm.runInContext(code.slice(code.indexOf('  let loadRequest=null;'),code.indexOf('  async function selectProfile(')),ctx);
 return {ctx,puts};
}
const saved={schema_version:1,profile:{id:199325,name:'Hera'},last_checked_at:'2026-11-10T01:00:00Z',matches:[{id:1},{id:2}]};
test('reload keeps a saved direct collection when the profile has no published report',async()=>{
 const {ctx}=appContext(async()=>({ok:false,status:404}),saved);
 await vm_load(ctx);assert.equal(require('node:vm').runInContext('report.matches.length',ctx),2);
});
test('reload keeps the saved report over an older published one, and saves a newer published one',async()=>{
 const older={...saved,last_checked_at:'2026-11-09T23:00:00Z',matches:[{id:1}]};
 let {ctx,puts}=appContext(async()=>({ok:true,status:200,json:async()=>older}),saved);
 await vm_load(ctx);assert.equal(require('node:vm').runInContext('report.matches.length',ctx),2);assert.equal(puts.length,0);
 const newer={...saved,last_checked_at:'2026-11-10T02:00:00Z',matches:[{id:1},{id:2},{id:3}]};
 ({ctx,puts}=appContext(async()=>({ok:true,status:200,json:async()=>newer}),saved));
 await vm_load(ctx);assert.equal(require('node:vm').runInContext('report.matches.length',ctx),3);assert.equal(puts.length,1);
});
test('a failed fetch does not empty the list',async()=>{
 const {ctx}=appContext(async()=>{throw Error('network');},saved);
 await vm_load(ctx);
 assert.equal(require('node:vm').runInContext('report.matches.length',ctx),2);
 assert.match(require('node:vm').runInContext('report.sync_error',ctx),/읽지 못했어요/);
});
function vm_load(ctx){return require('node:vm').runInContext('load()',ctx);}
