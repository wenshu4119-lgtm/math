import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {browserHarness} from '../tests/browser-harness.mjs';
import {TEST_PASSWORD} from '../tests/helpers.mjs';
const out=new URL('../test-results/account-self-service/',import.meta.url);await mkdir(out,{recursive:true});
const results={completed:false,checks:[],syntheticOnly:true,physicalDevice:false};
const check=(name,value)=>{assert(value,name);results.checks.push(name);};
async function nav(page,key){if(!await page.locator(`[data-nav="${key}"]:visible`).count())await page.getByRole('button',{name:'☰ 菜单',exact:true}).click();await page.locator(`[data-nav="${key}"]:visible`).first().click();}
try{
 for(const [profile,viewport]of[['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const f=await browserHarness();try{
   const {page,context}=await f.openRole('admin',viewport),errors=[];page.on('pageerror',e=>errors.push(e.message));await nav(page,'account');await page.getByRole('heading',{name:'修改登录名',exact:true}).waitFor();
   check(profile+' current login name is real session value',await page.getByLabel('新登录名（3–32 位）',{exact:true}).inputValue()==='admin');
   await page.getByLabel('新登录名（3–32 位）',{exact:true}).fill('mrxu-test');await page.getByLabel('修改登录名的当前密码',{exact:true}).fill('wrong-password');await page.getByRole('button',{name:'保存新登录名并重新登录',exact:true}).click();await page.getByText('当前密码不正确',{exact:false}).waitFor();
   check(profile+' wrong password retains signed-in view',await page.locator('.integrated-app').count()===1);check(profile+' wrong password retains rename input',await page.getByLabel('新登录名（3–32 位）',{exact:true}).inputValue()==='mrxu-test');
   await page.getByLabel('修改登录名的当前密码',{exact:true}).fill(TEST_PASSWORD);await page.getByLabel('新登录名（3–32 位）',{exact:true}).fill('teacher');await page.getByRole('button',{name:'保存新登录名并重新登录',exact:true}).click();await page.getByText('该登录名不可用',{exact:false}).waitFor();check(profile+' conflict preserves original account',f.DB.sqlite.prepare('SELECT username FROM users WHERE id=?').get(f.users.admin.id).username==='admin');check(profile+' conflict retains session',(await page.request.get(f.origin+'/api/v1/auth/session')).status()===200);
   await page.getByLabel('新登录名（3–32 位）',{exact:true}).fill('mrxu-test');const pending=page.waitForResponse(r=>r.url().endsWith('/auth/username')&&r.status()===200);await page.getByRole('button',{name:'保存新登录名并重新登录',exact:true}).click();await pending;await page.getByLabel('登录名',{exact:true}).waitFor();
   check(profile+' rename clears browser session',(await page.request.get(f.origin+'/api/v1/auth/session')).status()===401);check(profile+' rename preserves role',f.DB.sqlite.prepare('SELECT role FROM users WHERE id=?').get(f.users.admin.id).role==='admin');check(profile+' rename writes one success audit',f.DB.sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='username_changed'").get().n===1);
   await page.getByLabel('登录名',{exact:true}).fill('mrxu-test');await page.getByLabel('密码',{exact:true}).fill(TEST_PASSWORD);await page.getByRole('button',{name:'进入工作台 →',exact:true}).click();await page.locator('#main .intro').waitFor();await nav(page,'account');await page.getByText('当前登录名：mrxu-test',{exact:true}).waitFor();
   await page.getByLabel('当前密码',{exact:true}).fill('wrong-password');await page.getByLabel('新密码（12–128 位）',{exact:true}).fill('Changed-browser-password!2026');await page.getByLabel('再次输入新密码',{exact:true}).fill('Changed-browser-password!2026');await page.getByRole('button',{name:'保存新密码并重新登录',exact:true}).click();await page.getByText('当前密码不正确',{exact:false}).waitFor();check(profile+' wrong password on password form retains session',await page.locator('.integrated-app').count()===1);
   await page.getByLabel('当前密码',{exact:true}).fill(TEST_PASSWORD);await page.getByRole('button',{name:'保存新密码并重新登录',exact:true}).click();await page.getByLabel('登录名',{exact:true}).waitFor();check(profile+' password change clears session',(await page.request.get(f.origin+'/api/v1/auth/session')).status()===401);
   await page.getByLabel('登录名',{exact:true}).fill('mrxu-test');await page.getByLabel('密码',{exact:true}).fill('Changed-browser-password!2026');await page.getByRole('button',{name:'进入工作台 →',exact:true}).click();await page.locator('#main .intro').waitFor();await nav(page,'account');await page.getByRole('heading',{name:'修改登录名',exact:true}).waitFor();
   check(profile+' new password authenticates real account',(await(await page.request.get(f.origin+'/api/v1/auth/session')).json()).data.user.id===f.users.admin.id);check(profile+' password inputs are cleared after relogin',await page.getByLabel('当前密码',{exact:true}).inputValue()==='');check(profile+' no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check(profile+' no page exceptions',errors.length===0);
   await page.screenshot({path:fileURLToPath(new URL(profile+'.png',out)),fullPage:true});await context.close();
   f.DB.sqlite.prepare('UPDATE users SET must_change_password=1 WHERE id=?').run(f.users.teacher.id);
   const first=await f.openRole('teacher',viewport),firstPage=first.page;await firstPage.getByRole('heading',{name:'首次登录，请先修改密码',exact:true}).waitFor();
   check(profile+' first-login only offers credential setup',await firstPage.locator('[data-nav="teaching"]').count()===0&&await firstPage.locator('[data-nav="learning"]').count()===0);check(profile+' forced setup has no rename form',await firstPage.getByRole('heading',{name:'修改登录名',exact:true}).count()===0);
   const blocked=await firstPage.request.get(f.origin+'/api/v1/students');check(profile+' first-login business API is blocked',blocked.status()===403&&(await blocked.json()).error.code==='PASSWORD_CHANGE_REQUIRED');
   await firstPage.getByLabel('当前密码',{exact:true}).fill(TEST_PASSWORD);await firstPage.getByLabel('新密码（12–128 位）',{exact:true}).fill('First-login-test-password!2026');await firstPage.getByLabel('再次输入新密码',{exact:true}).fill('First-login-test-password!2026');await firstPage.getByRole('button',{name:'保存新密码并重新登录',exact:true}).click();await firstPage.getByLabel('登录名',{exact:true}).waitFor();
   await firstPage.getByLabel('登录名',{exact:true}).fill('teacher');await firstPage.getByLabel('密码',{exact:true}).fill('First-login-test-password!2026');await firstPage.getByRole('button',{name:'进入工作台 →',exact:true}).click();await firstPage.locator('#main .intro').waitFor();check(profile+' changed first password unlocks teaching navigation',await firstPage.locator('[data-nav="teaching"]').count()>0);await first.context.close();
  }finally{await f.cleanup();}
 }
 results.completed=true;console.log(`Account self-service: ${results.checks.length} browser checks passed.`);
}finally{await writeFile(new URL('browser-results.json',out),JSON.stringify(results,null,2));}
