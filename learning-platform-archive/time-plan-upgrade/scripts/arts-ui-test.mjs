// Real loopback application + isolated SQLite. All accounts and teacher actions are synthetic automated tests.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {browserHarness} from '../tests/browser-harness.mjs';
import {root} from './environment.mjs';
import DATA from '../public/arts/demo-content.js';
import CONTENT from '../data/arts-content.json' with {type:'json'};

const out=join(root,'test-results/arts-ui');await mkdir(out,{recursive:true});
const report={notice:'Synthetic isolated accounts and automated teacher actions, not human review. Desktop/mobile browser viewports, not physical devices.',checks:[],screenshots:[],pdfs:[],failures:[],requests:[]};
function check(label,actual,expected=true){assert.deepEqual(actual,expected,label);report.checks.push(label);}
async function shot(page,file,{locator,fullPage=false}={}){await page.evaluate(()=>document.fonts.ready);const target=locator?page.locator(locator):page;await target.screenshot({path:join(out,file),...(locator?{}:{fullPage})});report.screenshots.push(file);}
async function noOverflow(page,label){const geometry=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));check(label+': no horizontal overflow',geometry.document<=geometry.viewport&&geometry.body<=geometry.viewport);}
async function capturePdf(page,file,expected){await page.waitForFunction(()=>window.__artsPrinted===true);await page.emulateMedia({media:'print'});await page.evaluate(()=>document.body.classList.add('print-scope'));await page.pdf({path:join(out,file),format:'A4',printBackground:true,preferCSSPageSize:true});await page.emulateMedia({media:'screen'});await page.evaluate(()=>{document.body.classList.remove('print-scope');window.__artsPrinted=false;});report.pdfs.push({file,expected});}
const f=await browserHarness();
try{
 for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile390',{width:390,height:844}],['mobile360',{width:360,height:800}]]){
  const context=await f.browser.newContext({viewport});await context.addInitScript(()=>{window.print=()=>{window.__artsPrinted=true;};});const page=await context.newPage(),requests=[],errors=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(new URL(r.url()).pathname);});page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(f.origin+'/arts/index.html');await page.locator('[data-option]').first().waitFor();await page.locator('#live-coverage').filter({hasText:'18 道受保护题'}).waitFor();
   await noOverflow(page,profile+' hero');await shot(page,profile+'-hero.png');
   await page.locator('#submit-demo').click();check(profile+': unanswered is not zero',await page.locator('#demo-error').innerText(),'请先选择一个选项；未作答不计分。');
   const subjects=profile==='desktop'?DATA.subjects:[DATA.subjects[1]];
   for(const s of subjects){
    await page.locator(`[data-subject="${s.id}"]`).click();check(profile+'/'+s.id+': subject switch resets',await page.locator('#demo .result').count(),0);
    for(const phase of ['diagnostic','practice','retest']){
     const q=s.point.questions.find(q=>q.phase===phase),answer=phase==='diagnostic'?(q.correctOption+1)%4:q.correctOption;
     await page.locator(`[data-option="${answer}"]`).click();await page.locator('#submit-demo').click();check(profile+'/'+s.id+'/'+phase+': actual click score',await page.locator('#demo .result strong').innerText(),phase==='diagnostic'?'本题需要再巩固 · 0 / 1 题':'本题答对 · 1 / 1 题');
     await page.locator('#continue-demo').click();
     if(phase==='diagnostic'){
      await noOverflow(page,profile+'/'+s.id+' handout');check(profile+'/'+s.id+': all handout sections',await page.locator('#demo .handout h4').count(),8);
      if(s.id==='math'||(profile==='desktop'&&s.id==='chinese')){
       await shot(page,profile+'-'+s.id+'-handout.png',{locator:'#demo'});
       if(profile==='desktop'){
        await page.locator('#print-handout').click();check('public handout print entry',await page.evaluate(()=>window.__artsPrinted),true);
        await capturePdf(page,'public-'+s.id+'-handout.pdf',[s.name,'01 考点说明','06 分层练习与解析','08 复测与错题回练',s.point.handout.exercises[0].answer]);
       }
      }
      await page.locator('#next-practice').click();
     }
    }
    check(profile+'/'+s.id+': actual evidence rows',await page.locator('#demo tbody tr').count(),3);check(profile+'/'+s.id+': real result counts',await page.locator('#demo tbody tr td:last-child').allTextContents(),['0 / 1','1 / 1','1 / 1']);
    await noOverflow(page,profile+'/'+s.id+' evidence');if(s.id==='math')await shot(page,profile+'-retest-evidence.png',{locator:'#demo'});
   }
   await page.locator('[data-subject="english"]').click();check(profile+': switching subject clears previous evidence',await page.locator('#demo tbody').count(),0);check(profile+': switching subject restores diagnostic',await page.locator('#demo h3').innerText(),'筛查 · 原创微题');
   for(const t of [400,450,500,550]){await page.locator(`[data-tier="${t}"]`).click();check(profile+': tier '+t,await page.locator('#target-number').innerText(),String(t));check(profile+': tier '+t+' exact sum',await page.locator('#score-bars progress').evaluateAll(ps=>ps.reduce((n,p)=>n+p.value,0)),t);check(profile+': tier '+t+' actual tasks',await page.locator('#tier-list article').count(),6);}
   await page.locator('.custom-target summary').click();const vals={chinese:60,math:40,english:50,history:50,geography:50,politics:50};for(const [id,v]of Object.entries(vals))await page.locator(`#target-form [name="${id}"]`).fill(String(v));await page.locator('#target-form [name="total"]').fill('300');await page.locator('#target-form button').click();check(profile+': custom 300 accepted',(await page.locator('#target-validation').innerText()).startsWith('校验通过'));
   await page.locator('#target-form [name="total"]').fill('301');await page.locator('#target-form button').click();check(profile+': sum mismatch shown',(await page.locator('#target-validation').innerText()).includes('不一致'));
   await page.locator('#target-form [name="math"]').fill('151');check(profile+': HTML upper cap',await page.locator('#target-form [name="math"]').evaluate(el=>el.validity.rangeOverflow));
   await page.locator('#plan-form [name="exam"]').fill('2027-01-10');await page.locator('#plan-form button').click();check(profile+': reversed dates rejected',(await page.locator('#plan-result').innerText()).includes('有效日期'));
   await page.locator('#plan-form [name="exam"]').fill('2027-06-08');await page.locator('#plan-form button').click();check(profile+': adjustable schedule shown',(await page.locator('#plan-result').innerText()).includes('每周休息 1 天'));await noOverflow(page,profile+' expanded forms');
   check(profile+': no private or session API',requests.every(p=>p==='/api/v1/public/arts/catalog'));check(profile+': no local identity persistence',await page.evaluate(()=>localStorage.length+sessionStorage.length),0);check(profile+': no JavaScript errors',errors,[]);report.requests.push({profile,requests});
  }catch(e){report.failures.push({section:profile,message:e.message,stack:e.stack});await page.screenshot({path:join(out,profile+'-failure.png'),fullPage:true}).catch(()=>{});}finally{await context.close();}
 }
 // Account/role UI integration uses the same real auth/session APIs and isolated fixture.
 const anonymous=await f.browser.newContext();const ap=await anonymous.newPage();await ap.goto(f.origin+'/arts/workspace.html');await ap.locator('#session-status a').first().waitFor();check('anonymous workspace hidden',await ap.locator('#workspace').isVisible(),false);check('anonymous workspace asks login',(await ap.locator('#session-status').innerText()).includes('登录'));await anonymous.close();
 async function role(name){const c=await f.login(name),context=await f.browser.newContext({viewport:{width:1440,height:1000}});const [cookieName,...rest]=c.cookie.split('=');await context.addCookies([{name:cookieName,value:rest.join('='),url:f.origin,httpOnly:true,sameSite:'Strict'}]);await context.addInitScript(()=>{window.print=()=>{window.__artsPrinted=true;};});const page=await context.newPage();await page.goto(f.origin+'/arts/workspace.html');await page.locator('#workspace').waitFor({state:'visible'});await page.locator('#view').filter({hasNotText:'正在读取'}).waitFor();return {context,page,client:c};}
 let teacher,student,parent;
 try{
  teacher=await role('teacher');student=await role('student');
  check('teacher review tab visible',await teacher.page.locator('[data-tab="review"]').isVisible());check('student review tab hidden',await student.page.locator('[data-tab="review"]').isVisible(),false);
  await teacher.page.locator('#plan-editor [name="tier"]').selectOption('custom');await teacher.page.locator('#plan-editor [name="total"]').fill('300');for(const [id,v]of Object.entries({chinese:60,math:40,english:50,history:50,geography:50,politics:50}))await teacher.page.locator(`#plan-editor [name="target-${id}"]`).fill(String(v));await teacher.page.locator('#plan-editor [name="base-math"]').fill('25');await teacher.page.locator('#plan-editor [name="note"]').fill('仅教师可见的合成核验备注');await teacher.page.locator('#plan-editor [name="reason"]').fill('合成浏览器验收：依据低基线建立计划');await teacher.page.locator('#plan-editor button').click();await teacher.page.locator('#print-plan').waitFor();
  check('real saved plan target below 400',f.DB.sqlite.prepare('SELECT payload_json FROM arts_plans').get().payload_json.includes('"targetTotal":300'));
  await student.page.reload();await student.page.locator('#print-plan').waitFor();await student.page.locator('[data-tab="learn"]').click();check('unreviewed no real attempt entry',await student.page.locator('[data-start]').count(),0);
  await teacher.page.locator('[data-tab="review"]').click();await teacher.page.locator('[data-review="arts-ma-log-domain"]').click();await teacher.page.locator('#review-form input').check();await teacher.page.locator('#review-form button').click();await teacher.page.locator('[data-tab="learn"]').click();await teacher.page.locator('[data-start="arts-ma-log-domain"]').waitFor();
  await student.page.reload();await student.page.locator('#print-plan').waitFor();await student.page.locator('[data-tab="learn"]').click();await student.page.locator('[data-start="arts-ma-log-domain"]').click();
  const point=CONTENT.points.find(p=>p.subject==='math');
  for(const phase of ['diagnostic','practice','retest']){
   const q=point.questions.find(q=>q.phase===phase),choice=phase==='diagnostic'?(q.correctOption+1)%4:q.correctOption;await student.page.locator(`input[name="${q.id}"][value="${choice}"]`).check();await student.page.locator('#attempt-form button').click();await student.page.locator('#print-attempt').waitFor();
   if(phase!=='retest'){await student.page.locator('#next-attempt').click();if(phase==='diagnostic'){
    await student.page.getByRole('button',{name:'已阅读，开始对应练习',exact:true}).click();await student.page.locator('#attempt-form button').waitFor();
    const pending=f.DB.sqlite.prepare("SELECT id FROM arts_attempts WHERE phase='practice' AND status='open'").get();check('practice exists before refresh',Boolean(pending));
    await student.page.reload();await student.page.locator('#print-plan').waitFor();check('student existing plan does not offer duplicate creation',await student.page.locator('#plan-editor').count(),0);
    await student.page.locator('[data-tab="evidence"]').click();await student.page.getByRole('button',{name:'数学 · 继续练习',exact:true}).click();await student.page.locator('#attempt-form button').waitFor();
    check('refresh resumes same open practice',f.DB.sqlite.prepare("SELECT id FROM arts_attempts WHERE phase='practice' AND status='open'").get().id,pending.id);
   }}else await student.page.locator('#view-evidence').click();
  }
  check('real student loop saved three actual records',f.DB.sqlite.prepare("SELECT count(*) n FROM arts_attempts WHERE status='submitted'").get().n,3);check('student evidence actual comparison',(await student.page.locator('#view').innerText()).includes('0/1 → 1/1'));await shot(student.page,'student-real-evidence.png',{fullPage:true});
  parent=await role('parent');check('parent review tab hidden',await parent.page.locator('[data-tab="review"]').isVisible(),false);check('parent cannot edit plan',await parent.page.locator('#plan-editor').count(),0);check('parent private teacher note omitted',!(await parent.page.locator('#view').innerText()).includes('仅教师可见的合成核验备注'));await parent.page.locator('[data-tab="evidence"]').click();check('parent cannot open answer details',await parent.page.locator('[data-record]').count(),0);check('parent actual summary present',(await parent.page.locator('#view').innerText()).includes('0/1 → 1/1'));
  await parent.page.locator('#print-plan').click();await parent.page.waitForFunction(()=>window.__artsPrinted===true);check('parent protected print endpoint action',await parent.page.evaluate(()=>window.__artsPrinted),true);await capturePdf(parent.page,'parent-authorized-summary.pdf',['文化课目标 300 分','实际学习证据','同范围复测']);
  await student.page.locator('[data-tab="learn"]').click();await student.page.locator('[data-handout="arts-ma-log-domain"]').click();await student.page.locator('#print-content').click();await capturePdf(student.page,'student-reviewed-handout.pdf',['对数式定义域','01 考点说明','08 复测与错题回练',point.handout.exercises[0].answer,point.handout.exercises[1].answer]);
  for(const actor of [teacher,student,parent])await actor.context.close();
 }catch(e){report.failures.push({section:'roles',message:e.message,stack:e.stack});for(const a of [teacher,student,parent])await a?.context.close().catch(()=>{});}
 // Extract real PDF text/page bounds with the bundled Python, then render all pages for visual inspection.
 const python=process.env.ARTS_PDF_PYTHON||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
 const code=`import json,sys,pathlib\nfrom pypdf import PdfReader\nfrom pypdfium2 import PdfDocument\np=pathlib.Path(sys.argv[1]); specs=json.loads(sys.argv[2]); result=[]\nfor s in specs:\n r=PdfReader(p/s['file']); text='\\n'.join(x.extract_text() or '' for x in r.pages); compact=''.join(text.split()); missing=[x for x in s['expected'] if ''.join(x.split()) not in compact]; boxes=[list(map(float,x.mediabox)) for x in r.pages]; d=PdfDocument(p/s['file']); renders=[]\n for i in range(len(d)):\n  name=s['file'].replace('.pdf',f'-page-{i+1}.png'); d[i].render(scale=1.15).to_pil().save(p/name); renders.append(name)\n result.append({'file':s['file'],'pages':len(r.pages),'textLength':len(text),'missing':missing,'boxes':boxes,'renders':renders});(p/s['file'].replace('.pdf','.txt')).write_text(text,encoding='utf-8')\nprint(json.dumps(result,ensure_ascii=False))`;
 const p=spawnSync(python,['-X','utf8','-c',code,out,JSON.stringify(report.pdfs)],{encoding:'utf8'});if(p.status!==0)report.failures.push({section:'PDF extraction',message:p.stderr||p.stdout});else{const parsed=JSON.parse(p.stdout);report.pdfVerification=parsed;for(const v of parsed){try{check(v.file+': expected content in PDF',v.missing,[]);check(v.file+': nonblank PDF',v.textLength>100);check(v.file+': A4 dimensions',v.boxes.every(b=>Math.abs(b[2]-595.3)<2&&Math.abs(b[3]-841.9)<2));}catch(e){report.failures.push({section:'PDF '+v.file,message:e.message});}}}
}finally{await f.cleanup();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,failures:report.failures,screenshots:report.screenshots,pdfs:report.pdfVerification||report.pdfs,report:join(out,'report.json')},null,2));if(report.failures.length)process.exitCode=1;
