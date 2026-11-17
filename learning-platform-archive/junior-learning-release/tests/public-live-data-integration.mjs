import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
import {importBank} from '../src/question-bank-import.mjs';
const out=new URL('../test-results/homepage-current/real-local-api/',import.meta.url);await mkdir(out,{recursive:true});
const h=await browserHarness(),results=[];
try{
 const imported=await importBank(h.DB,h.org);assert.equal(imported.imported,324);
 let coverage=(await h.request('/public/coverage')).data;
 assert.equal(coverage.totals.questionCount,336);assert.equal(coverage.totals.knowledgeCount,112);assert.equal(coverage.totals.reviewedCount,0);assert.equal(coverage.totals.unreviewedCount,336);assert.equal(coverage.totals.studentPracticeCount,4);assert.equal(coverage.totals.studentScoredCount,0);
 const teacher=await h.login('teacher');await h.review(teacher);
 const response=await h.request('/public/coverage');assert.equal(response.status,200);coverage=response.data;
 const expected={questionCount:336,knowledgeCount:112,catalogCount:324,reviewedCount:12,unreviewedCount:324,quarantinedCount:3,studentPracticeCount:4,studentScoredCount:12,studentAvailableCount:16,legacyExampleCount:12};
 for(const[key,value]of Object.entries(expected))assert.equal(coverage.totals[key],value,key);
 assert.equal(coverage.subjects.length,9);assert.equal(coverage.subjects.filter(s=>s.catalogCount>0).length,2);
 assert(!/correctOption|rationale|password|token|studentId|username|reviewedBy/.test(JSON.stringify(coverage)));
 assert.equal(h.DB.sqlite.prepare('SELECT count(*) n FROM attempts').get().n,0);
 results.push({test:'actual isolated API import and synthetic teacher reviews update aggregates',passed:true,totals:coverage.totals,notice:'These are local synthetic test counts, not a production read. No real teacher review claim.'});
 const qid=h.DB.sqlite.prepare('SELECT id FROM bank_heads LIMIT 1').get().id;
 for(const path of ['/bank/questions','/bank/questions/'+qid,'/bank/questions/'+qid+'/export?format=json','/bank/questions/'+qid+'/export?format=csv','/bank/practice','/students','/attempts','/ai-lab/status'])assert.equal((await h.request(path)).status,401,path);
 const student=await h.login('student');
 assert.equal((await h.request('/bank/questions',{client:student})).status,403);assert.equal((await h.request('/ai-lab/status',{client:student})).status,403);
 const practice=(await h.request('/bank/practice',{client:student})).data;assert.equal(practice.length,4);assert(practice.every(q=>!('correctOption'in q)&&!('rationale'in q)));
 results.push({test:'anonymous protected APIs and student role boundaries',passed:true,anonymousRoutesChecked:8,practiceAnswersWithheld:true});
 const allLinks=new Set();
 for(const[profile,viewport]of[['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await h.browser.newContext({viewport}),page=await context.newPage(),errors=[],apiRequests=[];
  page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiRequests.push({path:new URL(r.url()).pathname,cookie:r.headers().cookie});});
  // A cookie is present to verify public fetches explicitly omit it.
  await context.addCookies([{name:'lp_session',value:student.cookie.split('=')[1],url:h.origin,httpOnly:true,sameSite:'Strict'}]);
  await page.goto(h.origin+'/');await page.waitForFunction(()=>document.querySelector('#coverage-state').dataset.state==='ready');await page.locator('#latest-updates .update-item').first().waitFor();
  assert.deepEqual(await page.locator('.coverage-total dd').allTextContents(),['336','4','12','324']);
  const detail=await page.locator('#coverage-detail').innerText();for(const phrase of ['本轮题库目录 324 题','原有示例 12 题','严重疑点隔离 3 题','正式测评 12 题'])assert(detail.includes(phrase),phrase);
  assert.equal(await page.locator('.subject-card').count(),9);
  for(const subject of coverage.subjects){const card=page.locator('.subject-card').filter({has:page.getByRole('heading',{name:subject.name,exact:true})});assert.equal(await card.count(),1);const values=await card.locator('dd').allTextContents();assert.deepEqual(values,[subject.questionCount,subject.studentPracticeCount,subject.reviewedCount,subject.knowledgeCount].map(n=>n.toLocaleString('zh-CN')));}
  await page.waitForFunction(()=>!document.querySelector('#ai-public-status').textContent.includes('正在核实'));
  assert((await page.locator('#ai-public-status').innerText()).includes('暂不可用'));
  await page.locator('#coverage').screenshot({path:fileURLToPath(new URL(`${profile}-real-local-coverage.png`,out)),style:".site-header,.skip-link{visibility:hidden!important}"});
  for(const path of ['/','/sources.html','/changelog.html','/licenses.html','/about.html','/public-examples.html']){
   assert.equal((await page.goto(h.origin+path)).status(),200);if(path==='/licenses.html')await page.locator('#license-archive a').first().waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,profile+path);
   const links=await page.locator('a[href]').evaluateAll(as=>as.map(a=>({href:a.getAttribute('href'),absolute:a.href})));
   for(const link of links){const url=new URL(link.absolute);if(url.origin===h.origin){if(url.pathname===path&&url.hash)assert(await page.locator(url.hash).count(),path+url.hash);allLinks.add(url.pathname+url.search);}}
  }
  for(const link of allLinks)assert.equal((await page.request.get(h.origin+link,{timeout:8000})).status(),200,link);
  assert(apiRequests.every(r=>['/api/v1/public/coverage','/api/v1/public/ai-status'].includes(r.path)));assert(apiRequests.every(r=>!r.cookie));assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  results.push({test:profile+' actual API coverage and all public navigation links',passed:true,coverageCounts:['336','4','12','324'],linksChecked:allLinks.size,publicFetchOmittedSessionCookie:true,aiStatus:'unavailable because local service is not configured; no mock bridge',physicalDevice:false});
  await context.close();
 }
 const swContext=await h.browser.newContext(),swPage=await swContext.newPage();await swPage.goto(h.origin+'/');
 await swPage.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 const cached=await swPage.evaluate(async()=>{const all=[];for(const name of await caches.keys()){const cache=await caches.open(name);for(const req of await cache.keys())all.push(new URL(req.url).pathname);}return all;});
 assert(cached.length>0);assert(!cached.some(path=>path.startsWith('/api/')||path==='/changelog.json'||path.startsWith('/licenses/')||path.includes('question-bank')||path.includes('bank-practice')||path.includes('print.html')));
 results.push({test:'real service worker caches public shells only',passed:true,cachedResources:cached.length,noAPIsOrReleaseDataOrProtectedPrint:true});await swContext.close();
 await writeFile(new URL('results.json',out),JSON.stringify({createdAt:new Date().toISOString(),environment:'Isolated in-memory SQLite with packaged source data and synthetic accounts; actual local API, no route mocks; never production',results,localLinks:[...allLinks].sort(),aggregate:coverage},null,2));
 console.log(JSON.stringify({passed:results.length,localLinks:allLinks.size,totals:coverage.totals,output:fileURLToPath(out)}));
}finally{await h.cleanup();}
