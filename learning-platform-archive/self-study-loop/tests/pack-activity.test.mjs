import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
async function scenario(fn){const f=await fixture();try{const t=await f.login('teacher'),s=await f.login('student');await f.review(t);const create=()=>f.request('/attempts',{client:s,method:'POST',body:{studentId:s.id,subject:'math',phase:'diagnostic',knowledgeIds:['math-equation']}});await fn({...f,t,s,create});}finally{f.close();}}
test('learning-cycle is empty or follows the latest diagnostic and real package phases',()=>scenario(async f=>{
  const get=()=>f.request(`/students/${f.s.id}/learning-cycle?subject=math`,{client:f.s});assert.deepEqual((await get()).data,{diagnostic:null,pack:null,practice:null,retest:null});
  const a=(await f.create()).data;assert.equal((await get()).data.diagnostic.status,'open');assert.equal((await get()).data.diagnostic.result,null);await f.request(`/attempts/${a.id}/submit`,{client:f.s,method:'POST',body:{answers:f.correctAnswers(a)}});
  const p=(await f.request('/packs',{client:f.s,method:'POST',body:{diagnosticId:a.id}})).data;assert.equal((await get()).data.pack.id,p.id);assert.equal((await get()).data.pack.status,'draft');
  assert.equal((await f.request(`/packs/${p.id}`,{client:f.s,method:'PATCH',body:{revision:p.revision,knowledgeIds:p.knowledgeIds,teacherNote:'forged approval',approve:true}})).status,403);
  await f.request(`/packs/${p.id}`,{client:f.t,method:'PATCH',body:{revision:p.revision,knowledgeIds:p.knowledgeIds,teacherNote:'',approve:true}});
  for(const phase of ['practice','retest']){const r=(await f.request('/attempts',{client:f.s,method:'POST',body:{studentId:f.s.id,subject:'math',phase,packId:p.id}})).data;const activity=(await f.request(`/packs/${p.id}/activity`,{client:f.s})).data;assert.equal(activity[phase].status,'open');assert.equal(activity[phase].result,null);await f.request(`/attempts/${r.id}/submit`,{client:f.s,method:'POST',body:{answers:f.correctAnswers(r)}});}
  const completed=(await get()).data;assert.equal(completed.retest.status,'submitted');assert.deepEqual(completed.retest.result,{correct:1,total:1});assert(!JSON.stringify(completed).includes('correctOption'));assert(!JSON.stringify(completed).includes('rationale'));
  const newer=(await f.create()).data;const latest=(await get()).data;assert.equal(latest.diagnostic.id,newer.id);assert.equal(latest.pack,null);assert.equal(latest.retest,null);
}));
test('a package activity lookup does not mistake a 100-record list truncation for no practice',()=>scenario(async f=>{
  const a=(await f.create()).data;await f.request(`/attempts/${a.id}/submit`,{client:f.s,method:'POST',body:{answers:f.correctAnswers(a)}});const p=(await f.request('/packs',{client:f.s,method:'POST',body:{diagnosticId:a.id}})).data;await f.request(`/packs/${p.id}`,{client:f.t,method:'PATCH',body:{revision:p.revision,knowledgeIds:p.knowledgeIds,teacherNote:'',approve:true}});
  const practice=(await f.request('/attempts',{client:f.s,method:'POST',body:{studentId:f.s.id,subject:'math',phase:'practice',packId:p.id}})).data;
  for(let i=0;i<101;i++){if(i%40===0)f.DB.sqlite.prepare('DELETE FROM rate_limits').run();assert.equal((await f.create()).status,201);} // Fixture-only reset simulates history accumulated over rate-limit windows.
  const list=(await f.request(`/attempts?studentId=${f.s.id}`,{client:f.s})).data;assert.equal(list.length,100);assert(!list.some(x=>x.id===practice.id));const exact=(await f.request(`/packs/${p.id}/activity`,{client:f.s})).data;assert.equal(exact.practice.id,practice.id);assert.equal(exact.practice.status,'open');assert.equal(exact.retest,null);
}));
test('cycle and package summaries preserve teacher/parent/student/tenant/revocation boundaries',()=>scenario(async f=>{
  const a=(await f.create()).data;await f.request(`/attempts/${a.id}/submit`,{client:f.s,method:'POST',body:{answers:f.correctAnswers(a)}});const p=(await f.request('/packs',{client:f.s,method:'POST',body:{diagnosticId:a.id}})).data;
  const routes=[`/packs/${p.id}/activity`,`/students/${f.s.id}/learning-cycle?subject=math`];
  for(const name of ['parent','admin','student2','teacher2','foreignStudent']){const c=await f.login(name);for(const path of routes)assert([403,404].includes((await f.request(path,{client:c})).status));}
  const admin=await f.login('admin'),links=(await f.request('/admin/relationships',{client:admin})).data;await f.request(`/admin/relationships/${links.find(l=>l.kind==='teacher').id}`,{client:admin,method:'DELETE'});for(const path of routes)assert.equal((await f.request(path,{client:f.t})).status,404);
  assert.equal((await f.request(`/students/${f.s.id}/learning-cycle?subject=unknown`,{client:f.s})).status,400);
}));
