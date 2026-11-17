import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const origin='https://mrxu.uk',out=new URL('../test-results/homepage-current/production-final-changelog/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),evidence={startedAt:new Date().toISOString(),origin,readOnly:true,anonymous:true,files:[],profiles:[]};
try{
 const context=await browser.newContext();
 for(const file of ['changelog.json','public-info.js']){
  const response=await context.request.get(origin+'/'+file,{headers:{'Cache-Control':'no-cache'},timeout:15000});assert.equal(response.status(),200,file);
  const live=await response.body(),local=await readFile(new URL('../public/'+file,import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(sha(live),sha(local),file+' deployment hash mismatch');
  evidence.files.push({path:'/'+file,status:response.status(),sha256:sha(live),matchesLocalSource:true,cacheControl:response.headers()['cache-control']});if(file==='changelog.json')evidence.changelog=JSON.parse(live.toString('utf8'));
 }
 await context.close();
 const log=evidence.changelog;assert.equal(log.entries.length,3);assert.equal(log.entries.filter(e=>e.status==='published').length,2);assert.equal(log.entries.filter(e=>e.status==='planned').length,1);
 assert.equal(log.entries[0].version,'production-20261114.2');assert.equal(log.entries[0].publishedAt,'2026-11-14T12:03:38.183349Z');assert.equal(log.entries[2].publishedAt,null);
 for(const[profile,viewport]of[['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const c=await browser.newContext({viewport}),page=await c.newPage(),errors=[],jsonRequests=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname==='/changelog.json')jsonRequests.push(r.url());});
  assert.equal((await page.goto(origin+'/changelog.html',{waitUntil:'domcontentloaded'})).status(),200);await page.locator('.changelog-entry').nth(2).waitFor();
  assert.equal(await page.locator('.change-status[data-status=published]').count(),2);assert.equal(await page.locator('.change-status[data-status=planned]').count(),1);
  const labels=await page.locator('.change-status').allTextContents();assert.deepEqual(labels,['已正式上线','已正式上线','计划中']);
  const firstTime=await page.locator('.changelog-entry .change-meta').first().innerText();assert(firstTime.includes('2026/11/14 20:03:38'));const plannedText=await page.locator('.changelog-entry').nth(2).innerText();assert(/未排期/.test(plannedText));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:fileURLToPath(new URL(`${profile}-final-changelog.png`,out)),fullPage:true});
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});await page.locator('#latest-updates .update-item').nth(1).waitFor();assert.deepEqual(await page.locator('#latest-updates h4').allTextContents(),log.entries.slice(0,2).map(e=>e.title));assert.deepEqual(await page.locator('#latest-updates .change-status').allTextContents(),['已正式上线','已正式上线']);
  assert(jsonRequests.length>=2);assert(jsonRequests.every(url=>new URL(url).origin===origin));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.locator('.credits-section').scrollIntoViewIfNeeded();await page.screenshot({path:fileURLToPath(new URL(`${profile}-final-home-summary.png`,out)),fullPage:false});
  evidence.profiles.push({profile,viewport,logEntries:3,published:2,planned:1,firstPublishedBeijing:'2026-11-14 20:03:38',plannedDate:null,homeSummaryMatchesSameOriginData:true,noOverflow:true,pageErrors:errors});await c.close();
 }
 evidence.passed=true;evidence.completedAt=new Date().toISOString();await writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed:true,profiles:2,entries:3,published:2,planned:1,files:evidence.files,output:fileURLToPath(out)}));
}catch(e){evidence.passed=false;evidence.failure=e.message;await writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));throw e;}finally{await browser.close();}
