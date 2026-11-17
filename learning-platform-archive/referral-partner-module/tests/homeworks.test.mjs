import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {id} from '../src/security.mjs';

async function scenario(fn){const f=await fixture();try{const t=await f.login('teacher'),s=await f.login('student');const items=[{questionId:'math-equation-practice',maxScore:4},{questionId:'math-fraction-practice',maxScore:6}];const create=(extra={})=>f.request('/homeworks',{client:t,method:'POST',body:{studentId:s.id,subject:'math',title:'独立作业测试',instructions:'请写出过程。',items,requestId:id(),...extra}});const publish=h=>f.request(`/homeworks/${h.id}/publish`,{client:t,method:'POST',body:{revision:h.revision,confirmed:true}});const submit=(h,extra={})=>f.request(`/homeworks/${h.id}/submit`,{client:s,method:'POST',body:{revision:h.revision,requestId:id(),answers:items.map(i=>({questionId:i.questionId,selectedOption:0,workText:'实际填写的过程'})),...extra}});const grade=(h,extra={})=>f.request(`/homeworks/${h.id}/grade`,{client:t,method:'POST',body:{revision:h.revision,requestId:id(),marks:items.map(i=>({questionId:i.questionId,earnedScore:i.maxScore/2,note:'仅给老师与学生的逐题反馈'})),feedback:'仅给学生的详细反馈',familySummary:'可以给家长看的摘要',confirmed:true,...extra}});await fn({...f,t,s,items,create,publish,submit,grade});}finally{f.close();}}
test('homework requires reviewed practice content and protects draft/answer boundaries',()=>scenario(async f=>{
  assert.equal((await f.create()).error.code,'CONTENT_NOT_REVIEWED');await f.review(f.t);const h=(await f.create()).data;assert.equal(h.status,'draft');assert(h.questions.every(q=>Number.isInteger(q.correctOption)));
  assert.equal((await f.request(`/homeworks/${h.id}`,{client:f.s})).status,404);assert.equal((await f.request(`/homeworks?studentId=${f.s.id}`,{client:f.s})).data.length,0);
  const parent=await f.login('parent');assert.equal((await f.request(`/students/${f.s.id}/homework-summaries`,{client:parent})).data.length,0);assert.equal((await f.request('/homework-catalog?subject=math',{client:f.s})).status,403);
  const sheet=(await f.request(`/homeworks/${h.id}/sheet`,{client:f.t})).data;assert(!JSON.stringify(sheet).includes('correctOption'));assert(!JSON.stringify(sheet).includes('rationale'));
  const published=(await f.publish(h)).data;const own=(await f.request(`/homeworks/${h.id}`,{client:f.s})).data;assert.equal(own.status,'published');assert(!JSON.stringify(own).includes('correctOption'));assert(!JSON.stringify(own).includes('rationale'));assert.equal(own.result,null);
  assert.equal((await f.request(`/students/${f.s.id}/growth`,{client:f.s})).data.homeworkEvidence.length,0);assert.equal((await f.grade(published)).error.code,'SUBMISSION_REQUIRED');
  assert.equal((await f.create({items:[{questionId:'math-equation-diagnostic',maxScore:1}]})).status,409);
}));
test('actual submit then manual grading persists separate evidence and parent-safe summary',()=>scenario(async f=>{
  await f.review(f.t);const h=(await f.publish((await f.create({dueAt:'2020-01-01T00:00:00Z'})).data)).data;
  const submitted=(await f.submit(h)).data;assert.equal(submitted.status,'submitted');assert.equal(submitted.late,true);assert.equal(submitted.result,null);assert(!JSON.stringify(submitted).includes('correctOption'));
  const pendingGrowth=(await f.request(`/students/${f.s.id}/growth`,{client:f.s})).data;assert.equal(pendingGrowth.homeworkEvidence.length,1);assert.equal(pendingGrowth.homeworkEvidence[0].score,null);assert.equal(pendingGrowth.evidence.length,0);assert.equal(pendingGrowth.paperEvidence.length,0);
  const graded=(await f.grade(submitted)).data;assert.deepEqual(graded.result.score,{max:10,earned:5,percent:50});assert.equal(graded.result.source,'teacher_homework_marked');assert.equal(graded.result.aiUsedForGrading,false);assert.equal(graded.questions[0].earnedScore,2);
  const studentView=(await f.request(`/homeworks/${h.id}/feedback`,{client:f.s})).data;assert.equal(studentView.feedback,'仅给学生的详细反馈');assert(studentView.questions.every(q=>Number.isInteger(q.correctOption)));
  const parent=await f.login('parent'),summary=(await f.request(`/students/${f.s.id}/homework-summaries`,{client:parent})).data;assert.equal(summary[0].familySummary,'可以给家长看的摘要');const json=JSON.stringify(summary);assert(!json.includes('实际填写的过程'));assert(!json.includes('详细反馈'));assert(!json.includes('correctOption'));assert.equal((await f.request(`/homeworks/${h.id}/feedback`,{client:parent})).status,403);
  assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM attempts').get().n,0);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM paper_assessments').get().n,0);
}));
test('owner restrictions cover teacher list, summary, growth, detail and exports',()=>scenario(async f=>{
  await f.review(f.t);const h=(await f.submit((await f.publish((await f.create()).data)).data)).data;const admin=await f.login('admin'),other=await f.login('teacher2');await f.request('/admin/relationships',{client:admin,method:'POST',body:{adultId:other.id,studentId:f.s.id}});
  assert.equal((await f.request(`/homeworks?studentId=${f.s.id}`,{client:other})).data.length,0);assert.equal((await f.request(`/students/${f.s.id}/homework-summaries`,{client:other})).data.length,0);assert.equal((await f.request(`/students/${f.s.id}/growth`,{client:other})).data.homeworkEvidence.length,0);
  for(const suffix of ['','/sheet','/feedback'])assert.equal((await f.request(`/homeworks/${h.id}${suffix}`,{client:other})).status,404);
  const second=await f.login('student2');assert.equal((await f.request(`/homeworks/${h.id}`,{client:second})).status,404);assert.equal((await f.request(`/homeworks/${h.id}`,{client:admin})).status,403);
  assert.equal((await f.create({studentId:f.users.foreignStudent.id})).status,404);
}));
test('revocation blocks new collection and teacher operations while preserving student history',()=>scenario(async f=>{
  await f.review(f.t);const h=(await f.publish((await f.create()).data)).data,admin=await f.login('admin');const link=(await f.request('/admin/relationships',{client:admin})).data.find(r=>r.kind==='teacher');await f.request(`/admin/relationships/${link.id}`,{client:admin,method:'DELETE'});
  assert.equal((await f.request(`/homeworks/${h.id}`,{client:f.s})).data.acceptingSubmissions,false);assert.equal((await f.submit(h)).error.code,'HOMEWORK_INACTIVE');assert.equal((await f.request(`/homeworks/${h.id}`,{client:f.t})).status,404);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM homework_answers').get().n,0);
}));
test('SQL relation guard prevents a revocation after application validation from accepting submission',()=>scenario(async f=>{
  await f.review(f.t);const h=(await f.publish((await f.create()).data)).data;const original=f.DB.batch.bind(f.DB);let injected=false;f.DB.batch=async statements=>{if(!injected){injected=true;f.DB.sqlite.prepare('DELETE FROM relationships WHERE adult_id=?').run(f.t.id);}return original(statements);};
  assert.equal((await f.submit(h)).status,409);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM homework_answers').get().n,0);assert.equal(f.DB.sqlite.prepare('SELECT status FROM homeworks').get().status,'published');
}));
test('create/submit/grade retries are idempotent and changed replay is rejected',()=>scenario(async f=>{
  await f.review(f.t);const createId=id(),first=await f.create({requestId:createId}),again=await f.create({requestId:createId});assert.equal(first.data.id,again.data.id);assert.equal(again.status,200);assert.equal((await f.create({requestId:createId,title:'changed'})).status,409);
  const published=(await f.publish(first.data)).data,submitId=id(),submitted=(await f.submit(published,{requestId:submitId})).data;assert.equal((await f.submit(published,{requestId:submitId})).status,200);assert.equal((await f.submit(published,{requestId:submitId,answers:f.items.map(i=>({questionId:i.questionId,selectedOption:1,workText:'changed'}))})).status,409);
  const gradeId=id();await f.grade(submitted,{requestId:gradeId});assert.equal((await f.grade(submitted,{requestId:gradeId})).status,200);assert.equal((await f.grade(submitted,{requestId:gradeId,feedback:'changed'})).status,409);
  assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM homework_answers').get().n,2);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM homework_marks').get().n,2);for(const event of ['homework_created','homework_student_submitted','homework_teacher_graded'])assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM audit_events WHERE action=?').get(event).n,1);
}));
test('concurrent draft, submit and grading requests cannot corrupt winning data',()=>scenario(async f=>{
  await f.review(f.t);const h=(await f.create()).data;const patch=title=>f.request(`/homeworks/${h.id}`,{client:f.t,method:'PATCH',body:{revision:h.revision,title,items:f.items}});const drafts=await Promise.all([patch('winner-a'),patch('winner-b')]);assert.deepEqual(drafts.map(r=>r.status).sort(),[200,409]);const chosen=drafts.find(r=>r.status===200).data;
  const p=(await f.publish(chosen)).data,submitted=await Promise.all([f.submit(p),f.submit(p)]);assert.deepEqual(submitted.map(r=>r.status).sort(),[200,409]);const sent=submitted.find(r=>r.status===200).data;
  const graded=await Promise.all([f.grade(sent),f.grade(sent)]);assert.deepEqual(graded.map(r=>r.status).sort(),[200,409]);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM homework_marks').get().n,2);
}));
test('snapshots freeze published content; source review changes and draft packet mismatch block publication',()=>scenario(async f=>{
  await f.review(f.t);const h=(await f.create()).data;f.DB.sqlite.prepare("UPDATE questions SET prompt='changed source' WHERE id='math-equation-practice'").run();assert.equal((await f.publish(h)).error.code,'CONTENT_VERSION_CHANGED');
  f.DB.sqlite.prepare("UPDATE knowledge SET version=2 WHERE id='math-equation'").run();await f.request('/content/math-equation/review',{client:f.t,method:'POST',body:{version:2,confirmed:true}});
  const p=(await f.publish((await f.create()).data)).data;const original=(await f.request(`/homeworks/${p.id}`,{client:f.s})).data.questions[0].prompt;f.DB.sqlite.prepare("UPDATE questions SET prompt='later source',correct_option=3").run();assert.equal((await f.request(`/homeworks/${p.id}`,{client:f.s})).data.questions[0].prompt,original);
  assert.equal((await f.request(`/homeworks/${p.id}`,{client:f.t,method:'PATCH',body:{revision:p.revision,title:'overwrite',items:f.items}})).error.code,'HOMEWORK_LOCKED');
}));
test('student cannot inject scores, missing answers or other items; grades validate all points and zero',()=>scenario(async f=>{
  await f.review(f.t);const p=(await f.publish((await f.create()).data)).data;assert.equal((await f.submit(p,{score:100})).status,400);assert.equal((await f.submit(p,{answers:[]})).status,400);assert.equal((await f.submit(p,{answers:[{questionId:'fake',selectedOption:0},{questionId:'fake',selectedOption:0}]})).status,400);
  assert.equal((await f.request(`/homeworks/${p.id}/submit`,{client:f.t,method:'POST',body:{revision:p.revision,requestId:id(),answers:[]}})).status,403);
  const submitted=(await f.submit(p)).data;assert.equal((await f.grade(submitted,{marks:f.items.map(i=>({questionId:i.questionId,earnedScore:999}))})).status,400);assert.equal((await f.grade(submitted,{marks:f.items.map(i=>({questionId:i.questionId,earnedScore:0.123}))})).status,400);
  const zero=(await f.grade(submitted,{marks:f.items.map(i=>({questionId:i.questionId,earnedScore:0}))})).data;assert.deepEqual(zero.result.score,{max:10,earned:0,percent:0});
}));
test('pack linkage is scoped and homework does not auto-complete pack or manufacture retests',()=>scenario(async f=>{
  await f.review(f.t);const a=(await f.request('/attempts',{client:f.s,method:'POST',body:{studentId:f.s.id,subject:'math',phase:'diagnostic'}})).data;await f.request(`/attempts/${a.id}/submit`,{client:f.s,method:'POST',body:{answers:f.correctAnswers(a)}});const pack=(await f.request('/packs',{client:f.s,method:'POST',body:{diagnosticId:a.id}})).data;
  assert.equal((await f.create({sourcePackId:pack.id})).error.code,'PACK_NOT_READY');const approved=(await f.request(`/packs/${pack.id}`,{client:f.t,method:'PATCH',body:{revision:pack.revision,knowledgeIds:pack.knowledgeIds,teacherNote:'',approve:true}})).data;
  const h=(await f.publish((await f.create({sourcePackId:approved.id})).data)).data;await f.grade((await f.submit(h)).data);assert.equal((await f.request(`/packs/${pack.id}`,{client:f.s})).data.status,'approved');assert.equal(f.DB.sqlite.prepare("SELECT COUNT(*) n FROM attempts WHERE phase='retest'").get().n,0);
  assert.equal((await f.create({sourcePackId:'unknown'})).error.code,'SOURCE_PACK_MISMATCH');
}));
test('confirmed paper is reference only, not copied or converted into homework grades',()=>scenario(async f=>{
  await f.review(f.t);const submitted=(await f.submit((await f.publish((await f.create()).data)).data)).data;const draft=(await f.request('/papers',{client:f.t,method:'POST',body:{studentId:f.s.id,title:'参考卷',subject:'math',kind:'scored_paper',requestId:id()}})).data;
  assert.equal((await f.grade(submitted,{paperId:draft.id})).error.code,'SOURCE_PAPER_MISMATCH');const saved=(await f.request(`/papers/${draft.id}`,{client:f.t,method:'PATCH',body:{revision:1,title:draft.title,items:[{questionNo:'1',prompt:'参考题',qtype:'solution',mappingLevel:'unresolved',maxScore:100,earnedScore:99,reviewed:true}]}})).data;await f.request(`/papers/${draft.id}/confirm`,{client:f.t,method:'POST',body:{revision:saved.revision,confirmed:true}});
  const graded=(await f.grade(submitted,{paperId:draft.id})).data;assert.equal(graded.paperReference.id,draft.id);assert.equal(graded.result.score.earned,5);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM paper_assessments').get().n,1);
}));

