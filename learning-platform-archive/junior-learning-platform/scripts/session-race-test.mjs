import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {browserHarness} from '../tests/browser-harness.mjs';
import {TEST_PASSWORD} from '../tests/helpers.mjs';
import {root} from './environment.mjs';
const h=await browserHarness();const results=[];
try{
  const {page}=await h.openRole('teacher',{width:1280,height:900});
  let release,captured=false;const gate=new Promise(r=>release=r);
  await page.route('**/api/v1/students/*/growth',async route=>{if(captured)return route.continue();captured=true;await gate;await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'UNAUTHENTICATED',message:'旧会话已失效',requestId:'race-test'}})});});
  await page.locator('.sidebar [data-nav=growth]').click();await page.waitForFunction(()=>document.querySelector('#main .loading'));
  await page.getByRole('button',{name:'退出',exact:true}).click();await page.getByLabel('登录名',{exact:true}).fill('student');await page.getByLabel('密码',{exact:true}).fill(TEST_PASSWORD);await page.getByRole('button',{name:'进入工作台 →',exact:true}).click();await page.getByRole('heading',{name:'今天，也向前一点。'}).waitFor();
  release();await page.waitForTimeout(350);assert(await page.getByRole('heading',{name:'今天，也向前一点。'}).isVisible(),'A late 401 from the previous account cleared the new account');results.push('late previous-account 401 cannot clear the new session');
  await page.unroute('**/api/v1/students/*/growth');
  const parent=await h.login('parent');await page.context().addCookies([{name:'lp_session',value:parent.cookie.split('=')[1],url:h.origin,httpOnly:true,sameSite:'Strict'}]);
  await page.locator('.sidebar [data-nav=growth]').click();await page.getByLabel('登录名',{exact:true}).waitFor();assert.equal(await page.locator('.integrated-app').count(),0);results.push('server actor change clears stale workspace before rendering data');
  const student=await h.login('student'),printContext=await h.browser.newContext();await printContext.addCookies([{name:'lp_session',value:student.cookie.split('=')[1],url:h.origin,httpOnly:true,sameSite:'Strict'}]);
  const printPage=await printContext.newPage();let unblock,signal,switchedCookie;const waiting=new Promise(r=>signal=r),resume=new Promise(r=>unblock=r);
  await printPage.route('**/api/v1/students/*/growth',async route=>{signal();await resume;const response=await route.fetch({headers:{...route.request().headers(),cookie:switchedCookie}});await route.fulfill({response});});
  await printPage.goto(h.origin+`/print.html?kind=growth&studentId=${student.id}`,{waitUntil:'domcontentloaded'});await waiting;switchedCookie=(await h.login('parent')).cookie;unblock();await printPage.waitForFunction(()=>document.querySelector('#status').textContent.includes('登录身份已变化'));assert(await printPage.locator('#print').isDisabled());assert.equal(await printPage.locator('#document table').count(),0);results.push('print preview rejects mixed-account API reads');await printContext.close();
  const admin=await h.openRole('admin',{width:1280,height:900});await admin.page.getByLabel('新账号登录名').fill('print-check');await admin.page.getByLabel('新账号显示别名').fill('打印测试');await admin.page.getByRole('button',{name:'创建并生成随机初始密码'}).click();await admin.page.locator('.password-output').waitFor();await admin.page.emulateMedia({media:'print'});assert.equal(await admin.page.locator('.password-output').isVisible(),false);results.push('one-time account password is hidden from direct browser print');await admin.context.close();
  await mkdir(join(root,'test-results/integration'),{recursive:true});await writeFile(join(root,'test-results/integration/session-race.json'),JSON.stringify({passed:results.length,results,notice:'Synthetic delayed 401 tests the failure path; both accounts use real local API authentication.'},null,2));console.log(`会话切换回归 ${results.length}/${results.length} 通过。`);
}finally{await h.cleanup();}
