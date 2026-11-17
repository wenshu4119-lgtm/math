// Real local API/UI evidence. All users, content review and submissions are synthetic.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {browserHarness} from '../tests/browser-harness.mjs';
import {root} from './environment.mjs';
import {EXPORTS} from '../public/export-registry.js';

const out=join(root,'test-results/product-theme');await mkdir(out,{recursive:true});
const report={checks:[],screenshots:[],states:[],failures:[],notice:'Real loopback API and isolated SQLite; synthetic users and automated teacher actions. Mobile viewport is not a physical device.'};
function check(label,actual,expected=true){assert.deepEqual(actual,expected,label);report.checks.push(label);}
async function pdfEvidence(){const groups=[];for(const [dir,files,pages]of [['homework/pdf',28,50],['pdf',42,72]]){const path=join(root,'test-results',dir),validation=JSON.parse(await readFile(join(path,'pdf-validation.json'),'utf8'));assert.equal(validation.pdfCount,files);assert.equal(validation.pageCount,pages);const pdfs=(await readdir(path)).filter(n=>n.endsWith('.pdf')).sort();assert.equal(pdfs.length,files);const hashes=[];for(const file of pdfs)hashes.push({file,sha256:createHash('sha256').update(await readFile(join(path,file))).digest('hex')});groups.push({dir,files,pages,hashes});}return groups;}
const previousPdf=await pdfEvidence();await writeFile(join(out,'pdf-preservation-before.json'),JSON.stringify(previousPdf,null,2));
async function client(page){const data=(await (await page.request.get(new URL('/api/v1/auth/session',page.url()).href)).json()).data;const c=(await page.context().cookies()).find(c=>c.name==='lp_session');return {id:data.user.id,role:data.user.role,cookie:`lp_session=${c.value}`,csrfToken:data.csrfToken};}
async function nav(page,key){let button=page.locator(`[data-nav="${key}"]:visible`).first();if(!await button.count()){await page.getByRole('button',{name:'☰ 菜单',exact:true}).click();button=page.locator(`[data-nav="${key}"]:visible`).first();}await button.click();}
async function home(page){await nav(page,'home');await page.locator('.scenario-card.offline').waitFor();}
async function growth(page){await nav(page,'growth');await page.getByRole('heading',{name:'每一步，都有迹可循。',exact:true}).waitFor();}
async function snapshot(page,profile,name){
  await page.locator('#toast').waitFor({state:'hidden',timeout:8000});await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>document.fonts.ready);const file=`${profile}-${name}.png`;
  await page.screenshot({path:join(out,file),fullPage:true});report.screenshots.push({profile,name,file});check(`${profile}/${name}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Full-page capture places the fixed mobile nav midway through long pages. Also
  // inspect real scrolled viewports to verify the final record can clear the bar.
  if(profile==='mobile'&&['actual-retest-growth','paper-only-no-retest-growth','homework-only-no-retest-growth'].includes(name)){
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    check(`${profile}/${name}: final content clears fixed navigation`,await page.evaluate(()=>document.querySelector('#main').lastElementChild.getBoundingClientRect().bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top+1));
    const bottomFile=`${profile}-${name}-bottom.png`;await page.screenshot({path:join(out,bottomFile)});report.screenshots.push({profile,name:name+'-bottom',file:bottomFile,viewportOnly:true});
  }
}
async function answer(f,page,wrongFirst=false){await page.getByRole('button',{name:'提交本次实际作答',exact:true}).waitFor();const ids=await page.locator('fieldset').evaluateAll(fields=>fields.map(field=>field.querySelector('input').name));for(const [index,id]of ids.entries()){const q=f.DB.sqlite.prepare('SELECT correct_option FROM questions WHERE id=?').get(id);await page.locator(`input[name="${id}"][value="${wrongFirst&&index===0?(q.correct_option+1)%4:q.correct_option}"]`).check();}await page.getByRole('button',{name:'提交本次实际作答',exact:true}).click();await page.getByText('本次答对',{exact:false}).first().waitFor();}
async function enterPack(page){await nav(page,'learning');await page.getByRole('button',{name:'打开通关包',exact:true}).first().click();await page.getByRole('heading',{name:'今日通关包',exact:true}).waitFor();}
async function state(f,page,c,profile,name,done,{retests=0,attempts=0,homeworks=0,papers=0,captureGrowth=true}={}){
  const g=(await f.request(`/students/${c.id}/growth`,{client:c})).data;
  check(`${profile}/${name}: server evidence classes`,[g.evidence.length,g.evidence.filter(x=>x.phase==='retest').length,g.homeworkEvidence.length,g.paperEvidence.length],[attempts,retests,homeworks,papers]);
  await home(page);check(`${profile}/${name}: same-cycle step completion`,await page.locator('.loop-step').evaluateAll(nodes=>nodes.map(n=>n.classList.contains('done'))),done);
  const stats=await page.locator('.stats .number').allTextContents(),expected=[g.evidence.length,g.evidence.reduce((sum,x)=>sum+x.total,0),retests].map(String);check(`${profile}/${name}: actual sample counts only`,stats,expected);
  if(!done[2])check(`${profile}/${name}: current cycle does not imply progress`,await page.locator('.loop-step').last().innerText().then(text=>text.includes('尚未复测')||text.includes('待提交')));
  check(`${profile}/${name}: both scenarios present`,await page.locator('.scenario-grid .scenario-card h2').allTextContents(),['线上自主学习','线下教师辅导']);
  const layout=await page.evaluate(()=>{const r=selector=>{const x=document.querySelector(selector).getBoundingClientRect();return {x:x.x,y:x.y,w:x.width,h:x.height};};return {loop:r('.loop-stepper'),hero:r('.portal-hero'),online:r('.scenario-card.online'),offline:r('.scenario-card.offline'),viewport:{width:innerWidth,height:innerHeight}};});
  check(`${profile}/${name}: learning loop precedes scenario cards`,layout.loop.y<layout.online.y&&layout.hero.y<layout.online.y);
  check(`${profile}/${name}: responsive scenario arrangement`,profile==='desktop'?layout.offline.x>layout.online.x:layout.offline.y>layout.online.y);
  await snapshot(page,profile,`${name}-home`);
  if(captureGrowth){await growth(page);check(`${profile}/${name}: explicit comparison availability`,await page.getByText('尚无进步对比依据：',{exact:false}).count(),g.comparisons.length?0:1);check(`${profile}/${name}: comparison content only with a real pair`,await page.getByRole('heading',{name:'筛查与复测记录',exact:true}).count(),g.comparisons.length?1:0);check(`${profile}/${name}: exports remain visible`,await page.locator('#main .export-actions a').count()>=2);await snapshot(page,profile,`${name}-growth`);}
  report.states.push({profile,name,steps:done,metrics:expected,comparisonCount:g.comparisons.length,evidence:{online:g.evidence.length,homeworks:g.homeworkEvidence.length,papers:g.paperEvidence.length},layout});
}

try{
  for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
    const f=await browserHarness(),errors=[];
    try{
      const student=await f.openRole('student',viewport),teacher=await f.openRole('teacher',viewport);for(const x of [student,teacher])x.page.on('pageerror',e=>errors.push(e.message));
      const s=await client(student.page),t=await client(teacher.page);
      await state(f,student.page,s,profile,'empty',[false,false,false]);await home(teacher.page);await snapshot(teacher.page,profile,'teacher-empty-home');
      check(`${profile}: role is from real session`,[s.role,t.role],['student','teacher']);check(`${profile}: student cannot switch to teacher`,await student.page.locator('#role-switcher').count(),0);
      await home(student.page);check(`${profile}: teacher-only offline actions absent for student`,await student.page.getByRole('button',{name:'进入线下辅导',exact:true}).count(),0);
      await student.page.getByRole('button',{name:'进入线上自主学习',exact:true}).click();await student.page.getByText('线上自主学习：',{exact:false}).waitFor();
      const rejected=student.page.waitForResponse(r=>r.url().endsWith('/api/v1/attempts')&&r.request().method()==='POST');await student.page.getByRole('button',{name:'开始能力筛查',exact:true}).click();check(`${profile}: pending content fails explicitly`,(await rejected).status(),409);
      await teacher.page.getByRole('button',{name:'进入线下辅导',exact:true}).click();await teacher.page.getByText('老师辅导模式：',{exact:false}).waitFor();await snapshot(teacher.page,profile,'teacher-offline-workspace');
      await nav(teacher.page,'review');for(let i=0;i<4;i++){await teacher.page.getByRole('checkbox').first().check();await teacher.page.getByRole('button',{name:'确认人工审核',exact:true}).first().click();await teacher.page.waitForFunction(n=>document.querySelectorAll('#main input[type=checkbox]').length===n,3-i);}
      await student.page.getByRole('button',{name:'开始能力筛查',exact:true}).click();await answer(f,student.page,true);
      await state(f,student.page,s,profile,'diagnostic-only',[true,false,false],{attempts:1});
      await nav(student.page,'learning');await student.page.getByRole('button',{name:'匹配学习包',exact:true}).click();await student.page.getByRole('button',{name:'打开通关包',exact:true}).click();await student.page.getByText('等待关联老师审核。',{exact:false}).waitFor();check(`${profile}: draft pack cannot start practice`,await student.page.getByRole('button',{name:'开始通关练习 →',exact:true}).count(),0);await snapshot(student.page,profile,'draft-pack');
      await nav(teacher.page,'learning');await teacher.page.getByRole('button',{name:'查看 / 调整通关包',exact:true}).click();await teacher.page.getByRole('checkbox',{name:'我已核对本次学习范围与材料，批准学生开始学习。',exact:true}).check();await teacher.page.getByRole('button',{name:'保存调整并批准',exact:true}).click();await teacher.page.getByRole('button',{name:'开始通关练习 →',exact:true}).waitFor();await snapshot(teacher.page,profile,'teacher-approved-pack');
      await enterPack(student.page);await student.page.getByRole('button',{name:'开始通关练习 →',exact:true}).click();await student.page.getByRole('button',{name:'提交本次实际作答',exact:true}).waitFor();
      await state(f,student.page,s,profile,'learning-open',[true,false,false],{attempts:1});
      await enterPack(student.page);await student.page.getByRole('button',{name:'继续练习',exact:true}).click();await answer(f,student.page);
      await state(f,student.page,s,profile,'practice-submitted',[true,true,false],{attempts:2});
      await enterPack(student.page);await student.page.getByRole('button',{name:'开始学习复测 →',exact:true}).click();await student.page.getByRole('button',{name:'提交本次实际作答',exact:true}).waitFor();
      await state(f,student.page,s,profile,'retest-open',[true,true,false],{attempts:2,captureGrowth:false});
      await enterPack(student.page);await student.page.getByRole('button',{name:'继续复测',exact:true}).click();await answer(f,student.page);
      await state(f,student.page,s,profile,'actual-retest',[true,true,true],{attempts:3,retests:1});
      const g=(await f.request(`/students/${s.id}/growth`,{client:s})).data;check(`${profile}: comparison is actual counts, not improvement percentage`,g.comparisons.map(c=>[c.diagnosticCorrect,c.diagnosticTotal,c.retestCorrect,c.retestTotal]),[[1,2,1,1]]);check(`${profile}: student source remains self`,g.evidence.every(x=>x.source==='student_self'));
      await home(teacher.page);await teacher.page.getByRole('button',{name:'进入线下辅导',exact:true}).click();await teacher.page.getByRole('button',{name:'开始能力筛查',exact:true}).click();await teacher.page.getByText('请依据学生实际作答录入',{exact:false}).waitFor();await answer(f,teacher.page);check(`${profile}: offline teacher source is explicit`,f.DB.sqlite.prepare("SELECT COUNT(*) n FROM attempts WHERE source='teacher_recorded'").get().n,1);
      await state(f,student.page,s,profile,'new-cycle-after-retest',[true,false,false],{attempts:4,retests:1,captureGrowth:false});await home(teacher.page);await snapshot(teacher.page,profile,'teacher-new-cycle-home');
      check(`${profile}: no unhandled UI errors`,errors,[]);
    }finally{await f.cleanup();}

    for(const mode of ['paper','homework']){
      const f=await browserHarness();try{
        const student=await f.openRole('student',viewport),teacher=await f.openRole('teacher',viewport),parent=await f.openRole('parent',viewport);const s=await client(student.page),t=await client(teacher.page),p=await client(parent.page);
        if(mode==='paper'){
          for(const kind of ['scored_paper','ability_observation']){const draft=(await f.request('/papers',{client:t,method:'POST',body:{studentId:s.id,subject:'math',title:kind==='scored_paper'?'合成线下卷面：2.5/4':'合成能力观察：2档',kind,requestId:crypto.randomUUID()}})).data;const item=kind==='scored_paper'?{questionNo:'1',prompt:'实际卷面步骤',qtype:'solution',mappingLevel:'unresolved',maxScore:4,earnedScore:2.5,reviewed:true}:{questionNo:'1',prompt:'人工观察，不是测评正确率',qtype:'observation',mappingLevel:'unresolved',observationLevel:2,reviewed:true};const saved=(await f.request(`/papers/${draft.id}`,{client:t,method:'PATCH',body:{revision:draft.revision,title:draft.title,items:[item]}})).data;check(`${profile}/${kind}: real confirmation`,(await f.request(`/papers/${draft.id}/confirm`,{client:t,method:'POST',body:{revision:saved.revision,confirmed:true}})).status,200);}
          await home(teacher.page);await teacher.page.getByRole('button',{name:'人工阅卷与部分分',exact:true}).click();await teacher.page.getByRole('heading',{name:'线下人工阅卷工作台',exact:true}).waitFor();await snapshot(teacher.page,profile,'teacher-paper-entry');
        }else{
          await f.review(t);const items=[{questionId:'math-equation-practice',maxScore:4},{questionId:'math-fraction-practice',maxScore:6}];const draft=(await f.request('/homeworks',{client:t,method:'POST',body:{studentId:s.id,subject:'math',title:'合成独立作业：不作为复测',items,requestId:crypto.randomUUID()}})).data;const published=(await f.request(`/homeworks/${draft.id}/publish`,{client:t,method:'POST',body:{revision:draft.revision,confirmed:true}})).data;const submitted=(await f.request(`/homeworks/${draft.id}/submit`,{client:s,method:'POST',body:{revision:published.revision,requestId:crypto.randomUUID(),answers:items.map(i=>({questionId:i.questionId,selectedOption:0,workText:'合成自主作答'}))}})).data;
          const graded=await f.request(`/homeworks/${draft.id}/grade`,{client:t,method:'POST',body:{revision:submitted.revision,requestId:crypto.randomUUID(),marks:items.map(i=>({questionId:i.questionId,earnedScore:i.maxScore/2})),feedback:'合成私密反馈',familySummary:'合成公开摘要',confirmed:true}});check(`${profile}: independent homework manual score`,graded.data.result.score.earned,5);
        }
        await state(f,student.page,s,profile,`${mode}-only-no-retest`,[false,false,false],{papers:mode==='paper'?2:0,homeworks:mode==='homework'?1:0});
        const text=await student.page.locator('#main').innerText();check(`${profile}/${mode}: only its own evidence section`,text.includes(mode==='paper'?'线下人工记录（独立口径）':'独立作业（只含实际提交）'));
        if(mode==='paper'){check(`${profile}: partial score and observation remain distinct`,text.includes('实际卷面分 2.5/4')&&text.includes('0–3人工观察 1 条，不折算分数'));check(`${profile}: no fabricated observation percentage`,!/72%|提高\s*\d/.test(text));}
        await growth(parent.page);check(`${profile}/${mode}: parent also sees missing comparison`,await parent.page.getByText('尚无进步对比依据：',{exact:false}).count(),1);check(`${profile}/${mode}: parent cannot start online assessment`,await parent.page.locator('[data-nav="learning"]').count(),0);check(`${profile}/${mode}: parent detail does not expose private feedback`,!(await parent.page.locator('#main').innerText()).includes('合成私密反馈'));await snapshot(parent.page,profile,`${mode}-parent-growth`);
        check(`${profile}/${mode}: no automatic attempts`,f.DB.sqlite.prepare('SELECT COUNT(*) n FROM attempts').get().n,0);
        if(mode==='homework'){await home(student.page);await student.page.getByRole('button',{name:'查看作业中心',exact:true}).click();await student.page.getByRole('heading',{name:'独立作业中心',exact:true}).waitFor();await student.page.getByRole('button',{name:'查看作业记录',exact:true}).waitFor();check(`${profile}: existing homework entry retained`,await student.page.getByRole('button',{name:'查看作业记录',exact:true}).count(),1);}
        check(`${profile}/${mode}: session role preserved after navigation`,(await client(student.page)).role,'student');
      }finally{await f.cleanup();}
    }
  }
  check('25 export kinds retained',Object.keys(EXPORTS).length,25);check('prior PDF evidence files unchanged',await pdfEvidence(),previousPdf);
  const inventory=await readFile(join(root,'docs/EXPORT-INVENTORY.md'),'utf8'),verification=await readFile(join(root,'docs/VERIFICATION.md'),'utf8');check('export docs agree with saved evidence',inventory.includes('25类')&&verification.includes('28份PDF/50页')&&verification.includes('42份PDF/72页'));
}catch(error){report.failures.push({message:error.message,stack:error.stack});throw error;}
finally{report.passed=report.checks.length;await writeFile(join(out,'results.json'),JSON.stringify(report,null,2));}
console.log(`主题专项：${report.checks.length}项断言、${report.states.length}个布局/状态组合、${report.screenshots.length}张真实截图通过。已有70份PDF未改动。`);
