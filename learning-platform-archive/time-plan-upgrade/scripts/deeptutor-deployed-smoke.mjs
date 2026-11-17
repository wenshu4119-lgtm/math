// Run on the VPS from the deployed release. All accounts and records exist only in :memory:.
// Usage: node scripts/deeptutor-deployed-smoke.mjs /etc/learning-platform/runtime.json
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {handleApi} from '../src/api.mjs';
import {openDatabase,migrate} from './local-db.mjs';
import {id,now,randomToken,digest,hmac} from '../src/security.mjs';

const runtimePath=process.argv[2];
if(runtimePath!=='/etc/learning-platform/runtime.json')throw Error('The exact private production runtime path is required; no database file is opened.');
const runtime=JSON.parse(readFileSync(runtimePath,'utf8'));
const DB=openDatabase();migrate(DB);
const env={DB,APP_ENV:'local',APP_ORIGIN:'http://127.0.0.1:18983',SESSION_SECRET:randomToken(),DEEPTUTOR_LAB_ENABLED:runtime.DEEPTUTOR_LAB_ENABLED,DEEPTUTOR_LAB_ORIGIN:runtime.DEEPTUTOR_LAB_ORIGIN,DEEPTUTOR_LAB_TOKEN:runtime.DEEPTUTOR_LAB_TOKEN};
const org=id();DB.sqlite.prepare('INSERT INTO organizations VALUES (?,?)').run(org,'Synthetic in-memory DeepTutor acceptance');
const actors={};for(const name of ['teacher','teacher2','parent']){const uid=id(),token=randomToken();DB.sqlite.prepare('INSERT INTO users (id,org_id,username,display_name,role,password_hash,created_at) VALUES (?,?,?,?,?,?,?)').run(uid,org,'synthetic-'+name,name,name==='teacher2'?'teacher':name,'DISABLED-SYNTHETIC-LOGIN',now());DB.sqlite.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token),uid,Date.now()+600000);actors[name]={id:uid,token};}
async function request(path,{actor=actors.teacher,method='GET',body}={}){
 const headers={...(actor?{Cookie:'lp_session='+actor.token,'X-CSRF-Token':hmac(env.SESSION_SECRET,'csrf:'+actor.token)}:{}),Origin:env.APP_ORIGIN,'Content-Type':'application/json'};
 const response=await handleApi(new Request(env.APP_ORIGIN+'/api/v1'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),env);
 const value=await response.json();return {status:response.status,data:value.data,error:value.error};
}
try{
 assert.equal((await request('/ai-lab/status',{actor:null})).status,401);
 assert.equal((await request('/ai-lab/status',{actor:actors.parent})).status,403);
 const readiness=await request('/public/ai-status',{actor:null});assert.equal(readiness.status,200);assert.equal(readiness.data.status,'limited');
 console.log(JSON.stringify({stage:'boundary',anonymous:401,parent:403,publicStatus:'limited',database:':memory:',productionDatabaseOpened:false,syntheticOnly:true}));
 const results=[];
 for(const preset of ['math-equation','english-be','outside-scope']){
  const requestId=id(),created=await request('/ai-lab/jobs',{method:'POST',body:{requestId,preset}});
  assert.equal(created.status,202);assert.equal(created.data.state,'running');
  assert.equal((await request('/ai-lab/jobs/'+created.data.id,{actor:actors.teacher2})).status,404);
  const repeated=await request('/ai-lab/jobs',{method:'POST',body:{requestId,preset}});assert.equal(repeated.data.id,created.data.id);
  let final;const started=Date.now();
  while(Date.now()-started<210000){
   const result=await request('/ai-lab/jobs/'+created.data.id);assert.equal(result.status,200);
   if(['completed','failed'].includes(result.data.state)){final=result.data;break;}
   await new Promise(resolve=>setTimeout(resolve,2500));
  }
  assert.ok(final,'real job must reach terminal state');
  const summary={preset,state:final.state,outcome:final.result?.outcome,answer:final.result?.answer,modelCalls:final.result?.modelCalls,citations:final.result?.citations?.length,seconds:Math.round((Date.now()-started)/1000),teacherReviewed:final.result?.teacherReviewed,gradingAllowed:final.result?.gradingAllowed};
  results.push(summary);console.log(JSON.stringify({stage:'real-api-job',...summary}));
  assert.equal(final.state,'completed');
  assert.equal(final.result.gradingAllowed,false);assert.equal(final.result.teacherReviewed,false);
  if(preset==='outside-scope'){assert.equal(final.result.outcome,'no_match');assert.equal(final.result.modelCalls,0);}
  else{assert.ok(['answered','quarantined'].includes(final.result.outcome));if(final.result.outcome==='answered')assert.equal(final.result.answer.trim().toLowerCase(),preset==='math-equation'?'3':'is');}
 }
 for(const table of ['attempts','answers','content_reviews','question_drafts'])assert.equal(DB.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0);
 console.log(JSON.stringify({stage:'complete',realApi:true,realBridge:true,realModels:true,realStudents:false,productionWrites:0,automaticTeacherReviews:0,formalGrades:0,results}));
}finally{DB.sqlite.close();}
