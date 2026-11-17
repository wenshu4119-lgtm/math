import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readSecrets} from './secrets.mjs';
import {origin,cf,worker} from './cf-client.mjs';
const secrets=readSecrets(),state=JSON.parse(readFileSync(new URL('deployment.json',import.meta.url),'utf8'));
const out=new URL('../test-results/remote/',import.meta.url);mkdirSync(out,{recursive:true});
const report={origin,startedAt:new Date().toISOString(),syntheticOnly:true,physicalDevice:false,checks:[],pdfs:[]};
const check=(name,value)=>{assert(value,name);report.checks.push(name);};
const credential=name=>secrets.users.find(u=>u.username===`qa-${name}`);
async function request(path,{client,method='GET',body,headers={}}={}){
 const r=await fetch(origin+'/api/v1'+path,{method,headers:{...(method!=='GET'?{Origin:origin}:{}),...(client?{Cookie:client.cookie,'X-CSRF-Token':client.csrf}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.headers.get('content-type')?.includes('application/json'))throw Error(`Non-JSON API response: HTTP ${r.status} at ${path.split('?')[0]}`);
 const json=await r.json();return {status:r.status,data:json.data,error:json.error,headers:r.headers};
}
async function ok(path,opts){const r=await request(path,opts);check(`${opts?.method||'GET'} ${path.split('?')[0]} success`,r.status>=200&&r.status<300);return r.data;}
const clients={};
try{
 for(const path of ['/','/about.html','/app.js','/parent-archive.js','/profile-workspace.js']){const r=await fetch(origin+path);check(`static ${path}`,r.status===200);check(`CSP ${path}`,r.headers.get('content-security-policy')?.includes("default-src 'self'"));}
 for(const path of ['/src/api.mjs','/.dev.vars','/.local/trial-credentials.dpapi','/release/provision.mjs','/migrations/0001_initial.sql','/prototype-archive/index.html','/mock/mockData.js'])check(`private path denied ${path}`,(await fetch(origin+path)).status===404);
 check('anonymous access denied',(await request('/students')).status===401);
 for(const name of ['admin','teacher','student','parent','student2','teacher2','foreign']){const u=credential(name);const r=await request('/auth/login',{method:'POST',body:{username:u.username,password:u.password}});check(`real login ${name}`,r.status===200);const cookie=r.headers.get('set-cookie');check(`secure cookie ${name}`,cookie.includes('Secure')&&cookie.includes('HttpOnly')&&cookie.includes('SameSite=Strict')&&cookie.startsWith('__Host-'));clients[name]={cookie:cookie.split(';')[0],csrf:r.data.csrfToken,id:u.id};}
 const {teacher:t,student:s,parent:p,admin,teacher2:t2,foreign}=clients;
 check('CSRF enforced',(await request('/auth/logout',{client:s,method:'POST',headers:{'X-CSRF-Token':''}})).status===403);
 check('origin enforced',(await request('/auth/logout',{client:s,method:'POST',headers:{Origin:'https://untrusted.invalid'}})).status===403);
 check('admin cannot read learning data',(await request(`/students/${s.id}/growth`,{client:admin})).status===404);
 check('parent cannot read raw attempts',(await request(`/attempts?studentId=${s.id}`,{client:p})).status===404);
 check('unbound teacher hidden',(await request(`/students/${s.id}/growth`,{client:t2})).status===404);
 check('other student hidden',(await request(`/students/${s.id}/growth`,{client:clients.student2})).status===404);
 check('tenant isolation',(await request(`/students/${foreign.id}/growth`,{client:t})).status===404);
 check('role header cannot elevate',(await request('/admin/users',{client:s,headers:{'X-Role':'admin'}})).status===403);
 const caps=await ok('/capabilities',{client:t});check('AI and OCR explicitly unavailable',!caps.ocr.available&&!caps.rag.available&&!caps.questionGeneration.available);
 // Automated approvals ONLY in the named synthetic QA organization; never the trial org.
 const queue=await ok('/content/review-queue',{client:t}),answers=new Map();
 for(const topic of queue){for(const q of topic.questions)answers.set(q.id,q.correctOption);if(topic.reviewStatus==='pending_human')await ok(`/content/${topic.id}/review`,{client:t,method:'POST',body:{version:topic.version,confirmed:true}});}
 const createAttempt=phase=>ok('/attempts',{client:s,method:'POST',body:{studentId:s.id,subject:'math',phase,...(phase==='diagnostic'?{knowledgeIds:['math-equation']}:{packId:pack.id})}});
 const submit=attempt=>ok(`/attempts/${attempt.id}/submit`,{client:s,method:'POST',body:{answers:attempt.questions.map(q=>({questionId:q.id,selectedOption:answers.get(q.id)}))}});
 const diagnostic=await createAttempt('diagnostic');await submit(diagnostic);
 check('duplicate attempt blocked',(await request(`/attempts/${diagnostic.id}/submit`,{client:s,method:'POST',body:{answers:diagnostic.questions.map(q=>({questionId:q.id,selectedOption:0}))}})).status===409);
 let pack=await ok('/packs',{client:s,method:'POST',body:{diagnosticId:diagnostic.id}});
 pack=await ok(`/packs/${pack.id}`,{client:t,method:'PATCH',body:{revision:pack.revision,knowledgeIds:pack.knowledgeIds,teacherNote:'SYNTHETIC_QA_PLAN · 自动化验证，不是真人审核',approve:true}});
 for(const phase of ['practice','retest'])await submit(await createAttempt(phase));
 const growth=await ok(`/students/${s.id}/growth`,{client:p});check('real comparable records saved',growth.comparisons.some(x=>x.packId===pack.id&&x.retestTotal>0));
 let hw=await ok('/homeworks',{client:t,method:'POST',body:{studentId:s.id,subject:'math',title:'合成验收作业 · 非真实学生',instructions:'仅验证保存与隐私',items:[{questionId:'math-equation-practice',maxScore:5}],requestId:crypto.randomUUID()}});
 hw=await ok(`/homeworks/${hw.id}/publish`,{client:t,method:'POST',body:{revision:hw.revision,confirmed:true}});
 hw=await ok(`/homeworks/${hw.id}/submit`,{client:s,method:'POST',body:{revision:hw.revision,requestId:crypto.randomUUID(),answers:[{questionId:'math-equation-practice',selectedOption:0,workText:'PRIVATE_QA_STUDENT_WORK'}]}});
 hw=await ok(`/homeworks/${hw.id}/grade`,{client:t,method:'POST',body:{revision:hw.revision,requestId:crypto.randomUUID(),marks:[{questionId:'math-equation-practice',earnedScore:2.5,note:'PRIVATE_QA_MARK'}],feedback:'PRIVATE_QA_FEEDBACK',familySummary:'合成测试公开摘要 · PUBLIC_QA_SUMMARY',confirmed:true}});
 const summaries=await ok(`/students/${s.id}/homework-summaries`,{client:p});check('parent summary strips private data',JSON.stringify(summaries).includes('PUBLIC_QA_SUMMARY')&&!JSON.stringify(summaries).includes('PRIVATE_QA'));
 check('parent private feedback denied',(await request(`/homeworks/${hw.id}/feedback`,{client:p})).status===403);
 let paper=await ok('/papers',{client:t,method:'POST',body:{studentId:s.id,subject:'math',title:'合成纸卷 · 非真实学生',kind:'scored_paper',requestId:crypto.randomUUID()}});
 paper=await ok(`/papers/${paper.id}`,{client:t,method:'PATCH',body:{revision:paper.revision,title:paper.title,items:[{questionNo:'1',prompt:'合成公式排版：1/3 + 1/6；2x+3=8；√16=4',qtype:'solution',mappingLevel:'chapter',scopeText:'合成核验',knowledgeId:null,maxScore:5,earnedScore:2.5,observationLevel:null,note:'自动化合成输入，不是真人评分证据',reviewed:true}]}});
 paper=await ok(`/papers/${paper.id}/confirm`,{client:t,method:'POST',body:{revision:paper.revision,confirmed:true}});check('partial score saved',paper.report.score.earned===2.5);
 const bind=await ok('/admin/relationships',{client:admin,method:'POST',body:{adultId:t2.id,studentId:s.id}});check('new relationship grants access',(await request(`/students/${s.id}/growth`,{client:t2})).status===200);await ok(`/admin/relationships/${bind.id}`,{client:admin,method:'DELETE'});check('revocation immediate',(await request(`/students/${s.id}/growth`,{client:t2})).status===404);
 const {chromium}=await import(pathToFileURL('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const [role,width] of [['student',1440],['teacher',1440],['parent',390],['admin',390]]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);const u=credential(role);await page.getByLabel('登录名',{exact:true}).fill(u.username);await page.getByLabel('密码',{exact:true}).fill(u.password);await page.getByRole('button',{name:'进入工作台 →',exact:true}).click();await page.locator('#main .intro').waitFor();
  const nav=async key=>{if(!await page.locator(`[data-nav="${key}"]:visible`).count())await page.getByRole('button',{name:'☰ 菜单',exact:true}).click();await page.locator(`[data-nav="${key}"]:visible`).first().click();};
  if(role==='parent'){await nav('archive');await page.getByText('合成测试公开摘要 · PUBLIC_QA_SUMMARY',{exact:true}).waitFor();check('live parent page excludes private work',!(await page.locator('#main').innerText()).includes('PRIVATE_QA'));}
  if(role==='teacher'){await nav('teaching');await page.getByRole('heading',{name:'方案与课后反馈',exact:false}).waitFor();}
  check(`live ${role} no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL(`${role}.png`,out)),fullPage:true});
  const query=role==='admin'?'kind=admin-users':role==='parent'?`kind=homework-summaries&studentId=${s.id}`:role==='teacher'?`kind=paper-report&id=${paper.id}`:`kind=growth&studentId=${s.id}`;
  const print=await context.newPage();await print.goto(`${origin}/print.html?${query}`);await print.waitForSelector('#document[data-ready="true"]');await print.locator('#confirm').check();check(`live ${role} PDF enabled`,await print.locator('#print').isEnabled());const file=`live-${role}.pdf`;await print.pdf({path:fileURLToPath(new URL(file,out)),format:'A4',preferCSSPageSize:true,printBackground:true});report.pdfs.push(file);
  if(role==='teacher')check('live fraction rendered',await print.locator('mfrac').count()===2);
  if(role==='parent')check('live parent PDF private fields absent',!(await print.locator('#document').innerText()).includes('PRIVATE_QA'));
  check(`live ${role} page errors absent`,errors.length===0);await context.close();
 }}finally{await browser.close();}
 for(const role of ['teacher','student']){
  const u=secrets.users.find(u=>u.username===`trial-${role}`),login=await request('/auth/login',{method:'POST',body:{username:u.username,password:u.password}});check(`empty trial ${role} real login`,login.status===200);const client={cookie:login.headers.get('set-cookie').split(';')[0],csrf:login.data.csrfToken};
  if(role==='teacher')check('trial content still pending actual teacher review',(await ok('/content/review-queue',{client})).every(t=>t.reviewStatus==='pending_human'));
  else {check('trial cycle still empty',(await ok(`/students/${u.id}/learning-cycle?subject=math`,{client})).diagnostic===null);check('trial homework empty',(await ok(`/homeworks?studentId=${u.id}`,{client})).length===0);}
  await ok('/auth/logout',{client,method:'POST'});
 }
 report.completed=true;report.completedAt=new Date().toISOString();console.log(`Live trial: ${report.checks.length} checks passed, ${report.pdfs.length} PDFs.`);
}finally{writeFileSync(new URL('results.json',out),JSON.stringify(report,null,2));}
