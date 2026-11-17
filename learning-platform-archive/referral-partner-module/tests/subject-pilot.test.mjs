import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {importBank} from '../src/question-bank-import.mjs';
import {pilotCatalog,importPilot,withdrawPilot} from '../src/question-bank-expansion.mjs';
import {checkPilotQuestion} from '../src/subject-pilot-validation.mjs';
test('original pilot is independently derived, scoped and never automatically student-ready',()=>{
 assert.equal(pilotCatalog.records.length,12);assert.equal(new Set(pilotCatalog.records.flatMap(r=>r.question.knowledgeIds)).size,4);
 for(const r of pilotCatalog.records){const q=r.question;assert.equal(checkPilotQuestion(q).status,'passed');assert.equal(checkPilotQuestion({...q,correctOption:(q.correctOption+1)%4}).status,'quarantined');assert.equal(r.validation.status,'needs_review');assert.equal(r.validation.humanReview,false);assert.equal(q.license,'platform-internal-use');assert.equal(q.grade,q.subject==='physics'?8:7);assert(q.textbookScope.includes('待本机构教师核定'));assert(q.sourceReferences.every(x=>x.url.startsWith('https://')));}
});
test('two original subject batches add teacher candidates with references but no automatic grades or reviews',async()=>{const f=await fixture();try{
 await importBank(f.DB,f.org);const result=await importPilot(f.DB,f.org);assert.equal(result.imported,12);assert.equal((await importPilot(f.DB,f.org)).skipped,12);
 const t=await f.login('teacher'),s=await f.login('student'),parent=await f.login('parent');const physics=await f.request('/bank/questions?subject=physics&grade=8',{client:t});assert.equal(physics.data.total,6);assert(physics.data.items.every(q=>q.reviewStatus==='pending_human'&&q.state==='pending'));
 assert.equal((await f.request('/bank/practice',{client:s})).data.length,4);assert.equal((await f.request('/bank/questions?subject=physics',{client:parent})).status,403);
 const count=(await f.request('/public/coverage')).data.totals;assert.equal(count.questionCount,348);assert.equal(count.knowledgeCount,116);assert.equal(count.reviewedCount,0);assert.equal(count.studentPracticeCount,4);
 assert.equal(f.DB.sqlite.prepare('SELECT count(*) n FROM content_reviews').get().n,0);assert.equal(f.DB.sqlite.prepare('SELECT count(*) n FROM attempts').get().n,0);
 const q=physics.data.items[0];const edited=await f.request('/bank/questions/'+q.id,{client:t,method:'PATCH',body:{revision:q.revision,knowledgeIds:q.knowledgeIds,note:'合成测试核定原有关联知识点'}});assert.equal(edited.status,200);assert.equal(edited.data.validation.issues.includes('RIGHTS_UNCLEAR'),false);
}finally{f.close();}});
test('pilot rollback withdraws untouched originals, preserving teacher edits and immutable history',async()=>{const f=await fixture();try{
 await importPilot(f.DB,f.org);const t=await f.login('teacher'),q=pilotCatalog.records[0].question;await f.request('/bank/questions/'+q.id,{client:t,method:'PATCH',body:{revision:1,rationale:'合成老师修订内容，回滚批次不能覆盖。',note:'合成教师个别处理'}});
 const result=await withdrawPilot(f.DB,f.org,'pilot-physics-20261114-v1');assert.equal(result.withdrawn,5);assert.deepEqual(result.conflicts,[q.id]);assert.equal(f.DB.sqlite.prepare('SELECT count(*) n FROM bank_heads').get().n,12);assert.equal(f.DB.sqlite.prepare("SELECT count(*) n FROM bank_versions WHERE action='pilot_batch_withdrawal'").get().n,5);
}finally{f.close();}});
test('packaged pilot import is administrator-only and tenant scoped',async()=>{const f=await fixture();try{const t=await f.login('teacher'),a=await f.login('admin');const body={batchId:'pilot-physics-20261114-v1'};assert.equal((await f.request('/bank/imports',{client:t,method:'POST',body})).status,403);assert.equal((await f.request('/bank/imports',{client:a,method:'POST',body})).data.imported,6);assert.equal(f.DB.sqlite.prepare('SELECT count(*) n FROM bank_heads WHERE org_id=?').get(f.otherOrg).n,0);}finally{f.close();}});
