import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const out=new URL('../test-results/homepage-current/production-anonymous/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),result={createdAt:new Date().toISOString(),origin:'https://mrxu.uk',productionReadOnly:true,noRealAccountLogin:true};
try{
 const context=await browser.newContext(),page=await context.newPage();await page.goto(result.origin,{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Service worker installation timed out')),20000))]);});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#coverage-state')?.dataset.state==='ready');
 const before=await page.evaluate(async()=>{const all=[];for(const name of await caches.keys()){const c=await caches.open(name);for(const r of await c.keys())all.push({cache:name,path:new URL(r.url).pathname});}return all;});
 assert(before.length>0);assert(!before.some(r=>r.path.startsWith('/api/')||r.path==='/changelog.json'||r.path.includes('print.html')||r.path.includes('question-bank')||r.path.includes('bank-practice')||r.path.startsWith('/licenses/')));
 const anonymous=await page.evaluate(async()=>{const r=await fetch('/api/v1/bank/questions',{credentials:'omit',cache:'no-store'});return{status:r.status,body:await r.json()};});assert.equal(anonymous.status,401);assert(!anonymous.body.data);
 await context.setOffline(true);const offlineAPI=await page.evaluate(async()=>{try{const r=await fetch('/api/v1/public/coverage',{credentials:'omit'});return{networkFailed:false,status:r.status,body:await r.text()};}catch{return{networkFailed:true};}});assert.equal(offlineAPI.networkFailed,true);
 await context.setOffline(false);result.passed=true;result.cachedResources=before.length;result.cacheKeys=[...new Set(before.map(x=>x.cache))];result.cachedPaths=before.map(x=>x.path).sort();result.protectedAPIStatus=anonymous.status;result.offlineAPINotServedFromCache=true;result.notice='Only this isolated test browser registered the public service worker; no production account or server data was modified.';await context.close();
 await writeFile(new URL('cache-results.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,cachedResources:result.cachedResources,cacheKeys:result.cacheKeys,offlineAPINotServedFromCache:true}));
}catch(e){result.passed=false;result.failure=e.message;await writeFile(new URL('cache-results.json',out),JSON.stringify(result,null,2));throw e;}finally{await browser.close();}
