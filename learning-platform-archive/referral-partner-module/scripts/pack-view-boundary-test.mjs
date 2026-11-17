import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {browserHarness} from '../tests/browser-harness.mjs';
import {TEST_PASSWORD} from '../tests/helpers.mjs';
import {root} from './environment.mjs';
const checks=[];
for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const f=await browserHarness();try{
    const seedTeacher=await f.login('teacher'),s=await f.login('student');await f.review(seedTeacher);
    const a=(await f.request('/attempts',{client:s,method:'POST',body:{studentId:s.id,subject:'math',phase:'diagnostic'}})).data;await f.request(`/attempts/${a.id}/submit`,{client:s,method:'POST',body:{answers:f.correctAnswers(a)}});const p=(await f.request('/packs',{client:s,method:'POST',body:{diagnosticId:a.id}})).data;await f.request(`/packs/${p.id}`,{client:seedTeacher,method:'PATCH',body:{revision:p.revision,knowledgeIds:p.knowledgeIds,teacherNote:'PRIVATE_STUDENT_A_SAVED_GUIDANCE',approve:true}});
    const {page}=await f.openRole('teacher',viewport),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const nav=key=>page.locator(`[data-nav="${key}"]:visible`).first().click();
    async function login(name){await page.getByLabel('登录名',{exact:true}).fill(name);await page.getByLabel('密码',{exact:true}).fill(TEST_PASSWORD);await page.getByRole('button',{name:'进入工作台 →',exact:true}).click();await page.locator('.scenario-card.offline').waitFor();}
    async function hold(){let resume,signal;const gate=new Promise(r=>resume=r),ready=new Promise(r=>signal=r);const pattern=`**/api/v1/packs/${p.id}/activity`;await page.route(pattern,async route=>{const response=await route.fetch();assert.equal(response.status(),200);signal();await gate;await route.fulfill({response});});return {ready,release:resume,pattern};}
    await nav('learning');const old=await hold();await page.getByRole('button',{name:'查看 / 调整通关包',exact:true}).click();await old.ready;await page.getByRole('button',{name:'退出',exact:true}).click();await login('student2');const delivered=page.waitForResponse(r=>r.url().endsWith(`/packs/${p.id}/activity`));old.release();await delivered;await page.waitForTimeout(150);
    assert.equal(await page.locator('.pack-panel').count(),0);assert(!(await page.locator('#main').innerText()).includes('PRIVATE_STUDENT_A'));const session=(await (await page.request.get(f.origin+'/api/v1/auth/session')).json()).data;assert.equal(session.user.id,f.users.student2.id);checks.push(`${profile}: late authorized teacher response cannot overwrite a different logged-in account`);await page.unroute(old.pattern);
    const admin=await f.login('admin');await f.request('/admin/relationships',{client:admin,method:'POST',body:{adultId:f.users.teacher.id,studentId:f.users.student2.id}});
    await page.getByRole('button',{name:'退出',exact:true}).click();await login('teacher');await nav('learning');const former=await hold();await page.getByRole('button',{name:'查看 / 调整通关包',exact:true}).click();await former.ready;await page.getByLabel('查看学生',{exact:true}).selectOption(f.users.student2.id);await page.locator('.scope-selection').waitFor();const secondDelivery=page.waitForResponse(r=>r.url().endsWith(`/packs/${p.id}/activity`));former.release();await secondDelivery;await page.waitForTimeout(150);
    assert.equal(await page.getByLabel('查看学生',{exact:true}).inputValue(),f.users.student2.id);assert.equal(await page.locator('.pack-panel').count(),0);assert(!(await page.locator('#main').innerText()).includes('PRIVATE_STUDENT_A'));checks.push(`${profile}: same teacher switching students cannot receive the prior student's late package view`);await page.unroute(former.pattern);
    const auth=(await (await page.request.get(f.origin+'/api/v1/auth/session')).json()).data,cookie=(await page.context().cookies()).find(c=>c.name==='lp_session'),teacherClient={cookie:`lp_session=${cookie.value}`,csrfToken:auth.csrfToken};
    const practice=(await f.request('/attempts',{client:teacherClient,method:'POST',body:{studentId:f.users.student.id,subject:'math',phase:'practice',packId:p.id}})).data;await f.request(`/attempts/${practice.id}/submit`,{client:teacherClient,method:'POST',body:{answers:f.correctAnswers(practice)}});
    const studentPage=(await f.openRole('student',viewport)).page;await studentPage.getByRole('button',{name:'继续今日通关包 →',exact:true}).click();await studentPage.getByText('记录来源：教师依据实际作答录入',{exact:true}).waitFor();checks.push(`${profile}: student sees teacher-entered practice as teacher provenance`);
    assert.deepEqual(errors,[]);checks.push(`${profile}: no uncaught errors during account/student transitions`);
  }finally{await f.cleanup();}
}
await mkdir(join(root,'test-results/stage6'),{recursive:true});await writeFile(join(root,'test-results/stage6/view-boundaries.json'),JSON.stringify({passed:checks.length,checks,method:'Real API responses captured under valid permissions and deliberately delayed; synthetic users only.'},null,2));console.log(`通关包跨账号/学生视图边界 ${checks.length}/${checks.length} 通过。`);
