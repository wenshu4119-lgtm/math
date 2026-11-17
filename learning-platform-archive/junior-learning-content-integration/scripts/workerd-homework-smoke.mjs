// Use only with the isolated .local/workerd-stage4-tests Pages server on loopback.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './environment.mjs';
if(!process.argv.includes('--isolated-homework-tests'))throw new Error('Requires --isolated-homework-tests and the stage4 isolated local server');
const origin='http://127.0.0.1:8788',checks=[],clients=[];
let adminClient,removedTeacher,addedRelationship;
const accounts=readFileSync(join(root,'.local/accounts.txt'),'utf8').split(/\r?\n/).map(l=>l.split('\t'));
async function request(c,path,method='GET',body){
  const res=await fetch(origin+'/api/v1'+path,{method,headers:{...(c?.cookie?{Cookie:c.cookie}:{}),...(method==='GET'?{}:{Origin:origin,'X-CSRF-Token':c?.csrf||'','Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const json=await res.json();return {status:res.status,data:json.data,error:json.error,res};
}
async function login(name){const row=accounts.find(x=>x[0]===name);assert(row);const r=await request(null,'/auth/login','POST',{username:name,password:row[2]});assert.equal(r.status,200);const c={id:r.data.user.id,cookie:r.res.headers.get('set-cookie').split(';')[0],csrf:r.data.csrfToken};clients.push(c);return c;}
try{
  const teacher=await login('teacher'),student=await login('student'),parent=await login('parent'),other=await login('teacher-b'),admin=await login('admin');
  adminClient=admin;
  const queue=(await request(teacher,'/content/review-queue')).data;
  for(const k of queue)if(k.reviewStatus==='pending_human')assert.equal((await request(teacher,`/content/${k.id}/review`,'POST',{version:k.version,confirmed:true})).status,200);
  const items=[{questionId:'math-equation-practice',maxScore:4},{questionId:'math-fraction-practice',maxScore:6}];
  const createBody={studentId:student.id,subject:'math',title:'隔离 workerd 作业验收',instructions:'合成作业，自动化教师操作',items,requestId:crypto.randomUUID()};
  const made=await request(teacher,'/homeworks','POST',createBody);assert.equal(made.status,201);const h=made.data;
  assert.equal((await request(teacher,'/homeworks','POST',createBody)).data.id,h.id);checks.push('D1 creation and idempotent create');
  assert.equal((await request(student,`/homeworks/${h.id}`)).status,404);const sheet=(await request(teacher,`/homeworks/${h.id}/sheet`)).data;assert(!JSON.stringify(sheet).includes('correctOption'));checks.push('draft hidden and teacher worksheet has no keys');
  const changes=await Promise.all(['A','B'].map(title=>request(teacher,`/homeworks/${h.id}`,'PATCH',{revision:h.revision,title,items})));assert.deepEqual(changes.map(x=>x.status).sort(),[200,409]);const saved=changes.find(x=>x.status===200).data;assert.equal((await request(teacher,`/homeworks/${h.id}`)).data.title,saved.title);checks.push('D1 concurrent draft CAS preserves winning items');
  const published=(await request(teacher,`/homeworks/${h.id}/publish`,'POST',{revision:saved.revision,confirmed:true})).data;assert.equal(published.status,'published');assert(!JSON.stringify((await request(student,`/homeworks/${h.id}`)).data).includes('correctOption'));checks.push('publish freezes question snapshots and withholds student keys');
  assert.equal((await request(teacher,`/homeworks/${h.id}/submit`,'POST',{revision:published.revision,requestId:crypto.randomUUID(),answers:[]})).status,403);
  const submitBody={revision:published.revision,requestId:crypto.randomUUID(),answers:items.map(i=>({questionId:i.questionId,selectedOption:0,workText:'PRIVATE_WORK：真实接口提交的合成过程'}))};
  const submitted=await Promise.all([request(student,`/homeworks/${h.id}/submit`,'POST',submitBody),request(student,`/homeworks/${h.id}/submit`,'POST',{...submitBody,requestId:crypto.randomUUID()})]);assert.deepEqual(submitted.map(x=>x.status).sort(),[200,409]);const current=submitted.find(x=>x.status===200).data;assert.equal(current.result,null);assert(!JSON.stringify(current).includes('correctOption'));checks.push('student-only single submission with no automatic score');
  const gradeBody={revision:current.revision,requestId:crypto.randomUUID(),marks:items.map(i=>({questionId:i.questionId,earnedScore:0,note:'PRIVATE_NOTE'})),feedback:'PRIVATE_FEEDBACK',familySummary:'仅此摘要可供家长查看',confirmed:true};
  const grades=await Promise.all([request(teacher,`/homeworks/${h.id}/grade`,'POST',gradeBody),request(teacher,`/homeworks/${h.id}/grade`,'POST',{...gradeBody,requestId:crypto.randomUUID()})]);assert.deepEqual(grades.map(x=>x.status).sort(),[200,409]);const graded=grades.find(x=>x.status===200).data;assert.deepEqual(graded.result.score,{max:10,earned:0,percent:0});checks.push('D1 concurrent manual grade keeps a real zero and one final record');
  const feedback=(await request(student,`/homeworks/${h.id}/feedback`)).data;assert.equal(feedback.questions.length,2);assert(feedback.questions.every(q=>Number.isInteger(q.correctOption)));assert.equal((await request(teacher,`/homeworks/${h.id}`,'PATCH',{revision:graded.revision,title:'overwrite',items})).status,409);checks.push('post-grade answer release and final immutability');
  const summary=(await request(parent,`/students/${student.id}/homework-summaries`)).data.find(x=>x.id===h.id);assert.equal(summary.score.earned,0);assert(!JSON.stringify(summary).includes('PRIVATE_'));assert.equal((await request(parent,`/homeworks/${h.id}`)).status,403);checks.push('parent summary excludes work and private feedback');
  const originalLinks=(await request(admin,'/admin/relationships')).data;
  if(!originalLinks.some(x=>x.adultId===other.id&&x.studentId===student.id)){const linked=await request(admin,'/admin/relationships','POST',{adultId:other.id,studentId:student.id});assert.equal(linked.status,201);addedRelationship=linked.data.id;}
  assert.equal((await request(other,`/homeworks/${h.id}`)).status,404);assert(!(await request(other,`/homeworks?studentId=${student.id}`)).data.some(x=>x.id===h.id));assert(!(await request(other,`/students/${student.id}/growth`)).data.homeworkEvidence.some(x=>x.id===h.id));checks.push('a bound non-owner teacher has no homework access');
  const growth=(await request(parent,`/students/${student.id}/growth`)).data;assert.equal(growth.homeworkEvidence.find(x=>x.id===h.id).score.earned,0);assert(!growth.evidence.some(x=>x.id===h.id));checks.push('homework evidence remains separate from retests');
  // Exercise the non-null source-pack publication SQL in real D1 as well.
  const attempt=(await request(student,'/attempts','POST',{studentId:student.id,subject:'math',phase:'diagnostic'})).data;
  assert.equal((await request(student,`/attempts/${attempt.id}/submit`,'POST',{answers:attempt.questions.map(q=>({questionId:q.id,selectedOption:0}))})).status,200);
  const pack=(await request(student,'/packs','POST',{diagnosticId:attempt.id})).data;const approved=(await request(teacher,`/packs/${pack.id}`,'PATCH',{revision:pack.revision,knowledgeIds:['math-equation','math-fraction'],teacherNote:'合成验收',approve:true})).data;
  const linked=(await request(teacher,'/homeworks','POST',{...createBody,requestId:crypto.randomUUID(),sourcePackId:pack.id})).data;const linkedPublished=await request(teacher,`/homeworks/${linked.id}/publish`,'POST',{revision:linked.revision,confirmed:true});assert.equal(linkedPublished.status,200);assert.equal(linkedPublished.data.sourcePackRevision,approved.revision);checks.push('non-null source pack publication guard works in D1');
  const relationships=(await request(admin,'/admin/relationships')).data;const relation=relationships.find(x=>x.adultId===teacher.id&&x.studentId===student.id);assert(relation);assert.equal((await request(admin,`/admin/relationships/${relation.id}`,'DELETE')).status,200);
  removedTeacher={adultId:teacher.id,studentId:student.id};
  const rejected=await request(student,`/homeworks/${linked.id}/submit`,'POST',{...submitBody,revision:linkedPublished.data.revision,requestId:crypto.randomUUID()});assert.equal(rejected.error.code,'HOMEWORK_INACTIVE');assert.equal((await request(teacher,`/homeworks/${h.id}`)).status,404);assert.equal((await request(student,`/homeworks/${h.id}`)).status,200);checks.push('revocation stops new submissions and teacher reads, preserving student history');
}finally{
  try{if(removedTeacher)assert.equal((await request(adminClient,'/admin/relationships','POST',removedTeacher)).status,201);if(addedRelationship)assert.equal((await request(adminClient,`/admin/relationships/${addedRelationship}`,'DELETE')).status,200);}
  finally{for(const c of clients)await request(c,'/auth/logout','POST');}
}
mkdirSync(join(root,'test-results'),{recursive:true});writeFileSync(join(root,'test-results/workerd-homework-smoke.json'),JSON.stringify({passed:checks.length,checks,state:'.local/workerd-stage4-tests',notice:'Only synthetic local D1 records and automated teacher review; no production, normal demo data, or model calls.'},null,2));console.log(`workerd 独立作业 ${checks.length}/${checks.length} 通过。`);
