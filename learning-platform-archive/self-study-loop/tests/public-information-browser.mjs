import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
const out=new URL('../test-results/homepage-current/information/',import.meta.url);await mkdir(out,{recursive:true});
const expectedLog=JSON.parse(await readFile(new URL('../public/changelog.json',import.meta.url),'utf8'));
const h=await browserHarness(),results=[];
try{
 for(const[profile,viewport]of[['desktop',{width:1440,height:1000}],['laptop',{width:1024,height:768}],['mobile',{width:390,height:844}],['narrow',{width:320,height:760}]]){
  const context=await h.browser.newContext({viewport}),page=await context.newPage(),errors=[],requests=[];
  page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(12000);
  page.on('pageerror',e=>errors.push(e.message));page.on('request',req=>requests.push({path:new URL(req.url()).pathname,cookie:req.headers().cookie}));
  for(const path of ['/','/sources.html','/changelog.html','/licenses.html','/about.html']){
   console.log(profile+' '+path);assert.equal((await page.goto(h.origin+path)).status(),200);if(path==='/')await page.locator('#latest-updates .update-item').first().waitFor();if(path==='/changelog.html')await page.locator('.changelog-entry').first().waitFor();if(path==='/licenses.html')await page.locator('#license-archive a').first().waitFor();
   assert.equal(await page.locator('h1').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,profile+path+' overflow');
   assert(await page.locator('header a[href="/sources.html"]:visible').count());assert(await page.locator('header a[href="/changelog.html"]:visible').count());
   assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('skip-link')),true);await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'main-content');
   if(path==='/changelog.html'){assert.equal(await page.locator('.changelog-entry').count(),expectedLog.entries.length);assert.equal(await page.locator('.change-status[data-status=published]').count(),expectedLog.entries.filter(e=>e.status==='published').length);assert((await page.locator('.change-meta').nth(1).innerText()).includes('2026/11/14'));}
   if(path==='/licenses.html'){assert((await page.locator('#license-archive a').count())>=11);for(const link of await page.locator('#license-archive a').evaluateAll(as=>as.map(a=>a.getAttribute('href'))))assert.equal((await page.request.get(h.origin+link,{timeout:5000})).status(),200,link);}
   if(path==='/sources.html'||path==='/changelog.html')await page.evaluate(()=>document.activeElement.blur());if(path==='/sources.html'||path==='/changelog.html')await page.screenshot({path:fileURLToPath(new URL(`${profile}-${path.slice(1).replace('.html','')}.png`,out)),fullPage:true});
   await page.emulateMedia({media:'print'});assert(await page.locator('h1').isVisible());if(path!=='/')assert(await page.locator('.site-header').isHidden());await page.emulateMedia({media:'screen'});
  }
  const apis=requests.filter(r=>r.path.startsWith('/api/'));assert(apis.every(r=>['/api/v1/public/coverage','/api/v1/public/ai-status'].includes(r.path)));assert(apis.every(r=>!r.cookie));assert.deepEqual(errors,[]);
  results.push({profile,checks:['five public routes anonymous HTTP200','sources and changelog visible in navigation','keyboard skip-link and focus','responsive no horizontal overflow','single-source changelog statuses','all listed license archive links HTTP200','print stylesheet preserves content','only anonymous public aggregate APIs','no business browser storage or JavaScript errors'],physicalDevice:false});await context.close();
 }
 await writeFile(new URL('browser-results.json',out),JSON.stringify({createdAt:new Date().toISOString(),results},null,2));console.log(JSON.stringify({passed:results.length,checks:results.reduce((n,r)=>n+r.checks.length,0)}));
}finally{await h.cleanup();}
