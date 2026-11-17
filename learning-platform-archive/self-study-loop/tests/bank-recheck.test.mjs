import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {bankCatalog,importBank} from '../src/question-bank-import.mjs';
import {sha} from '../src/question-bank-validation.mjs';
import {applyRecheckBatch,rollbackRecheckBatch} from '../src/question-bank-recheck.mjs';
function proposal(record){const content=structuredClone(record.question);return {questionId:content.id,sourceContentHash:sha(record.question),expectedRevision:1,decision:'passed',humanReview:false,independentAnswer:{optionIndexes:[content.correctOption],answerText:content.options[content.correctOption],method:'fixture_prior_independent_arithmetic',reason:'Synthetic fixture reuses a genuinely separately derived arithmetic proof.'},evidence:{syntheticTest:true},proposal:{expectedContentHash:sha(record.question),expectedRevision:1,content,contentHash:sha(content),state:'available',validation:{...record.validation,humanReview:false},reason:'Synthetic batch lifecycle fixture, not a teacher review.'}};}
const first=bankCatalog.records.find(r=>r.validation.status==='passed');
const batch=()=>({id:'synthetic-recheck-v2',subject:'math',grade:7,checker:'test-only',records:[proposal(first)]});
test('automated recheck is versioned and idempotent, cannot create teacher review or old grades',async()=>{const f=await fixture();try{
 await importBank(f.DB,f.org);const result=await applyRecheckBatch(f.DB,f.org,batch());assert.equal(result.applied,1);assert.equal((await applyRecheckBatch(f.DB,f.org,batch())).idempotent,true);
 const rows=f.DB.sqlite.prepare('SELECT * FROM bank_versions WHERE question_id=? ORDER BY revision').all(first.question.id);assert.equal(rows.length,2);assert.equal(rows[1].reviewed_by,null);assert.equal(rows[1].actor_id,null);assert.equal(rows[1].action,'automated_recheck:synthetic-recheck-v2');
 assert.equal(f.DB.sqlite.prepare('SELECT count(*) n FROM content_reviews').get().n,0);assert.equal(f.DB.sqlite.prepare('SELECT count(*) n FROM attempts').get().n,0);assert.equal(f.DB.sqlite.prepare('SELECT count(*) n FROM questions').get().n,12);
 const bad=batch();bad.records[0].proposal.reason+=' changed';await assert.rejects(()=>applyRecheckBatch(f.DB,f.org,bad),/different content/);
}finally{f.close();}});
test('teacher change during batch assembly is preserved and reported as a conflict',async()=>{const f=await fixture();try{
 await importBank(f.DB,f.org);const t=await f.login('teacher'),original=f.DB.batch;let injected=false;
 f.DB.batch=async statements=>{if(!injected){injected=true;const r=await f.request('/bank/questions/'+first.question.id,{client:t,method:'PATCH',body:{revision:1,rationale:'教师新版本内容，不能被批量核验覆盖。',note:'合成测试并发修订'}});assert.equal(r.status,200);}return original(statements);};
 const result=await applyRecheckBatch(f.DB,f.org,batch());assert.equal(result.applied,0);assert.deepEqual(result.conflicts,[first.question.id]);
 const latest=f.DB.sqlite.prepare('SELECT * FROM bank_versions WHERE question_id=? ORDER BY revision DESC LIMIT 1').get(first.question.id);assert.equal(latest.action,'edit');assert.match(latest.content_json,/教师新版本/);
}finally{f.close();}});
test('rollback appends the original state and preserves old versions, but never rolls back later teacher work',async()=>{const f=await fixture();try{
 await importBank(f.DB,f.org);await applyRecheckBatch(f.DB,f.org,batch());const reverted=await rollbackRecheckBatch(f.DB,f.org,'synthetic-recheck-v2');assert.equal(reverted.rolledBack,1);
 const history=f.DB.sqlite.prepare('SELECT * FROM bank_versions WHERE question_id=? ORDER BY revision').all(first.question.id);assert.equal(history.length,3);assert.equal(history[0].content_hash,history[2].content_hash);assert.equal(history[2].reviewed_by,null);assert.equal((await rollbackRecheckBatch(f.DB,f.org,'synthetic-recheck-v2')).rolledBack,1);
 const second=bankCatalog.records.filter(r=>r.validation.status==='passed')[1],b={...batch(),id:'another-synthetic-recheck',records:[proposal(second)]};await applyRecheckBatch(f.DB,f.org,b);const t=await f.login('teacher');await f.request('/bank/questions/'+second.question.id,{client:t,method:'PATCH',body:{revision:2,rationale:'必须保留的后续教师修改。',note:'合成测试后续教师操作'}});const protectedResult=await rollbackRecheckBatch(f.DB,f.org,b.id);assert.deepEqual(protectedResult.conflicts,[second.question.id]);assert.equal(protectedResult.rolledBack,0);
}finally{f.close();}});
test('batch guard refuses fabricated review, invalid proof, digest substitution, and foreign institution writes',async()=>{const f=await fixture();try{
 await importBank(f.DB,f.org);for(const mutate of [b=>b.records[0].humanReview=true,b=>b.records[0].proposal.content.reviewStatus='human_reviewed',b=>b.records[0].independentAnswer.optionIndexes=[],b=>b.records[0].proposal.content.prompt='replacement without matching digest']){const b=batch();mutate(b);await assert.rejects(()=>applyRecheckBatch(f.DB,f.org,b));}
 const other=await applyRecheckBatch(f.DB,f.otherOrg,batch());assert.equal(other.applied,0);assert.equal(f.DB.sqlite.prepare('SELECT count(*) n FROM bank_versions WHERE org_id=?').get(f.otherOrg).n,0);
}finally{f.close();}});
