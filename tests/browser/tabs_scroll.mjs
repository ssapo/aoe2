// Browser check: pressing a sub-tab inside an analysis tab must keep the reader's place (APP-18).
// Serves site/ locally, opens matches in headless Chromium at desktop and phone width and, for every
// sub-tab (matchup age tabs, 수치 segments, 시대업 / 생산·연구 / 복기 segments), checks that the tab bar
// stays where it was on screen and that no tab press leaves an analysis window or card without a panel.
//
//   node tests/browser/tabs_scroll.mjs [path/to/site]      (needs the `playwright` package + Chromium)
//
// Exit code 1 when a check fails. Not part of the Actions run.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
const site=path.resolve(process.argv[2]||path.join(here,'../../site'));
const TOLERANCE=4;   // px the tab bar may move on screen
const MATCHES=3;     // the first open renders the matchup card late; later opens find it ready (the old bug)

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const url=decodeURIComponent(new URL(req.url,'http://x').pathname);
  let file=path.join(site,url.replace(/^\/+/,''));
  if(!file.startsWith(site)){res.writeHead(403).end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'}).end(data);
  });
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;

const failures=[],rows=[];
const fail=(...m)=>{failures.push(m.join(' '));};

// in-page helpers
const place=([sel,offset])=>{const body=document.querySelector('.review-body'),bar=document.querySelector(sel);
  body.scrollTop+=bar.getBoundingClientRect().top-body.getBoundingClientRect().top-offset;};
const read=sel=>{const body=document.querySelector('.review-body'),bar=document.querySelector(sel),b=body.getBoundingClientRect(),r=bar.getBoundingClientRect();
  const visible=q=>[...document.querySelectorAll(q)].filter(p=>!p.hidden&&!p.closest('[hidden]')).length;
  return {scrollTop:Math.round(body.scrollTop),max:Math.round(body.scrollHeight-body.clientHeight),barTop:Math.round(r.top-b.top),
    barInView:r.top>=b.top-1&&r.bottom<=b.bottom+1,winY:Math.round(window.scrollY),
    analysisPanels:visible('#match-dialog [role="tabpanel"][id^="panel-"]'),
    cardPanels:document.querySelector('.matchup-card')?document.querySelectorAll('.matchup-card .mc-agepanel:not([hidden])').length:1,
    ageupPanels:document.querySelector('#panel-ages section[data-age-panel]')?document.querySelectorAll('#panel-ages section[data-age-panel]:not([hidden])').length:1};};

// APP-20: the sections each analysis tab shows right after a match opens (stable data-section ids, outside [hidden])
const PANELS=['summary','numbers','ages','production','timeline'];
async function sectionList(page){
  const out=[];
  for(const panel of PANELS){
    await page.click(`.review-tabs [data-panel="${panel}"]`);
    await page.waitForTimeout(80);
    out.push(panel+': '+(await page.evaluate(p=>[...document.querySelectorAll(`#panel-${p} [data-section]`)].filter(e=>!e.closest('[hidden]')).map(e=>e.dataset.section).join(' '),panel)));
  }
  await page.click('.review-tabs [data-panel="summary"]');
  return out.join('\n');
}
const seen=[];  // [label, match, list]
function sameSections(label){
  const mine=seen.filter(x=>x[0]===label);
  for(const [,id,list] of mine.slice(1))if(list!==mine[0][2])fail(label,`#${id} shows other sections than #${mine[0][1]}:\n${list}\n--- vs ---\n${mine[0][2]}`);
  rows.push(`${label} same sections in ${mine.length} matches: ${mine.length?mine[0][2].split('\n').map(l=>l.split(' ').length-1).join('/'):'-'} per tab`);
}

async function pressAll(page,label,panel,buttons,anchor,offset){
  await page.click(`.review-tabs [data-panel="${panel}"]`);
  await page.waitForTimeout(150);
  const top=await page.evaluate(()=>document.querySelector('.review-body').scrollTop);
  if(top!==0)fail(label,`big tab ${panel}: scrollTop ${top} (expected 0)`);
  const count=await page.locator(buttons).count();
  for(let i=0;i<count;i++){
    await page.evaluate(place,[anchor,offset]);await page.waitForTimeout(80);
    const before=await page.evaluate(read,anchor);
    const button=page.locator(buttons).nth(i),name=(await button.innerText()).replace(/\s+/g,' ').trim();
    await button.click();await page.waitForTimeout(200);
    const after=await page.evaluate(read,anchor);
    const moved=after.barTop-before.barTop,clamped=after.scrollTop>=after.max-1&&after.barInView;
    const ok=(Math.abs(moved)<=TOLERANCE||(moved>0&&clamped))&&after.winY===before.winY;
    rows.push(`${label} ${panel} [${name}] scrollTop ${before.scrollTop}→${after.scrollTop} bar ${before.barTop}→${after.barTop}px${clamped&&moved>TOLERANCE?' (shorter panel, end of page)':''}${ok?'':'  <-- JUMP'}`);
    if(!ok)fail(label,panel,`[${name}] bar moved ${moved}px (scrollTop ${before.scrollTop}→${after.scrollTop})`);
    if(after.analysisPanels!==1)fail(label,panel,`[${name}] ${after.analysisPanels} analysis panels visible`);
    if(after.cardPanels!==1)fail(label,panel,`[${name}] ${after.cardPanels} matchup panels visible`);
    if(after.ageupPanels!==1)fail(label,panel,`[${name}] ${after.ageupPanels} 시대업 panels visible`);
  }
  return count;
}

