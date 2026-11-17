import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {authenticate,checkOrigin,id,randomToken} from '../src/security.mjs';
import {learningQaRoutes,publicLearningQaStatus} from '../src/learning-qa.mjs';
import sources from '../integrations/learning-qa/sources.json' with {type:'json'};
const contract='learning-qa-original-v1',json=v=>Response.json(v);
const enabled=env=>Object.assign(env,{LEARNING_QA_ENABLED:'true',LEARNING_QA_ORIGIN:'http://127.0.0.1:18084',LEARNING_QA_TOKEN:randomToken()});
const body=()=>({requestId:id(),subject:'math',question:'为什么等式两边需要同时减去相同的数？',noPersonalDataConfirmed:true});
const accept=async(url,options)=>{const b=JSON.parse(options.body);return json({jobId:b.jobId,state:'running'});};
function output(){const source=sources.sources.find(s=>s.id==='math-equality.txt');return {contract,subject:'math',teacherReviewed:false,gradingAllowed:false,modelCalls:1,outcome:'needs_verification',answer:'等式两边同时减去同一个数，仍保持相等。请结合来源核对。',automaticCheck:'source_bound_not_semantically_proven',citations:[{sourceId:source.id,digest:source.digest,quote:source.text.slice(0,150),nativePageCitation:false}]};}
test('real API wiring retains origin, CSRF and role boundaries',async()=>{const f=await fixture();try{
 assert.equal((await f.request('/public/learning-qa-status')).data.status,'unavailable');assert.equal((await f.request('/learning-qa/status')).status,401);
 const student=await f.login('student');assert.equal((await f.request('/learning-qa/status',{client:student})).status,200);
 for(const name of ['parent','admin'])assert.equal((await f.request('/learning-qa/status',{client:await f.login(name)})).status,403);
 assert.equal((await f.request('/learning-qa/jobs',{client:student,method:'POST',body:body(),headers:{'X-CSRF-Token':'bad'}})).status,403);
 assert.equal((await f.request('/learning-qa/jobs',{client:student,method:'POST',body:body(),headers:{Origin:'https://other.example'}})).status,403);
}finally{f.close();}});
async function setup(){const f=await fixture();enabled(f.env);const teacher=await f.login('teacher'),student=await f.login('student');
 const call=async(path,{client=teacher,method='GET',body:payload,fetcher=async()=>{throw Error('unexpected provider')}}={})=>{
  const req=new Request(f.env.APP_ORIGIN+'/api/v1'+path,{method,headers:{...(client?{Cookie:client.cookie,'X-CSRF-Token':client.csrfToken}:{}),Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});
  try{if(method!=='GET')checkOrigin(req,f.env);const {user}=await authenticate(req,f.env);const r=await learningQaRoutes(req,f.env,path,user,new URL(req.url),{fetcher});return {status:r?.status||200,data:r?.data};}catch(e){return {status:e.status||500,code:e.code};}
 };return {...f,teacher,student,call};}

test('public status is real readiness only and cached across per-request env copies',async()=>{let calls=0;const env=enabled({}),fetcher=async()=>{calls++;return json({contract,status:'ready',freeInput:true,grading:false,ttlSeconds:1800});};
 assert.equal((await publicLearningQaStatus(env,{fetcher})).status,'limited');assert.equal((await publicLearningQaStatus({...env},{fetcher})).status,'limited');assert.equal(calls,1);
 assert.equal((await publicLearningQaStatus({...env,LEARNING_QA_ENABLED:'false'})).status,'unavailable');assert.equal((await publicLearningQaStatus({...env,LEARNING_QA_ORIGIN:'https://external.example'},{fetcher})).status,'unavailable');assert.equal(calls,1);
});
test('anonymous, parents and admins cannot use learner QA',async()=>{const f=await setup();try{
 assert.equal((await f.call('/learning-qa/status',{client:null})).status,401);
 for(const name of ['parent','admin'])assert.equal((await f.call('/learning-qa/status',{client:await f.login(name)})).status,403);
}finally{f.close();}});
test('student and teacher submit genuine free text while provider receives no identities',async()=>{const f=await setup();try{
 for(const client of [f.teacher,f.student]){const question=body();const r=await f.call('/learning-qa/jobs',{client,method:'POST',body:question,fetcher:async(url,init)=>{const value=JSON.parse(init.body);assert.deepEqual(Object.keys(value).sort(),['jobId','question','subject']);assert.equal(value.question,question.question.normalize('NFKC').trim());assert.equal(init.body.includes(f.users.student.id),false);return accept(url,init);}});assert.equal(r.status,202);}
}finally{f.close();}});
test('personal data, missing confirmation, arbitrary URLs and identity fields are rejected before storage',async()=>{const f=await setup();try{
 for(const payload of [{...body(),question:'我叫张三，手机号13800000000，请解释方程。'},{...body(),question:'Explain be to learner@example.com'},{...body(),noPersonalDataConfirmed:false},{...body(),studentId:f.student.id},{...body(),sourceIds:['private-source']},{...body(),url:'http://localhost'}])assert.equal((await f.call('/learning-qa/jobs',{method:'POST',body:payload})).status,400);
 assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM learning_qa_jobs').get().n,0);
}finally{f.close();}});
test('database stores HMAC metadata and never the free question or generated answer',async()=>{const f=await setup();try{
 const payload=body(),job=await f.call('/learning-qa/jobs',{method:'POST',body:payload,fetcher:accept});
 const done=await f.call('/learning-qa/jobs/'+job.data.id,{fetcher:async()=>json({jobId:job.data.id,subject:'math',state:'completed',result:output()})});assert.equal(done.data.result.outcome,'needs_verification');
 const row=f.DB.sqlite.prepare('SELECT * FROM learning_qa_jobs WHERE id=?').get(job.data.id),serialized=JSON.stringify(row);assert.equal(serialized.includes(payload.question),false);assert.equal(serialized.includes(output().answer),false);assert.match(row.question_digest,/^[0-9a-f]{64}$/);assert.match(row.result_digest,/^[0-9a-f]{64}$/);
 for(const table of ['attempts','answers','content_reviews'])assert.equal(f.DB.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0);
}finally{f.close();}});
test('idempotent retries execute once and changed question conflicts',async()=>{const f=await setup();try{
 const payload=body();let n=0;const opts={method:'POST',body:payload,fetcher:async(...args)=>{n++;return accept(...args);}};
 const one=await f.call('/learning-qa/jobs',opts),two=await f.call('/learning-qa/jobs',opts);assert.equal(one.data.id,two.data.id);assert.equal(n,1);
 assert.equal((await f.call('/learning-qa/jobs',{...opts,body:{...payload,question:'分数相加为什么需要通分？'}})).status,409);
}finally{f.close();}});
test('lost POST response can recover a completed job by GET without a second model request',async()=>{const f=await setup();try{
 const payload=body();let calls=0;const start={method:'POST',body:payload,fetcher:async(...args)=>{calls++;return accept(...args);}};
 const first=await f.call('/learning-qa/jobs',start),path='/learning-qa/jobs/'+first.data.id;
 const fetched=()=>json({jobId:first.data.id,subject:'math',state:'completed',result:output()});await f.call(path,{fetcher:async()=>fetched()});
 const retry=await f.call('/learning-qa/jobs',start);assert.equal(retry.data.state,'completed');assert.equal(retry.data.result,null);
 assert.equal((await f.call(path,{fetcher:async()=>fetched()})).data.result.answer,output().answer);assert.equal(calls,1);
}finally{f.close();}});
test('ownership blocks another student, teacher and another organization',async()=>{const f=await setup();try{
 const job=await f.call('/learning-qa/jobs',{client:f.student,method:'POST',body:body(),fetcher:accept});
 for(const client of [f.teacher,await f.login('student2'),await f.login('teacher2'),await f.login('foreignStudent')])assert.equal((await f.call('/learning-qa/jobs/'+job.data.id,{client})).status,404);
}finally{f.close();}});
test('TTL expires access without calling the bridge',async()=>{const f=await setup();try{
 const job=await f.call('/learning-qa/jobs',{method:'POST',body:body(),fetcher:accept});f.DB.sqlite.prepare('UPDATE learning_qa_jobs SET expires_at=0 WHERE id=?').run(job.data.id);
 assert.equal((await f.call('/learning-qa/jobs/'+job.data.id)).status,410);assert.equal(f.DB.sqlite.prepare('SELECT state FROM learning_qa_jobs WHERE id=?').get(job.data.id).state,'expired');
}finally{f.close();}});
test('forged source citations and claims of teacher review never reach the learner',async()=>{const f=await setup();try{
 for(const changed of [{...output(),teacherReviewed:true},{...output(),citations:[{...output().citations[0],quote:'invented quote not in original'}]},{...output(),gradingAllowed:true}]){
  const job=await f.call('/learning-qa/jobs',{method:'POST',body:body(),fetcher:accept});const result=await f.call('/learning-qa/jobs/'+job.data.id,{fetcher:async()=>json({jobId:job.data.id,subject:'math',state:'completed',result:changed})});assert.equal(result.data.state,'failed');assert.equal(result.data.result,null);
 }
}finally{f.close();}});
test('session revoked during result lookup prevents both disclosure and a successful state write',async()=>{const f=await setup();try{
 const job=await f.call('/learning-qa/jobs',{method:'POST',body:body(),fetcher:accept});const result=await f.call('/learning-qa/jobs/'+job.data.id,{fetcher:async()=>{f.DB.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(f.teacher.id);return json({jobId:job.data.id,subject:'math',state:'completed',result:output()});}});
 assert.equal(result.status,404);assert.equal(f.DB.sqlite.prepare('SELECT result_digest FROM learning_qa_jobs WHERE id=?').get(job.data.id).result_digest,null);
}finally{f.close();}});
test('switching off the feature stops new submissions and result transport',async()=>{const f=await setup();try{
 const job=await f.call('/learning-qa/jobs',{method:'POST',body:body(),fetcher:accept});f.env.LEARNING_QA_ENABLED='false';assert.equal((await f.call('/learning-qa/jobs',{method:'POST',body:body()})).status,503);
 const result=await f.call('/learning-qa/jobs/'+job.data.id);assert.equal(result.data.state,'failed');assert.equal(result.data.result,null);
}finally{f.close();}});
test('changed completed result is rejected and preserves the original digest',async()=>{const f=await setup();try{
 const job=await f.call('/learning-qa/jobs',{method:'POST',body:body(),fetcher:accept}),path='/learning-qa/jobs/'+job.data.id;
 await f.call(path,{fetcher:async()=>json({jobId:job.data.id,subject:'math',state:'completed',result:output()})});const original=f.DB.sqlite.prepare('SELECT result_digest FROM learning_qa_jobs WHERE id=?').get(job.data.id).result_digest;
 const changed=await f.call(path,{fetcher:async()=>json({jobId:job.data.id,subject:'math',state:'completed',result:{...output(),answer:'这段解释发生了未经确认的改变，请勿继续展示。'}})});assert.equal(changed.data.state,'failed');assert.equal(changed.data.result,null);assert.equal(f.DB.sqlite.prepare('SELECT result_digest FROM learning_qa_jobs WHERE id=?').get(job.data.id).result_digest,original);
}finally{f.close();}});
test('per-user request budget prevents unbounded local model load',async()=>{const f=await setup();try{
 for(let i=0;i<8;i++)assert.equal((await f.call('/learning-qa/jobs',{method:'POST',body:body(),fetcher:accept})).status,202);
 assert.equal((await f.call('/learning-qa/jobs',{method:'POST',body:body()})).status,429);
}finally{f.close();}});
