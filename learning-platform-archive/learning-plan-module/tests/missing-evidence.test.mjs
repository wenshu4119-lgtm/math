import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {missingEvidenceScenario} from './evidence-scenarios.mjs';

test('missing diagnostic question rejects creation and cannot become a zero-score category',async()=>{
  const f=await fixture();try{
    const teacher=await f.login('teacher'),student=await f.login('student');await f.review(teacher);
    // Fault injection into this in-memory fixture only; no real bank is modified.
    f.DB.sqlite.prepare("DELETE FROM questions WHERE id='math-fraction-diagnostic'").run();
    const rejected=await f.request('/attempts',{client:student,method:'POST',body:{studentId:student.id,subject:'math',phase:'diagnostic'}});
    assert.equal(rejected.status,409);assert.equal(rejected.error.code,'CONTENT_INCOMPLETE');
    const g=(await f.request(`/students/${student.id}/growth`,{client:student})).data;
    assert.deepEqual(g.evidence,[]);assert.deepEqual(g.topicEvidence,[]);assert.deepEqual(g.comparisons,[]);
    assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM attempts').get().n,0);
  }finally{f.close();}
});

test('sparse topic evidence omits unsubmitted and out-of-scope phases while preserving real zero',async()=>{
  const f=await fixture();try{
    const teacher=await f.login('teacher'),student=await f.login('student');const s=await missingEvidenceScenario(f,{teacher,student});
    assert.equal(s.knowledge.length,4);assert.equal(s.englishOpen.result,null);assert.equal(s.englishOpen.status,'open');
    assert.deepEqual(s.growth.topicEvidence.map(r=>[r.knowledgeId,r.phase,r.answered,r.correct]),[
      ['math-equation','diagnostic',1,0],['math-equation','practice',1,0],['math-fraction','diagnostic',1,1]
    ]);
    assert(s.growth.topicEvidence.every(r=>r.answered>0&&Number.isFinite(r.correct/r.answered)));
    assert(!s.growth.topicEvidence.some(r=>r.knowledgeId.startsWith('english-')));
    assert(!s.growth.topicEvidence.some(r=>r.knowledgeId==='math-fraction'&&r.phase==='practice'));
    assert.deepEqual(s.pack.weakKnowledgeIds,['math-equation']);assert.deepEqual(s.pack.knowledgeIds,['math-equation']);
    assert.deepEqual(s.practice.result,{correct:0,total:1});assert.equal(s.growth.evidence.length,2);assert.deepEqual(s.growth.comparisons,[]);
    assert.match(s.growth.notice,/未覆盖，不代表0分/);
  }finally{f.close();}
});

test('unconfirmed missing points stay null and confirmed zero has a positive denominator with no invented groups',async()=>{
  const f=await fixture();try{
    const teacher=await f.login('teacher'),student=await f.login('student');const s=await missingEvidenceScenario(f,{teacher,student});
    assert.equal(s.unknownDraft.report,null);assert.equal(s.unknownDraft.items[0].earnedScore,0);assert.equal(s.unknownDraft.items[1].earnedScore,null);assert.equal(s.unknownDraft.items[1].maxScore,null);
    assert.deepEqual(s.zeroReport.report.score,{max:4,earned:0,percent:0});assert.equal(s.zeroReport.report.byScope.length,1);assert.equal(s.zeroReport.report.byScope[0].knowledgeId,'math-equation');assert.deepEqual(s.zeroReport.report.byScope[0].score,{max:4,earned:0,percent:0});
    assert.equal(s.growth.paperEvidence.length,1);assert.equal(s.growth.paperEvidence[0].score.earned,0);
    const zeroMax=await f.request(`/papers/${s.unknownDraft.id}`,{client:teacher,method:'PATCH',body:{revision:s.unknownDraft.revision,title:s.unknownDraft.title,items:[{questionNo:'1',prompt:'Zero denominator must be rejected',qtype:'solution',mappingLevel:'knowledge',knowledgeId:'math-equation',maxScore:0,earnedScore:0,reviewed:true}]}});
    assert.equal(zeroMax.error.code,'INVALID_SCORE');assert.equal((await f.request(`/papers/${s.unknownDraft.id}/report`,{client:teacher})).error.code,'PAPER_NOT_CONFIRMED');
  }finally{f.close();}
});
