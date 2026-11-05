const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function render(point){
  const code=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
  const ctx=vm.createContext({report:{},label:String,esc:String,number:n=>Number.isFinite(n)?String(n):'—',fmtTime:String});
  vm.runInContext(code.slice(code.indexOf('  const ageList ='),code.indexOf('  function renderProductionPanel(')),ctx);
  ctx.metrics={age_checkpoints:{'봉건':point}};
  return vm.runInContext('renderAgePanel(metrics,{},null)',ctx);
}

test('age table masks partial counts per unit and retains complete recent window',()=>{
  const html=render({command_seconds:400,unit_requests_before_click:{Villager:10,Archer:3,Militia:2},
    unit_requests_previous_120s:{Villager:2,Archer:1},unknown_unit_request_amounts:['Archer','Knight'],
    unknown_unit_request_amounts_previous_120s:[]});
  assert.match(html,/Archer — · Militia 2 · Knight —/);
  assert.doesNotMatch(html,/Archer 3/);
  assert.match(html,/Villager 2 · Archer 1/);
});

test('legacy snapshots mask uncertain recent amounts rather than inventing zero or a partial total',()=>{
  const html=render({command_seconds:400,unit_requests_before_click:{Villager:10,Archer:3},
    unit_requests_previous_120s:{Villager:2,Archer:1},unknown_unit_request_amounts:['Archer','Knight']});
  assert.match(html,/Villager 2 · Archer — · Knight —/);
  assert.doesNotMatch(html,/Archer 1/);
  assert.doesNotMatch(html,/지시 없음/);
});
