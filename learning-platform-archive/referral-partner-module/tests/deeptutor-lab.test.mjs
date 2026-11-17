import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {authenticate,checkOrigin,id,randomToken} from '../src/security.mjs';
import {deepTutorRoutes,publicDeepTutorStatus} from '../src/deeptutor-api.mjs';

const contract='deeptutor-synthetic-lab-v1';
const configured=env=>Object.assign(env,{DEEPTUTOR_LAB_ENABLED:'true',DEEPTUTOR_LAB_ORIGIN:'http://127.0.0.1:18083',DEEPTUTOR_LAB_TOKEN:randomToken()});
const json=v=>Response.json(v);
async function setup(){
 const f=await fixture();configured(f.env);const teacher=await f.login('teacher');
 const call=async(path,{client=teacher,method='GET',body,fetcher=async()=>{throw Error('unexpected provider request')}}={})=>{
  const req=new Request(f.env.APP_ORIGIN+'/api/v1'+path,{method,headers:{...(client?{Cookie:client.cookie,'X-CSRF-Token':client.csrfToken}:{}),'Content-Type':'application/json',Origin:f.env.APP_ORIGIN},...(body?{body:JSON.stringify(body)}:{})});
  try{if(method!=='GET')checkOrigin(req,f.env);const {user}=await authenticate(req,f.env);const result=await deepTutorRoutes(req,f.env,path,user,new URL(req.url),{fetcher});return {status:result?.status||200,data:result?.data};}catch(e){return {status:e.status||500,code:e.code};}
 };
 return {...f,teacher,call};
}
const accept=async(url,init)=>{const body=JSON.parse(init.body);return json({jobId:body.jobId,state:'running'});};
function answer(preset='english-be',value='is') {return {contract,preset,syntheticOnly:true,teacherReviewed:false,gradingAllowed:false,modelCalls:1,citations:[],outcome:'answered',answer:value,explanation:'Use is with she.',automaticCheck:'passed_for_fixed_example'};}

test('real API routing preserves authentication, CSRF and the public status boundary',async()=>{const f=await fixture();try{
 assert.equal((await f.request('/public/ai-status')).data.status,'unavailable');
 assert.equal((await f.request('/ai-lab/status')).status,401);
 for(const name of ['student','parent','admin'])assert.equal((await f.request('/ai-lab/status',{client:await f.login(name)})).status,403);
 const teacher=await f.login('teacher');
 assert.equal((await f.request('/ai-lab/status',{client:teacher})).data.status,'unavailable');
 assert.equal((await f.request('/ai-lab/jobs',{client:teacher,method:'POST',body:{requestId:id(),preset:'english-be'},headers:{'X-CSRF-Token':'invalid'}})).status,403);
 assert.equal((await f.request('/ai-lab/jobs',{client:teacher,method:'POST',body:{requestId:id(),preset:'english-be'}})).status,503);
}finally{f.close();}});

