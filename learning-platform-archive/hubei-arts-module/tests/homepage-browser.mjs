import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {browserHarness} from './browser-harness.mjs';
const out=new URL('../test-results/homepage-current/',import.meta.url);
await mkdir(out,{recursive:true});
const h=await browserHarness();const results=[];
const sampleSubjects=[['math','数学',[7,8,9]],['english','英语',[7,8,9]],['chinese','语文',[]],['physics','物理',[]],['chemistry','化学',[]],['biology','生物',[]],['history','历史',[]],['geography','地理',[]],['civics','道德与法治',[]]];
const uiFixture={generatedAt:'2026-11-14T12:00:00Z',totals:{questionCount:18,catalogCount:18,publishedCount:0,reviewedCount:0,pendingCount:18,unreviewedCount:18,quarantinedCount:2,studentAvailableCount:0,studentPracticeCount:0,studentScoredCount:0,legacyExampleCount:0},subjects:sampleSubjects.map(([id,name,grades],i)=>({id,name,grades,questionCount:i<2?9:0,catalogCount:i<2?9:0,knowledgeCount:i<2?3:0,studentAvailableCount:0,studentPracticeCount:0,reviewedCount:0,status:i<2?'partial':'planned',note:i<2?'合成接口契约测试数据，非正式统计。':'待建设，按实际教材与学段确认。'}))};
try{
 for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}],['narrow',{width:320,height:760}]]){
  const context=await h.browser.newContext({viewport}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/'))requests.push({path:new URL(req.url()).pathname,cookie:req.headers().cookie});});
  await page.goto(h.origin+'/');await page.waitForFunction(()=>document.querySelector('#coverage-state').dataset.state!=='loading');
  assert.equal(await page.locator('h1').count(),1);assert(await page.getByRole('heading',{name:'三步闭环',exact:true}).isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,profile+' homepage overflow');
  assert.deepEqual([...new Set(requests.map(r=>r.path))].sort(),['/api/v1/public/ai-status','/api/v1/public/coverage']);assert(requests.every(r=>!r.cookie));
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  await page.screenshot({path:new URL(`${profile}-hero.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:false});
  // Explicit UI-only contract fixture, never an API/model availability assertion.
  await page.route('**/api/v1/public/coverage',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:uiFixture})}));
  await page.route('**/api/v1/public/ai-status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{status:'unavailable',label:'当前不可用',message:'合成接口契约测试：服务未启用。'}})}));
  await page.locator('#coverage-refresh').click();await page.waitForFunction(()=>document.querySelector('#coverage-state').dataset.state==='ready');
  assert.equal(await page.locator('.subject-card').count(),9);assert.equal(await page.locator('.coverage-total dd').first().innerText(),'18');
  assert.equal(await page.locator('.coverage-total dd').nth(2).innerText(),'0');assert((await page.locator('#ai-public-status').innerText()).includes('当前不可用'));
  await page.locator('#coverage').screenshot({path:new URL(`${profile}-coverage-contract.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,profile+' coverage overflow');
  await page.unroute('**/api/v1/public/coverage');await page.route('**/api/v1/public/coverage',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"UNAVAILABLE"}}'}));
  await page.locator('#coverage-refresh').click();await page.waitForFunction(()=>document.querySelector('#coverage-state').dataset.state==='error');
  assert(await page.locator('#coverage-totals').isHidden());assert(await page.locator('#coverage-subjects').isHidden());assert((await page.locator('#coverage-state').innerText()).includes('不提供估算题量'));
  await page.goto(h.origin+'/public-examples.html');assert(await page.locator('#pdf').isDisabled());assert(await page.locator('#print').isDisabled());
  assert.equal(await page.locator('.synthetic').count(),4);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,profile+' examples overflow');
  await page.locator('#checked').check();assert(await page.locator('#print').isEnabled());
  await page.evaluate(()=>{window.__printCalls=0;window.print=()=>window.__printCalls++;});await page.locator('#print').click();assert.equal(await page.evaluate(()=>window.__printCalls),1);
  await page.emulateMedia({media:'print'});assert(await page.locator('.toolbar').isHidden());assert(await page.locator('.sheet .synthetic').first().isVisible());await page.emulateMedia({media:'screen'});
  assert.deepEqual(errors,[]);results.push({profile,checks:['anonymous aggregate requests only; credentials omitted','no browser business storage','responsive homepage and nine-subject contract rendering','contract response displays exact counts and 0 human reviews','503 refresh hides stale counts','synthetic sample labels','print controls and print stylesheet','no JavaScript errors'],physicalDevice:false,aggregateFixture:'UI contract rendering only; not real production counts'});
  await context.close();
 }
 const login=await h.openRole('student',{width:1280,height:900});await login.page.getByRole('button',{name:'退出',exact:true}).click();await login.page.waitForURL(h.origin+'/');assert(await login.page.locator('#hero-heading').isVisible());await login.page.goto(h.origin+'/platform.html');await login.page.getByLabel('登录名',{exact:true}).waitFor();assert.equal(await login.page.locator('.integrated-app').count(),0);await login.context.close();
 results.push({profile:'navigation',checks:['real isolated student login/logout returns public homepage','unauthenticated platform page requests login']});
 await writeFile(new URL('browser-results.json',out),JSON.stringify({createdAt:new Date().toISOString(),environment:'Headless Chrome on Windows; isolated SQLite and synthetic accounts; not physical-device testing',results},null,2));
 console.log(JSON.stringify({passed:results.length,checks:results.reduce((n,r)=>n+r.checks.length,0),output:out.href}));
}finally{await h.cleanup();}
