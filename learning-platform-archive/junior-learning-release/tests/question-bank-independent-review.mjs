// Read-only code review harness: isolated in-memory DB; never a production session.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {browserHarness} from '../../junior-learning-content-integration/tests/browser-harness.mjs';
import {importBank} from '../../junior-learning-content-integration/src/question-bank-import.mjs';
const out=new URL('../test-results/homepage-current/independent-bank-review/',import.meta.url);await mkdir(out,{recursive:true});
const h=await browserHarness(),results=[];
try{
 await importBank(h.DB,h.org);const teacher=await h.login('teacher');
 const q=(await h.request('/bank/questions?state=available&limit=30',{client:teacher})).data.items[0];
 const context=await h.browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
 await context.addCookies([{name:'lp_session',value:teacher.cookie.split('=')[1],url:h.origin,httpOnly:true,sameSite:'Strict'}]);const page=await context.newPage();page.setDefaultTimeout(8000);
 await page.goto(h.origin+'/question-bank.html');await page.getByLabel('状态',{exact:true}).selectOption('available');await page.getByRole('button',{name:'检索',exact:true}).click();await page.getByRole('button',{name:'查看与处理',exact:true}).first().click();await page.locator('#detail h2').waitFor();
 let sessionChecks=0;await page.route('**/api/v1/auth/session',async route=>{sessionChecks++;if(sessionChecks===2)await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEST_INJECTED_503',message:'Synthetic final recheck unavailable'}})});else await route.continue();});
 await page.getByRole('button',{name:'打印 / PDF',exact:true}).click();await page.getByText('Synthetic final recheck unavailable',{exact:true}).waitFor();
 await page.emulateMedia({media:'print'});const exposed=await page.locator('.print-document:visible').count();results.push({test:'failed final print authorization must leave no printable document',passed:exposed===0,visiblePrintDocuments:exposed,injectedFailure:'503 on final session recheck; not a real outage'});await page.emulateMedia({media:'screen'});await page.unroute('**/api/v1/auth/session');
 const edited=await h.request('/bank/questions/'+q.id,{client:teacher,method:'PATCH',body:{revision:q.revision,rationale:q.rationale+' 本次为隔离测试修订。',note:'隔离版本变更验证'}});assert.equal(edited.status,200);
 const download=page.waitForEvent('download',{timeout:4000}).then(async d=>{const path=await d.path(),body=JSON.parse(await readFile(path,'utf8'));return {filename:d.suggestedFilename(),revision:body.revision};}).catch(()=>null);
 await page.getByRole('button',{name:'JSON',exact:true}).click();const exported=await download;
 results.push({test:'export filename must bind to actual exported revision or reject stale view',passed:!exported||exported.filename.includes(`-v${exported.revision}.`),exported});
 await context.close();
 await writeFile(new URL('findings.json',out),JSON.stringify({createdAt:new Date().toISOString(),results},null,2));console.log(JSON.stringify(results));assert(results.every(r=>r.passed),'Independent bank review regression failed');
}finally{await h.cleanup();}