test('public state is unavailable unless a private bridge actually reports ready',async()=>{
 assert.equal((await publicDeepTutorStatus({})).status,'unavailable');let calls=0;
 const env=configured({});const state=await publicDeepTutorStatus(env,{fetcher:async()=>{calls++;return json({contract,status:'ready',syntheticOnly:true,generation:false,grading:false,token:'not echoed'});}});
 assert.equal(calls,1);assert.equal(state.status,'limited');assert.equal(state.capabilities.grading,false);assert.equal(JSON.stringify(state).includes('127.0.0.1'),false);assert.equal(JSON.stringify(state).includes(env.DEEPTUTOR_LAB_TOKEN),false);
 assert.equal((await publicDeepTutorStatus({...env},{fetcher:async()=>{calls++;throw Error('cached probe must not run')}})).status,'limited');assert.equal(calls,1);
 assert.equal((await publicDeepTutorStatus({...env,DEEPTUTOR_LAB_ORIGIN:'https://unapproved.example'},{fetcher:async()=>{throw Error('must not call')}})).status,'unavailable');
});
test('anonymous, students, parents and admins cannot invoke the teacher lab',async()=>{const f=await setup();try{
 assert.equal((await f.call('/ai-lab/status',{client:null})).status,401);
 for(const name of ['student','parent','admin'])assert.equal((await f.call('/ai-lab/status',{client:await f.login(name)})).status,403);
}finally{f.close();}});
test('free text, student IDs, unknown presets and URL inputs are rejected before provider calls',async()=>{const f=await setup();try{
 for(const body of [{requestId:id(),preset:'english-be',studentId:f.users.student.id},{requestId:id(),preset:'english-be',question:'private text'},{requestId:id(),preset:'new-topic'},{requestId:id(),preset:'english-be',url:'http://localhost'}])assert.equal((await f.call('/ai-lab/jobs',{method:'POST',body})).status,400);
 assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM deeptutor_lab_jobs').get().n,0);
}finally{f.close();}});
test('provider payload contains only a random job ID and preset, never actor or student data',async()=>{const f=await setup();try{
 const result=await f.call('/ai-lab/jobs',{method:'POST',body:{requestId:id(),preset:'english-be'},fetcher:async(url,init)=>{assert.equal(url,'http://127.0.0.1:18083/jobs');assert.deepEqual(Object.keys(JSON.parse(init.body)).sort(),['jobId','preset']);assert.equal(init.body.includes(f.teacher.id),false);return accept(url,init);}});
 assert.equal(result.status,202);assert.equal(result.data.state,'running');
 assert.equal(f.DB.sqlite.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='deeptutor_lab_requested'").get().n,1);
}finally{f.close();}});
test('repeating a request does not execute the model again and changed intent conflicts',async()=>{const f=await setup();try{
 const requestId=id();let calls=0;const options={method:'POST',body:{requestId,preset:'english-be'},fetcher:async(...args)=>{calls++;return accept(...args);}};
 const first=await f.call('/ai-lab/jobs',options),again=await f.call('/ai-lab/jobs',options);
 assert.equal(first.data.id,again.data.id);assert.equal(calls,1);
 assert.equal((await f.call('/ai-lab/jobs',{...options,body:{requestId,preset:'math-equation'}})).status,409);
}finally{f.close();}});
test('other teachers cannot inspect an owned job',async()=>{const f=await setup();try{
 const job=await f.call('/ai-lab/jobs',{method:'POST',body:{requestId:id(),preset:'english-be'},fetcher:accept});
 assert.equal((await f.call('/ai-lab/jobs/'+job.data.id,{client:await f.login('teacher2')})).status,404);
}finally{f.close();}});
test('the previous wrong She/am answer is blocked independently of provider success claims',async()=>{const f=await setup();try{
 const job=await f.call('/ai-lab/jobs',{method:'POST',body:{requestId:id(),preset:'english-be'},fetcher:accept});
 const result=await f.call('/ai-lab/jobs/'+job.data.id,{fetcher:async()=>json({jobId:job.data.id,preset:'english-be',state:'completed',result:answer('english-be','am')})});
 assert.equal(result.data.state,'failed');assert.equal(result.data.result.code,'ANSWER_KEY_CONFLICT');assert.equal(JSON.stringify(result.data).includes('Use is with she.'),false);
 assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM attempts').get().n,0);
}finally{f.close();}});
test('valid fixed answer remains explicitly unreviewed and cannot enable scoring',async()=>{const f=await setup();try{
 const job=await f.call('/ai-lab/jobs',{method:'POST',body:{requestId:id(),preset:'english-be'},fetcher:accept});
 const result=await f.call('/ai-lab/jobs/'+job.data.id,{fetcher:async()=>json({jobId:job.data.id,preset:'english-be',state:'completed',result:answer()})});
 assert.equal(result.data.state,'completed');assert.equal(result.data.result.teacherReviewed,false);assert.equal(result.data.result.gradingAllowed,false);
 assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM question_drafts').get().n,0);
}finally{f.close();}});
test('outside-scope output cannot report model calls or an answer',async()=>{const f=await setup();try{
 const job=await f.call('/ai-lab/jobs',{method:'POST',body:{requestId:id(),preset:'outside-scope'},fetcher:accept});
 const result=await f.call('/ai-lab/jobs/'+job.data.id,{fetcher:async()=>json({jobId:job.data.id,preset:'outside-scope',state:'completed',result:{...answer('outside-scope'),outcome:'no_match',answer:null}})});
 assert.equal(result.data.result.code,'DEEPTUTOR_SCOPE_VIOLATION');
}finally{f.close();}});
test('service outage produces explicit failed state, no synthetic success or automatic retry',async()=>{const f=await setup();try{
 const requestId=id(),result=await f.call('/ai-lab/jobs',{method:'POST',body:{requestId,preset:'english-be'},fetcher:async()=>{throw Error('network down')}});
 assert.equal(result.data.state,'failed');assert.equal(result.data.result.outcome,'failed');
 const again=await f.call('/ai-lab/jobs',{method:'POST',body:{requestId,preset:'english-be'}});assert.equal(again.data.state,'failed');
}finally{f.close();}});
test('revoking a session while the bridge is returning prevents result exposure and writes',async()=>{const f=await setup();try{
 const job=await f.call('/ai-lab/jobs',{method:'POST',body:{requestId:id(),preset:'english-be'},fetcher:accept});
 const result=await f.call('/ai-lab/jobs/'+job.data.id,{fetcher:async()=>{f.DB.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(f.teacher.id);return json({jobId:job.data.id,preset:'english-be',state:'completed',result:answer()});}});
 assert.equal(result.status,404);assert.equal(f.DB.sqlite.prepare('SELECT result_json FROM deeptutor_lab_jobs WHERE id=?').get(job.data.id).result_json,null);
}finally{f.close();}});
test('revoking the teacher role while checking status clears authorization',async()=>{const f=await setup();try{
 const result=await f.call('/ai-lab/status',{fetcher:async()=>{f.DB.sqlite.prepare("UPDATE users SET role='student' WHERE id=?").run(f.teacher.id);return json({contract,status:'ready',syntheticOnly:true,generation:false,grading:false});}});
 assert.equal(result.status,404);
}finally{f.close();}});
