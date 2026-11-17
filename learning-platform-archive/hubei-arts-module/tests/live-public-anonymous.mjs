// Production read-only verification. No credentials, writes, synthetic users, or model jobs.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const origin='https://mrxu.uk';
const out=new URL('../test-results/homepage-current/production-anonymous/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const evidence={startedAt:new Date().toISOString(),origin,productionReadOnly:true,noRealAccountLogin:true,noModelJobs:true,physicalDevice:false,profiles:[],routes:[],security:[],cache:[],release:null,coverage:null,aiStatus:null,changelog:null};
const localLinks=new Set();
try{
 const probe=await browser.newContext();
 for(const[path,key]of[['/release.json','release'],['/api/v1/public/coverage','coverage'],['/api/v1/public/ai-status','aiStatus'],['/changelog.json','changelog']]){
  const r=await probe.request.get(origin+path,{timeout:15000});assert.equal(r.status(),200,path);const body=await r.json();evidence[key]=body.data||body;evidence.routes.push({path,status:r.status(),cacheControl:r.headers()['cache-control']});
 }
 const expected={questionCount:336,knowledgeCount:112,catalogCount:324,reviewedCount:12,unreviewedCount:324,quarantinedCount:3,studentPracticeCount:4,studentScoredCount:12,legacyExampleCount:12};for(const[k,v]of Object.entries(expected))assert.equal(evidence.coverage.totals[k],v,k);
 assert.equal(evidence.coverage.subjects.length,9);assert(!/correctOption|rationale|password|token|studentId|username/.test(JSON.stringify(evidence.coverage)));
 assert(['limited','unavailable'].includes(evidence.aiStatus.status));assert.equal(evidence.aiStatus.capabilities.generation,false);assert.equal(evidence.aiStatus.capabilities.grading,false);
 for(const path of ['/api/v1/students','/api/v1/attempts','/api/v1/bank/questions','/api/v1/bank/practice','/api/v1/ai-lab/status','/api/v1/content/review-queue','/api/v1/uploads']){
  const r=await probe.request.get(origin+path,{timeout:15000});const payload=await r.json();assert.equal(r.status(),401,path);assert(!payload.data,path);evidence.security.push({path,status:r.status(),code:payload.error?.code});
 }
 for(const path of ['/.env','/.git/config','/.local/production.sqlite','/src/api.mjs','/data/question-bank/catalog.json','/migrations/0001_initial.sql','/release/production-deployment.json']){
  const r=await probe.request.get(origin+path,{timeout:15000});assert.equal(r.status(),404,path);evidence.security.push({path,status:r.status()});
 }
 await probe.close();
 for(const[profile,viewport]of[['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}],['narrow',{width:320,height:760}]]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[],apiRequests=[];
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiRequests.push({path:new URL(r.url()).pathname,method:r.method()});});
  for(const path of ['/','/sources.html','/changelog.html','/licenses.html','/public-examples.html','/login.html']){
   console.log(profile+' '+path);const r=await page.goto(origin+path,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,path);
   if(path==='/'){await page.waitForFunction(()=>document.querySelector('#coverage-state')?.dataset.state==='ready');await page.locator('#latest-updates .update-item').first().waitFor();assert.deepEqual(await page.locator('.coverage-total dd').allTextContents(),['336','4','12','324']);await page.waitForFunction(()=>!document.querySelector('#ai-public-status').textContent.includes('正在核实'));assert.equal(await page.locator('.subject-card').count(),9);}
   if(path==='/sources.html')await page.waitForFunction(()=>!document.querySelector('#source-ai-state').textContent.includes('正在核实'));
   if(path==='/changelog.html'){await page.locator('.changelog-entry').first().waitFor();assert.equal(await page.locator('.changelog-entry').count(),evidence.changelog.entries.length);}
   if(path==='/licenses.html')await page.locator('#license-archive a').first().waitFor();
   if(path==='/login.html'){await page.getByLabel('登录名',{exact:true}).waitFor();assert.equal(await page.locator('.integrated-app').count(),0);}
   if(path==='/public-examples.html'){assert(await page.locator('#pdf').isDisabled());assert(await page.locator('#print').isDisabled());assert.equal(await page.locator('.synthetic').count(),4);}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,profile+path+' overflow');
   assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0,path+' browser storage');
   if(['/', '/sources.html','/changelog.html','/licenses.html'].includes(path)){
    assert(await page.locator('header a[href="/sources.html"]:visible').count());assert(await page.locator('header a[href="/changelog.html"]:visible').count());
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('skip-link')),true,path+' keyboard skip link');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'main-content');await page.evaluate(()=>document.activeElement.blur());
   }
   const urls=await page.locator('a[href]').evaluateAll(as=>as.map(a=>a.href));for(const href of urls){const u=new URL(href);if(u.origin===origin)localLinks.add(u.pathname+u.search);}
   if(path!=='/login.html')await page.screenshot({path:fileURLToPath(new URL(`${profile}-${path==='/'?'homepage':path.slice(1).replace('.html','')}.png`,out)),fullPage:true});
   evidence.routes.push({profile,path,status:r.status(),cacheControl:r.headers()['cache-control'],overflow:false});
  }
  assert(apiRequests.every(r=>r.method==='GET'));assert(apiRequests.every(r=>['/api/v1/public/coverage','/api/v1/public/ai-status','/api/v1/auth/session'].includes(r.path)));assert.deepEqual(errors,[]);
  const cache=await page.evaluate(async()=>{const all=[];for(const name of await caches.keys()){const c=await caches.open(name);for(const req of await c.keys())all.push({cache:name,path:new URL(req.url).pathname});}return all;});
  assert(!cache.some(r=>r.path.startsWith('/api/')||r.path==='/changelog.json'||r.path.startsWith('/licenses/')||r.path.includes('print.html')||r.path.includes('question-bank')||r.path.includes('bank-practice')));
  evidence.cache.push({profile,resources:cache.length,keys:[...new Set(cache.map(r=>r.cache))],noPrivateAPIsOrData:true});
  evidence.profiles.push({profile,viewport,passed:true,pageErrors:errors,apiRequests,noPrivateStorage:true});await context.close();
 }
 const linksContext=await browser.newContext();for(const path of localLinks){const r=await linksContext.request.get(origin+path,{timeout:15000});assert.equal(r.status(),200,path);evidence.routes.push({path,status:r.status(),kind:'public-link'});}await linksContext.close();
 evidence.completedAt=new Date().toISOString();evidence.localLinks=[...localLinks].sort();evidence.passed=true;
 await writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed:true,profiles:evidence.profiles.length,publicLinks:localLinks.size,securityChecks:evidence.security.length,coverage:evidence.coverage.totals,aiStatus:evidence.aiStatus.status,changelog:evidence.changelog.entries.map(e=>({version:e.version,status:e.status,publishedAt:e.publishedAt})),output:fileURLToPath(out)}));
}catch(error){evidence.passed=false;evidence.failure=error.message;evidence.failedAt=new Date().toISOString();await writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));throw error;}finally{await browser.close();}
