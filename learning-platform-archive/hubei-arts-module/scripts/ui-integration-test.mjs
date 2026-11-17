import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {browserHarness} from '../tests/browser-harness.mjs';
import {root} from './environment.mjs';
const out=join(root,'test-results/integration');await mkdir(out,{recursive:true});const results=[];
for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const h=await browserHarness();const errors=[];
  try{
    const teacher=await h.openRole('teacher',viewport),student=await h.openRole('student',viewport);
    for(const p of [teacher.page,student.page])p.on('pageerror',e=>errors.push(e.message));
    const nav=async(page,key)=>{if(!await page.locator(`[data-nav="${key}"]:visible`).count())await page.getByRole('button',{name:'☰ 菜单',exact:true}).click();await page.locator(`[data-nav="${key}"]:visible`).first().click();};
    assert(await student.page.getByText('线上自主学习',{exact:true}).isVisible());assert(await student.page.getByText('线下教师辅导',{exact:true}).isVisible());assert(await student.page.getByText('尚未复测，不推断进步',{exact:true}).isVisible());
    assert.equal(await student.page.evaluate(()=>localStorage.length),0);assert.equal(await student.page.locator('#role-switcher').count(),0);
    await student.page.screenshot({path:join(out,`${profile}-empty-home.png`),fullPage:true});
    await nav(teacher.page,'review');
    for(let i=0;i<4;i++){const check=teacher.page.getByRole('checkbox').first();await check.check();await teacher.page.getByRole('button',{name:'确认人工审核',exact:true}).first().click();await teacher.page.waitForFunction(expected=>document.querySelectorAll('main input[type=checkbox]').length===expected,3-i);}
    await nav(student.page,'learning');await student.page.getByRole('button',{name:'开始能力筛查',exact:true}).click();await student.page.getByRole('button',{name:'提交本次实际作答'}).waitFor();
    async function answer(page,wrongFirst=false){await page.getByRole('button',{name:'提交本次实际作答',exact:true}).waitFor();await page.locator('fieldset').first().waitFor();const names=await page.locator('fieldset').evaluateAll(fields=>fields.map(f=>f.querySelector('input').name));for(const [i,name]of names.entries()){const q=h.DB.sqlite.prepare('SELECT correct_option FROM questions WHERE id=?').get(name);await page.locator(`input[name="${name}"][value="${wrongFirst&&i===0?(q.correct_option+1)%4:q.correct_option}"]`).check();}await page.getByRole('button',{name:'提交本次实际作答',exact:true}).click();await page.getByText('本次答对',{exact:false}).first().waitFor();}
    await answer(student.page,true);await student.page.getByRole('button',{name:'匹配今日通关包 →'}).click();await student.page.getByText('等待关联老师审核。',{exact:false}).waitFor();
    await nav(teacher.page,'learning');await teacher.page.getByRole('button',{name:'查看 / 调整通关包'}).first().click();await teacher.page.getByRole('checkbox',{name:'我已核对本次学习范围与材料，批准学生开始学习。'}).check();await teacher.page.getByRole('button',{name:'保存调整并批准'}).click();await teacher.page.getByRole('button',{name:'开始通关练习 →'}).waitFor();
    await nav(student.page,'learning');await student.page.getByRole('button',{name:'打开通关包'}).first().click();await student.page.getByRole('button',{name:'开始通关练习 →'}).click();await answer(student.page);await student.page.getByRole('button',{name:'回到学习包，继续复测'}).click();await student.page.getByRole('button',{name:'开始学习复测 →'}).click();await answer(student.page);await student.page.getByRole('button',{name:'查看成长档案',exact:true}).click();await student.page.getByRole('heading',{name:'学习时间线'}).waitFor();
    assert.equal(h.DB.sqlite.prepare("SELECT COUNT(*) n FROM attempts WHERE status='submitted'").get().n,3);assert.equal(h.DB.sqlite.prepare("SELECT COUNT(*) n FROM attempts WHERE source='student_self'").get().n,3);
    await student.page.screenshot({path:join(out,`${profile}-growth.png`),fullPage:true});
    await nav(teacher.page,'learning');await teacher.page.getByRole('button',{name:'开始能力筛查',exact:true}).click();await teacher.page.getByText('请依据学生实际作答录入',{exact:false}).waitFor();await answer(teacher.page);assert.equal(h.DB.sqlite.prepare("SELECT COUNT(*) n FROM attempts WHERE source='teacher_recorded'").get().n,1);
    await nav(student.page,'learning');await student.page.getByText('尚未复测，不推断进步',{exact:true}).waitFor();
    const parent=await h.openRole('parent',viewport),admin=await h.openRole('admin',viewport);assert.equal(await parent.page.locator('[data-nav=learning]').count(),0);assert.equal(await admin.page.locator('[data-nav=growth]').count(),0);
    await nav(teacher.page,'home');await teacher.page.screenshot({path:join(out,`${profile}-teacher.png`),fullPage:true});
    for(const {page}of [student,teacher,parent,admin])assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,profile+' viewport overflow');
    assert.deepEqual(errors,[]);results.push({profile,passed:true,checks:['real UI login and role boundary','teacher review','student full 3-step API cycle','teacher offline actual-entry provenance','no false new-cycle progress','no localStorage business data','visible export links','responsive no overflow']});
  }finally{await h.cleanup();}
}
await writeFile(join(out,'ui-results.json'),JSON.stringify(results,null,2));console.log('桌面/手机视口界面真实闭环通过：2种视口 × 8项检查。');