const browser=await chromium.launch();
try{
  for(const [label,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]){
    const context=await browser.newContext({viewport,hasTouch:label==='phone'});
    const page=await context.newPage();
    page.on('pageerror',e=>fail(label,'page error:',e.message));
    // nothing leaves this machine (Render collection server, analytics, fonts)
    await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
    await page.goto(base);
    await page.waitForSelector('button.match[data-match]',{timeout:20000});
    const ids=await page.$$eval('button.match[data-match]',b=>b.map(x=>x.dataset.match));
    let opened=0,withCard=0;
    for(const id of ids){
      if(opened>=MATCHES)break;
      await page.click(`button.match[data-match="${id}"]`);
      await page.waitForSelector('#match-dialog .review-tabs',{timeout:15000});
      await page.click('.review-tabs [data-panel="summary"]');
      const card=await page.waitForSelector('.matchup-card .mc-agetab',{timeout:8000}).catch(()=>null);
      if(card){
        withCard++;opened++;
        const tag=`${label} #${id}${opened>1?' (reopen)':''}`;
        seen.push([label,id,await sectionList(page)]);
        await pressAll(page,tag,'summary','.matchup-card .mc-agetab','.matchup-card .mc-ages',150);
        // a click inside the card (not on a tab) must not move anything either
        await page.evaluate(place,['.matchup-card .mc-ages',150]);
        const before=await page.evaluate(read,'.matchup-card .mc-ages');
        await page.locator('.matchup-card .mc-agepanel:not([hidden]) h4').first().click().catch(()=>{});
        await page.waitForTimeout(150);
        const after=await page.evaluate(read,'.matchup-card .mc-ages');
        rows.push(`${tag} summary [click inside card] scrollTop ${before.scrollTop}→${after.scrollTop}`);
        if(Math.abs(after.barTop-before.barTop)>TOLERANCE)fail(tag,`click inside the card moved the page ${after.barTop-before.barTop}px`);
        if(await page.locator('[data-review-stage]').count())await pressAll(page,tag,'summary','[data-review-stage]','[data-review-stage]',150);
        await pressAll(page,tag,'numbers','[data-numbers]','.numbers-segments',150);
        if(await page.locator('#panel-ages .segments button').count())await pressAll(page,tag,'ages','#panel-ages .segments button','#panel-ages .segments',150);
        await pressAll(page,tag,'production','[data-category]','#panel-production .segments',150);
      }
      await page.click('[data-close="match-dialog"]').catch(()=>page.keyboard.press('Escape'));
      await page.waitForTimeout(200);
    }
    if(withCard<2)fail(label,`only ${withCard} matches with a matchup card were checked`);
    // a sparse profile: a match without analysis and the oldest analysed one must show the same sections too
    await page.goto(base+'?profile=199325');
    await page.waitForSelector('button.match[data-match]',{timeout:20000});
    const sparse=await page.$$eval('button.match[data-match]',b=>[b.find(x=>/분석 대기|받지 못했어요|분석하지 못했어요/.test(x.textContent)),b.find(x=>x.textContent.includes('분석 완료'))].filter(Boolean).map(x=>x.dataset.match));
    for(const id of sparse){
      await page.click(`button.match[data-match="${id}"]`);
      await page.waitForSelector('#match-dialog .review-tabs',{timeout:15000});
      await page.waitForSelector('.matchup-card .mc-agetab',{timeout:8000}).catch(()=>null);
      seen.push([label,id,await sectionList(page)]);
      await page.click('[data-close="match-dialog"]').catch(()=>page.keyboard.press('Escape'));
      await page.waitForTimeout(200);
    }
    if(sparse.length<2)fail(label,`only ${sparse.length} sparse matches found on profile 199325`);
    sameSections(label);
    await context.close();
  }
}finally{await browser.close();server.close();}

console.log(rows.join('\n'));
if(failures.length){console.log(`\nFAIL ${failures.length}\n`+failures.map(f=>' - '+f).join('\n'));process.exit(1);}
console.log(`\nOK ${rows.length} presses`);
