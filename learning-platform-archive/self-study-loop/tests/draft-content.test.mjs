import test from 'node:test';
import assert from 'node:assert/strict';
import {draftFixture,sourceBody,sampleQuestion,checks,contractServer,respond} from './draft-fixture.mjs';

test('draft resources are teacher-owner/org scoped, not exposed to other roles or bound colleagues',async()=>{
  const f=await draftFixture();try{const d=(await f.create()).data;
    for(const name of ['student','parent','admin','foreignStudent']){const c=await f.login(name);for(const path of ['/draft-provider','/draft-sources',`/draft-sources/${f.source.id}`,'/question-drafts',`/question-drafts/${d.id}`,`/draft-exports?kind=question-draft&id=${d.id}`])assert.equal((await f.request(path,{client:c})).status,403,name+path);}
    const t2=await f.login('teacher2');for(const path of [`/draft-sources/${f.source.id}`,`/question-drafts/${d.id}`,`/draft-exports?kind=question-draft&id=${d.id}`])assert.equal((await f.request(path,{client:t2})).status,404);assert.deepEqual((await f.request('/question-drafts',{client:t2})).data,[]);
    f.DB.sqlite.prepare('UPDATE users SET org_id=? WHERE id=?').run(f.otherOrg,f.teacher.id);assert.equal((await f.request(`/question-drafts/${d.id}`,{client:f.teacher})).status,404);
  }finally{f.close();}
});
test('draft writes retain CSRF, origin, authentication, strict body and synthetic-source boundaries',async()=>{
  const f=await draftFixture();try{
    for(const [opts,status]of [[{headers:{'X-CSRF-Token':'bad'}},403],[{headers:{Origin:'https://other.invalid'}},403],[{client:null},401],[{body:sourceBody({syntheticOnly:false})},400],[{body:sourceBody({rightsConfirmed:false})},400],[{body:sourceBody({studentId:f.users.student.id})},400],[{body:sourceBody({text:'x'.repeat(12001)})},400]])assert.equal((await f.request('/draft-sources',{client:f.teacher,method:'POST',body:sourceBody(),...opts})).status,status);
    assert.equal((await f.request('/draft-sources?orgId=anything',{client:f.teacher})).status,400);
    assert.equal((await f.create({published:true})).status,400);
  }finally{f.close();}
});
test('source create is idempotent, immutable and provenance has no fabricated rights verification',async()=>{
  const f=await draftFixture();try{const body=sourceBody(),first=await f.request('/draft-sources',{client:f.teacher,method:'POST',body}),again=await f.request('/draft-sources',{client:f.teacher,method:'POST',body});assert.equal(first.status,201);assert.equal(again.status,200);assert.equal(first.data.id,again.data.id);assert.equal(first.data.version,1);assert.equal(first.data.rightsVerified,false);
    assert.equal((await f.request('/draft-sources',{client:f.teacher,method:'POST',body:{...body,text:'changed'}})).status,409);assert.equal((await f.request(`/draft-sources/${first.data.id}`,{client:f.teacher,method:'PATCH',body:{text:'changed'}})).status,404);
  }finally{f.close();}
});
test('manual candidate validates exact citations, phase, grade, duplicate choices and client score injection',async()=>{
  const f=await draftFixture();try{const q=f.body.questions[0];for(const changed of [{...q,grade:10},{...q,phase:'screening'},{...q,score:100},{...q,options:['1','1','2','3']},{...q,citations:[]},{...q,citations:[{...q.citations[0],text:'invented quote'}]},{...q,citations:[{...q.citations[0],digest:'wrong'}]},{...q,citations:[{...q.citations[0],sourceVersion:2}]}]){const r=await f.create({questions:[changed]});assert(r.status>=400,r.status);}
    assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM question_drafts').get().n,0);
    const saved=(await f.create()).data;assert.equal(saved.status,'pending_human');assert.equal(saved.validation.accuracyEvaluated,false);assert.equal(saved.published,false);
  }finally{f.close();}
});
test('draft idempotency, review checklist, immutable revisions and edit resets review without publication',async()=>{
  const f=await draftFixture();try{const d=(await f.create()).data;assert.equal((await f.create()).data.id,d.id);assert.equal((await f.create({title:'changed'})).status,409);
    const review={revision:d.revision,decision:'accept',note:'自动化测试合成复核，不能当真人审核。',confirmed:true,checks:checks(d.questions)};
    for(const bad of [{...review,confirmed:false},{...review,checks:[]},{...review,checks:[{...review.checks[0],answer:false}]}])assert.equal((await f.request(`/question-drafts/${d.id}/review`,{client:f.teacher,method:'POST',body:bad})).status,400);
    const approved=(await f.request(`/question-drafts/${d.id}/review`,{client:f.teacher,method:'POST',body:review})).data;assert.equal(approved.status,'accepted_isolated');assert.equal(approved.published,false);assert.equal(approved.review.reviewedRevision,1);assert.equal(approved.history.length,2);assert.equal(approved.validation.humanReview,false);
    const student=await f.login('student');assert.equal((await f.request('/attempts',{client:student,method:'POST',body:{studentId:student.id,subject:'math',phase:'diagnostic',knowledgeIds:[d.id]}})).status,400);
    assert.equal((await f.request(`/question-drafts/${d.id}/review`,{client:f.teacher,method:'POST',body:review})).status,409);
    const edited=await f.request(`/question-drafts/${d.id}`,{client:f.teacher,method:'PATCH',body:{revision:approved.revision,title:'修订候选',questions:[sampleQuestion(f.source,{rationale:'修改后的候选解析仍需逐题核对。'})]}});assert.equal(edited.status,200);assert.equal(edited.data.review,null);assert.equal(edited.data.status,'pending_human');assert.equal(edited.data.history[1].review.decision,'accept');assert.equal(edited.data.history[0].questions[0].rationale,d.questions[0].rationale);
    assert.equal((await f.request(`/question-drafts/${d.id}`,{client:f.teacher,method:'PATCH',body:{revision:1,title:'stale',questions:d.questions}})).status,409);
    for(const [table,count]of [['questions',12],['knowledge',4],['content_reviews',0],['attempts',0],['answers',0]])assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM '+table).get().n,count);
  }finally{f.close();}
});
test('teacher deactivation between validation and draft update cannot write revision or audit',async()=>{
  const f=await draftFixture();try{const d=(await f.create()).data;const original=f.DB.batch.bind(f.DB);let injected=false;f.DB.batch=async statements=>{if(!injected){injected=true;f.DB.sqlite.prepare('UPDATE users SET active=0 WHERE id=?').run(f.teacher.id);}return original(statements);};
    const r=await f.request(`/question-drafts/${d.id}`,{client:f.teacher,method:'PATCH',body:{revision:d.revision,title:'unauthorized',questions:d.questions}});assert.equal(r.status,404);assert.equal(f.DB.sqlite.prepare('SELECT revision FROM question_drafts').get().revision,1);assert.equal(f.DB.sqlite.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='question_draft_updated'").get().n,0);
  }finally{f.close();}
});
test('unconfigured generation saves explicit unavailable request, no candidates, no automatic retry',async()=>{
  const f=await draftFixture();try{assert.equal((await f.request('/draft-provider',{client:f.teacher})).data.available,false);const body={requestId:crypto.randomUUID(),title:'合成请求',subject:'math',sourceIds:[f.source.id],count:1,instructions:'只出合成分数题。',syntheticOnly:true};
    const r=await f.request('/question-drafts/generate',{client:f.teacher,method:'POST',body});assert.equal(r.status,201);assert.equal(r.data.status,'unavailable');assert.equal(r.data.errorCode,'NOT_CONFIGURED');assert.deepEqual(r.data.questions,[]);assert.equal(r.data.provenance.transportAttempted,false);
    const retry=await f.request('/question-drafts/generate',{client:f.teacher,method:'POST',body});assert.equal(retry.status,200);assert.equal(retry.data.id,r.data.id);assert.equal(retry.data.history.length,2);
  }finally{f.close();}
});
test('real loopback transport fixture is explicitly marked, concurrent idempotency calls upstream once',async()=>{
  const f=await draftFixture();let release;const hold=new Promise(r=>release=r);const bridge=await contractServer(async(_req,res)=>{await hold;respond(res,[sampleQuestion(f.source)]);});Object.assign(f.env,bridge.env);
  try{const body={requestId:crypto.randomUUID(),title:'传输替身测试',subject:'math',sourceIds:[f.source.id],count:1,instructions:'仅合成测试。',syntheticOnly:true};const first=f.request('/question-drafts/generate',{client:f.teacher,method:'POST',body});
    while(!bridge.requests.length)await new Promise(r=>setTimeout(r,5));const retry=await f.request('/question-drafts/generate',{client:f.teacher,method:'POST',body});assert.equal(retry.status,202);release();const result=await first;assert.equal(result.status,201);assert.equal(result.data.status,'pending_human');assert.equal(result.data.provenance.kind,'contract_fixture');assert.equal(result.data.provenance.modelExecution,'not_executed_test_fixture');assert.equal(bridge.requests.length,1);assert.equal(bridge.requests[0].body.gradingAllowed,false);assert.deepEqual(bridge.requests[0].body.tools,[]);assert(!JSON.stringify(bridge.requests[0].body).includes(f.users.student.id));
  }finally{release();await bridge.close();f.close();}
});
test('invalid generation citations fail closed, raw provider errors and credentials are not saved',async()=>{
  const f=await draftFixture();const bridge=await contractServer((_req,res)=>respond(res,[sampleQuestion(f.source,{citations:[{...sampleQuestion(f.source).citations[0],text:'fake'}]})]));Object.assign(f.env,bridge.env);
  try{const body={requestId:crypto.randomUUID(),title:'失败测试',subject:'math',sourceIds:[f.source.id],count:1,instructions:'合成测试。',syntheticOnly:true};const result=await f.request('/question-drafts/generate',{client:f.teacher,method:'POST',body});assert.equal(result.data.status,'failed');assert.equal(result.data.errorCode,'CANDIDATE_OUTPUT_INVALID');assert.equal(result.data.questions.length,0);assert.equal(result.data.provenance.transportAttempted,true);assert(!JSON.stringify(result).includes(bridge.env.DRAFT_PROVIDER_TOKEN));assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM questions').get().n,12);
  }finally{await bridge.close();f.close();}
});
test('authorized draft exports preserve JSON/CSV, formulas are escaped and empty documents explicit',async()=>{
  const f=await draftFixture();try{const d=(await f.create({title:'=FORMULA_TEST'})).data;for(const kind of ['draft-sources','draft-source','question-drafts','question-draft']){const key=kind==='draft-source'?f.source.id:d.id;const r=await f.request(`/draft-exports?kind=${kind}&id=${key}`,{client:f.teacher});assert.equal(r.status,200);assert.equal(r.data.empty,false);assert.equal(r.res.headers.get('X-Actor-Id'),f.teacher.id);assert(r.data.blocks.some(b=>b.type==='notice'));}
    const json=await f.request(`/draft-exports?kind=question-draft&id=${d.id}&format=json`,{client:f.teacher});assert.equal(json.data.records[0].published,false);
    const csv=await f.request(`/draft-exports?kind=question-draft&id=${d.id}&format=csv`,{client:f.teacher});assert.equal(csv.status,200);assert((await csv.res.text()).includes("'=FORMULA_TEST"));
    const other=await f.login('teacher2');const empty=await f.request('/draft-exports?kind=question-drafts',{client:other});assert.equal(empty.data.empty,true);
  }finally{f.close();}
});
