import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {scopeDescription} from '../public/assessment-scope.js';
async function setup(fn){const f=await fixture();try{const teacher=await f.login('teacher'),student=await f.login('student');const create=(extra={})=>f.request('/attempts',{client:student,method:'POST',body:{studentId:student.id,subject:'math',phase:'diagnostic',knowledgeIds:['math-equation'],...extra}});await f.request('/content/math-equation/review',{client:teacher,method:'POST',body:{version:1,confirmed:true}});await fn({...f,teacher,student,create});}finally{f.close();}}
test('one approved point enables a real scoped cycle while the all-example default remains blocked',()=>setup(async f=>{
  const blocked=await f.request('/attempts',{client:f.student,method:'POST',body:{studentId:f.student.id,subject:'math',phase:'diagnostic'}});assert.equal(blocked.error.code,'CONTENT_NOT_REVIEWED');
  const created=await f.create();assert.equal(created.status,201);const a=created.data;assert.equal(a.questions.length,1);assert.equal(a.scope.mode,'selected_topics');assert.deepEqual(a.scope.topics,[{id:'math-equation',title:'一元一次方程：等式的性质',version:1}]);assert(!JSON.stringify(a).includes('correctOption'));
  const answer=f.correctAnswers(a).map(x=>({...x,selectedOption:(x.selectedOption+1)%4}));await f.request(`/attempts/${a.id}/submit`,{client:f.student,method:'POST',body:{answers:answer}});
  const p=(await f.request('/packs',{client:f.student,method:'POST',body:{diagnosticId:a.id}})).data;assert.deepEqual(p.knowledgeIds,['math-equation']);await f.request(`/packs/${p.id}`,{client:f.teacher,method:'PATCH',body:{revision:p.revision,knowledgeIds:p.knowledgeIds,teacherNote:'专项辅导',approve:true}});
  for(const phase of ['practice','retest']){const r=await f.request('/attempts',{client:f.student,method:'POST',body:{studentId:f.student.id,subject:'math',phase,packId:p.id}});assert.equal(r.status,201);assert.equal(r.data.scope.mode,'pack_topics');await f.request(`/attempts/${r.data.id}/submit`,{client:f.student,method:'POST',body:{answers:f.correctAnswers(r.data)}});}
  const growth=(await f.request(`/students/${f.student.id}/growth`,{client:f.student})).data;assert.equal(growth.evidence.length,3);assert.equal(growth.comparisons.length,1);assert(growth.topicEvidence.every(r=>r.knowledgeId==='math-equation'&&r.answered===1));assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM content_reviews').get().n,1);
}));
test('scope rejects empty, duplicate, mixed-subject, unknown and unreviewed points and ignores no approval boundaries',()=>setup(async f=>{
  for(const ids of [[],null,'math-equation',['math-equation','math-equation'],['english-be'],['unknown'],[{}]])assert.equal((await f.create({knowledgeIds:ids})).error.code,'INVALID_SCOPE');
  assert.equal((await f.create({knowledgeIds:['math-fraction']})).error.code,'CONTENT_NOT_REVIEWED');assert.equal((await f.create({scope:{mode:'subject_examples'},score:100})).status,400);
  assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM attempts').get().n,0);
}));
test('practice/retest scope cannot be substituted by the client and a selected missing question fails closed',()=>setup(async f=>{
  for(const phase of ['practice','retest'])assert.equal((await f.create({phase,packId:'unused'})).error.code,'INVALID_SCOPE');
  f.DB.sqlite.prepare("DELETE FROM questions WHERE id='math-equation-diagnostic'").run();assert.equal((await f.create()).error.code,'CONTENT_INCOMPLETE');assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM attempts').get().n,0);
}));
test('saved scope labels survive catalog changes and old snapshots are explicitly legacy',()=>setup(async f=>{
  const a=(await f.create()).data;f.DB.sqlite.prepare("UPDATE knowledge SET title='later title',version=2 WHERE id='math-equation'").run();const get=()=>f.request(`/attempts/${a.id}`,{client:f.student});assert.deepEqual((await get()).data.scope,a.scope);
  const summary=(await f.request(`/attempts?studentId=${f.student.id}`,{client:f.student})).data[0];assert.deepEqual(summary.scope,a.scope);assert(!JSON.stringify(summary).includes('correctOption'));
  const item=f.DB.sqlite.prepare('SELECT * FROM attempt_items WHERE attempt_id=?').get(a.id),snapshot=JSON.parse(item.snapshot_json);delete snapshot.knowledgeTitle;delete snapshot.scopeMode;f.DB.sqlite.prepare('UPDATE attempt_items SET snapshot_json=? WHERE attempt_id=?').run(JSON.stringify(snapshot),a.id);
  const legacy=(await get()).data.scope;assert.equal(legacy.mode,'legacy');assert.equal(legacy.topics[0].title,null);assert(!scopeDescription(legacy).includes('later title'));assert.match(scopeDescription(legacy),/历史题目范围/);
}));
test('scoped creation preserves tenant, owner, role, teacher-source and revocation checks',()=>setup(async f=>{
  assert.equal((await f.create({studentId:f.users.student2.id})).status,404);
  assert.equal((await f.create({studentId:f.users.foreignStudent.id})).status,404);
  const foreign=await f.login('foreignStudent');assert.equal((await f.request('/attempts',{client:foreign,method:'POST',body:{studentId:foreign.id,subject:'math',phase:'diagnostic',knowledgeIds:['math-equation']}})).error.code,'CONTENT_NOT_REVIEWED');
  const teacher2=await f.login('teacher2'),parent=await f.login('parent'),admin=await f.login('admin');const body={studentId:f.student.id,subject:'math',phase:'diagnostic',knowledgeIds:['math-equation']};
  for(const client of [parent,admin])assert.equal((await f.request('/attempts',{client,method:'POST',body})).status,403);
  assert.equal((await f.request('/attempts',{client:teacher2,method:'POST',body})).status,404);
  const a=(await f.request('/attempts',{client:f.teacher,method:'POST',body})).data;const sent=await f.request(`/attempts/${a.id}/submit`,{client:f.teacher,method:'POST',body:{answers:f.correctAnswers(a)}});assert.equal(sent.data.source,'teacher_recorded');
  const growth=(await f.request(`/students/${f.student.id}/growth`,{client:parent})).data;assert.equal(growth.evidence[0].scope.mode,'selected_topics');assert(!JSON.stringify(growth).includes('correctOption'));
  const links=(await f.request('/admin/relationships',{client:admin})).data;await f.request(`/admin/relationships/${links.find(l=>l.kind==='teacher').id}`,{client:admin,method:'DELETE'});assert.equal((await f.request('/attempts',{client:f.teacher,method:'POST',body})).status,404);
}));
test('English scoped screening works after only its selected point is approved',()=>setup(async f=>{
  await f.request('/content/english-be/review',{client:f.teacher,method:'POST',body:{version:1,confirmed:true}});const a=await f.create({subject:'english',knowledgeIds:['english-be']});assert.equal(a.status,201);assert.equal(a.data.questions.length,1);assert.equal(a.data.scope.topics[0].id,'english-be');assert.equal((await f.create({subject:'english',knowledgeIds:['english-present']})).error.code,'CONTENT_NOT_REVIEWED');
}));