test('English homework persists its own reviewed questions and rejects cross-subject selection',()=>scenario(async f=>{
  await f.review(f.t);
  assert.equal((await f.create({subject:'english'})).error.code,'CONTENT_NOT_REVIEWED');
  const items=[{questionId:'english-be-practice',maxScore:1},{questionId:'english-present-practice',maxScore:2}];
  const draft=await f.create({subject:'english',items});assert.equal(draft.status,201);
  const published=(await f.publish(draft.data)).data;
  const submitted=await f.request(`/homeworks/${published.id}/submit`,{client:f.s,method:'POST',body:{revision:published.revision,requestId:id(),answers:items.map(i=>({questionId:i.questionId,selectedOption:0,workText:'My own explanation.'}))}});assert.equal(submitted.status,200);
  const graded=await f.request(`/homeworks/${published.id}/grade`,{client:f.t,method:'POST',body:{revision:submitted.data.revision,requestId:id(),marks:[{questionId:items[0].questionId,earnedScore:1},{questionId:items[1].questionId,earnedScore:0.5}],feedback:'复习第三人称单数。',confirmed:true}});assert.equal(graded.status,200);assert.deepEqual(graded.data.result.score,{max:3,earned:1.5,percent:50});
  const growth=(await f.request(`/students/${f.s.id}/growth`,{client:f.s})).data;assert.equal(growth.homeworkEvidence[0].subject,'english');assert.equal(growth.evidence.length,0);
}));
test('publication atomically guards the approved source pack revision against a concurrent valid edit',()=>scenario(async f=>{
  await f.review(f.t);const a=(await f.request('/attempts',{client:f.s,method:'POST',body:{studentId:f.s.id,subject:'math',phase:'diagnostic'}})).data;await f.request(`/attempts/${a.id}/submit`,{client:f.s,method:'POST',body:{answers:f.correctAnswers(a)}});const pack=(await f.request('/packs',{client:f.s,method:'POST',body:{diagnosticId:a.id}})).data;const approved=(await f.request(`/packs/${pack.id}`,{client:f.t,method:'PATCH',body:{revision:pack.revision,knowledgeIds:pack.knowledgeIds,teacherNote:'',approve:true}})).data;
  const draft=(await f.create({sourcePackId:pack.id})).data,original=f.DB.batch.bind(f.DB);let injected=false;
  f.DB.batch=async statements=>{if(!injected){injected=true;const changed=await f.request(`/packs/${pack.id}`,{client:f.t,method:'PATCH',body:{revision:approved.revision,knowledgeIds:['math-fraction'],teacherNote:'仅分数',approve:true}});assert.equal(changed.status,200);}return original(statements);};
  assert.equal((await f.publish(draft)).status,409);assert.equal(f.DB.sqlite.prepare('SELECT status FROM homeworks').get().status,'draft');assert.equal(f.DB.sqlite.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='homework_published'").get().n,0);
  const saved=(await f.request(`/homeworks/${draft.id}`,{client:f.t,method:'PATCH',body:{revision:draft.revision,title:draft.title,sourcePackId:pack.id,items:[f.items[1]]}})).data;const published=(await f.publish(saved)).data;assert.equal(published.sourcePackRevision,3);assert.equal(published.questions.length,1);
}));
