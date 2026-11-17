import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,PNG} from './helpers.mjs';
import {id} from '../src/security.mjs';
import {paperCsv,safeCsvCell} from '../public/paper-workspace.js';
const leaf=(no='1',extra={})=>({questionNo:no,prompt:'人工录入：求 1/3 + 1/6。',qtype:'solution',mappingLevel:'chapter',scopeText:'全等三角形',knowledgeId:null,maxScore:5,earnedScore:2.5,observationLevel:null,note:'按实际步骤给部分分。',reviewed:true,...extra});
async function setup(fn){const f=await fixture();try{const teacher=await f.login('teacher');const create=async(extra={})=>f.request('/papers',{client:teacher,method:'POST',body:{studentId:f.users.student.id,subject:'math',title:'本地人工阅卷测试',kind:'scored_paper',requestId:id(),...extra}});const save=(p,items,extra={})=>f.request(`/papers/${p.id}`,{client:teacher,method:'PATCH',body:{revision:p.revision,title:p.title,items,...extra}});const confirm=p=>f.request(`/papers/${p.id}/confirm`,{client:teacher,method:'POST',body:{revision:p.revision,confirmed:true}});await fn({...f,teacher,create,save,confirm});}finally{f.close();}}
test('paper CRUD -> explicit partial scores -> immutable report; leaf grouping and source stay separate',()=>setup(async f=>{
  const p=(await f.create()).data;const saved=await f.save(p,[leaf('21(1)',{maxScore:4,earnedScore:2.5}),leaf('21(2)',{maxScore:6,earnedScore:3.5})]);assert.equal(saved.status,200);assert.equal(saved.data.items[0].parentNo,'21');assert.equal(saved.data.items[0].knowledgeId,null);
  const confirmed=await f.confirm(saved.data);assert.equal(confirmed.status,200);assert.deepEqual(confirmed.data.report.score,{max:10,earned:6,percent:60});assert.equal(confirmed.data.report.chapterOnlyCount,2);assert.equal(confirmed.data.report.aiUsedForGrading,false);assert.equal(confirmed.data.source,'teacher_marked');
  assert.equal((await f.save(confirmed.data,[leaf()])).error.code,'PAPER_LOCKED');assert.equal((await f.confirm(confirmed.data)).error.code,'ALREADY_CONFIRMED');
  assert.equal(f.DB.sqlite.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='paper_confirmed'").get().n,1);
  const s=await f.login('student'),growth=(await f.request(`/students/${s.id}/growth`,{client:s})).data;assert.equal(growth.evidence.length,0);assert.equal(growth.paperEvidence.length,1);assert.equal(growth.paperEvidence[0].score.earned,6);
}));
test('unknown full score, missing earned score and unchecked rows stay draft; no fallback from observation',()=>setup(async f=>{
  const p=(await f.create()).data;assert.equal((await f.request(`/papers/${p.id}/report`,{client:f.teacher})).error.code,'PAPER_NOT_CONFIRMED');
  let s=(await f.save(p,[leaf('1',{maxScore:null,earnedScore:null})])).data;assert.equal((await f.confirm(s)).error.code,'SCORE_INCOMPLETE');
  s=(await f.save(s,[leaf('1',{reviewed:false})])).data;assert.equal((await f.confirm(s)).error.code,'REVIEW_INCOMPLETE');
  assert.equal(f.DB.sqlite.prepare("SELECT COUNT(*) n FROM paper_assessments WHERE status='confirmed'").get().n,0);
  assert.equal((await f.save(s,[leaf('1',{earnedScore:6})])).status,400);assert.equal((await f.save(s,[leaf('1',{earnedScore:2.333})])).status,400);assert.equal((await f.save(s,[leaf('1',{observationLevel:2})])).error.code,'MIXED_EVIDENCE');
}));
test('ability observations retain exact 0–3 bands and never generate a paper percent',()=>setup(async f=>{
  const p=(await f.create({kind:'ability_observation'})).data;
  const saved=(await f.save(p,[leaf('1',{qtype:'observation',maxScore:null,earnedScore:null,observationLevel:2}),leaf('2',{qtype:'observation',maxScore:null,earnedScore:null,observationLevel:0})])).data;
  const r=(await f.confirm(saved)).data;assert.equal(r.report.score,null);assert.equal(r.report.observationCounts.find(o=>o.level===2).count,1);assert.equal(r.source,'teacher_observation');assert(!JSON.stringify(r.report).includes('percent'));
  assert.equal((await f.save((await f.create({kind:'ability_observation'})).data,[leaf('1')])).error.code,'MIXED_EVIDENCE');
}));
test('paper validates numbering, parent double count, mapping, source spoofing and request fields',()=>setup(async f=>{
  const p=(await f.create()).data;
  assert.equal((await f.save(p,[leaf('21'),leaf('21(1)')])).error.code,'DOUBLE_COUNTED_PARENT');assert.equal((await f.save(p,[leaf('21(1)'),leaf('21（1）')])).error.code,'INVALID_QUESTION_NUMBER');
  assert.equal((await f.save(p,[leaf('01')])).status,400);assert.equal((await f.save(p,[leaf('21(1)',{parentNo:'22'})])).status,400);
  assert.equal((await f.save(p,[leaf('1',{mappingLevel:'chapter',knowledgeId:'math-equation'})])).error.code,'INVALID_MAPPING');
  assert.equal((await f.save(p,[leaf('1',{mappingLevel:'knowledge',knowledgeId:'english-be'})])).error.code,'INVALID_MAPPING');
  assert.equal((await f.save(p,[leaf('1',{source:'ai_inferred'})])).status,400);assert.equal((await f.create({contentOrigin:'ai_generated'})).status,400);
  const result=await f.save(p,[leaf('1',{mappingLevel:'knowledge',knowledgeId:'math-equation',scopeText:'伪造范围'})]);assert.equal(result.data.items[0].scopeText,'一元一次方程：等式的性质');assert.equal(result.data.items[0].knowledgeVersion,1);
}));
test('draft confidentiality, teacher relations, parent summaries, administrator and cross-tenant isolation',()=>setup(async f=>{
  const [s,p,a,t2]=await Promise.all(['student','parent','admin','teacher2'].map(n=>f.login(n)));const draft=(await f.create()).data;
  for(const client of [s,p,a,t2])assert([403,404].includes((await f.request(`/papers/${draft.id}`,{client})).status));
  assert.equal((await f.request(`/papers?studentId=${s.id}`,{client:s})).data.length,0);assert.equal((await f.request(`/students/${s.id}/paper-summaries`,{client:p})).data.length,0);
  assert.equal((await f.create({studentId:f.users.student2.id})).status,404);assert.equal((await f.create({studentId:f.users.foreignStudent.id})).status,404);
  const record=(await f.confirm((await f.save(draft,[leaf()])).data)).data;assert.equal((await f.request(`/papers/${record.id}`,{client:s})).status,200);
  assert.equal((await f.request(`/papers/${record.id}`,{client:p})).status,403);const summary=(await f.request(`/students/${s.id}/paper-summaries`,{client:p})).data;assert.equal(summary.length,1);assert(!JSON.stringify(summary).includes('prompt'));assert(!JSON.stringify(summary).includes('核对说明'));assert(!('items' in summary[0]));
  const links=(await f.request('/admin/relationships',{client:a})).data;await f.request(`/admin/relationships/${links.find(l=>l.kind==='teacher').id}`,{client:a,method:'DELETE'});assert.equal((await f.request(`/papers/${record.id}`,{client:f.teacher})).status,404);
}));
test('draft saves and confirms are atomic under concurrent duplicate operations',()=>setup(async f=>{
  const p=(await f.create()).data;
  const saves=await Promise.all([f.save(p,[leaf('1',{earnedScore:1})]),f.save(p,[leaf('1',{earnedScore:4})])]);assert.deepEqual(saves.map(r=>r.status).sort(),[200,409]);
  const success=saves.find(r=>r.status===200).data,current=(await f.request(`/papers/${p.id}`,{client:f.teacher})).data;assert.equal(current.items[0].earnedScore,success.items[0].earnedScore);assert.equal(current.revision,2);
  const confirms=await Promise.all([f.confirm(current),f.confirm(current)]);assert.deepEqual(confirms.map(r=>r.status).sort(),[200,409]);assert.equal(f.DB.sqlite.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='paper_confirmed'").get().n,1);
}));
test('create idempotency preserves a single draft; mismatched replay is rejected',()=>setup(async f=>{
  const requestId=id();const first=await f.create({requestId}),second=await f.create({requestId});assert.equal(first.status,201);assert.equal(second.status,200);assert.equal(first.data.id,second.data.id);
  assert.equal((await f.create({requestId,title:'different'})).error.code,'IDEMPOTENCY_CONFLICT');assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM paper_assessments').get().n,1);
}));
test('attachment ownership and expiration stay independent from confirmed paper evidence',()=>setup(async f=>{
  const s=await f.login('student');const u=(await f.request(`/uploads?studentId=${s.id}`,{client:s,method:'POST',raw:true,headers:{'Content-Type':'image/png'},body:PNG})).data;
  const p=(await f.create({uploadId:u.id})).data;const saved=(await f.save(p,[leaf()])).data;await f.confirm(saved);await f.request(`/uploads/${u.id}`,{client:s,method:'DELETE'});
  const detail=(await f.request(`/papers/${p.id}/report`,{client:s})).data;assert.equal(detail.attachment,null);assert.equal(detail.report.score.earned,2.5);assert.equal((await f.create({uploadId:u.id})).error.code,'INVALID_ATTACHMENT');
}));
test('CSV escapes Excel formula injection and preserves explicit source and decimal values',()=>{
  assert.equal(safeCsvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');const csv=paperCsv({title:'=@evil',kind:'scored_paper',status:'confirmed',source:'teacher_marked',report:{algorithmVersion:'v1'},items:[{questionNo:'1',prompt:'中文 1/3',earnedScore:2.5,maxScore:4,note:'+cmd'}]});assert(csv.startsWith('\ufeff'));assert(csv.includes("'=@evil"));assert(csv.includes("'+cmd"));assert(csv.includes('teacher_marked'));assert(csv.includes('2.5'));
});
