// Automated browser contract tests with synthetic accounts. Fixture output is not model evidence.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {browserHarness} from '../tests/browser-harness.mjs';
import {randomToken} from '../src/security.mjs';
import {root} from './environment.mjs';

const checks=[],jobs=new Map(),token=randomToken();
const server=createServer(async(req,res)=>{
 if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(404);res.end();return;}
 let value;
 if(req.url==='/status')value={contract:'deeptutor-synthetic-lab-v1',status:'ready',syntheticOnly:true,generation:false,grading:false};
 else if(req.url==='/jobs'&&req.method==='POST'){
  const parts=[];for await(const part of req)parts.push(part);const body=JSON.parse(Buffer.concat(parts));jobs.set(body.jobId,body);value={jobId:body.jobId,state:'running'};
 }else if(req.url.startsWith('/jobs/')){
  const job=jobs.get(req.url.slice(6));const outside=job.preset==='outside-scope';value={...job,state:'completed',result:{contract:'deeptutor-synthetic-lab-v1',preset:job.preset,syntheticOnly:true,teacherReviewed:false,gradingAllowed:false,modelCalls:outside?0:1,citations:[],outcome:outside?'no_match':'answered',answer:outside?null:job.preset==='english-be'?'is':'3',explanation:'SYNTHETIC_CONTRACT_FIXTURE_EXPLANATION',automaticCheck:'passed_for_fixed_example'}};
 }else{res.writeHead(404);res.end();return;}
 res.writeHead(req.method==='POST'?202:200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(18083,'127.0.0.1',resolve);});
try{
 for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const f=await browserHarness();try{
   const context=await f.browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(f.origin+'/ai-lab.html');await page.getByRole('heading',{name:'当前无法继续'}).waitFor();assert.equal(await page.getByRole('button').count(),0);checks.push(`${name}: anonymous cannot run AI jobs`);
   async function setRole(role){const actor=await f.login(role);const value=actor.cookie.split('=').slice(1).join('=');await context.addCookies([{name:'lp_session',value,url:f.origin,httpOnly:true,sameSite:'Strict'}]);return actor;}
   for(const role of ['student','parent']){await setRole(role);await page.reload();await page.getByText('本页只供真实教师账号使用。',{exact:false}).waitFor();checks.push(`${name}: ${role} sees permission denial`);}
   const teacher=await setRole('teacher');await page.reload();await page.getByRole('heading',{name:'DeepTutor 暂不可用'}).waitFor();assert.equal(await page.getByRole('button').count(),3);for(const button of await page.getByRole('button').all())assert.equal(await button.isDisabled(),true);checks.push(`${name}: unavailable service does not simulate success`);
   Object.assign(f.env,{DEEPTUTOR_LAB_ENABLED:'true',DEEPTUTOR_LAB_ORIGIN:'http://127.0.0.1:18083',DEEPTUTOR_LAB_TOKEN:token});
   await page.reload();await page.getByRole('heading',{name:'DeepTutor 教师样例实验已接入'}).waitFor();await page.getByRole('button',{name:'原创英语样例：',exact:false}).click();await page.getByRole('heading',{name:'真实实验结果'}).waitFor();await page.getByText('SYNTHETIC_CONTRACT_FIXTURE_EXPLANATION',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'模型返回（未经过老师审核）'}).count(),1);checks.push(`${name}: asynchronous output remains visibly unreviewed`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push(`${name}: no horizontal overflow`);
   await mkdir(join(root,'test-results/deeptutor'),{recursive:true});await page.screenshot({path:join(root,'test-results/deeptutor',`lab-${name}-synthetic-fixture.png`),fullPage:true});
   await page.getByRole('button',{name:'范围外拒答回归：',exact:false}).click();await page.getByText('范围检查拒答：模型调用 0 次。',{exact:true}).waitFor();checks.push(`${name}: explicit outside-scope rejection is shown`);
   // Revoke the actual synthetic teacher session, then restore the page from a visibility event.
   f.DB.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(teacher.id);
   await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.getByRole('heading',{name:'当前无法继续'}).waitFor();assert.equal(await page.getByText('SYNTHETIC_CONTRACT_FIXTURE_EXPLANATION',{exact:true}).count(),0);checks.push(`${name}: revoked session clears previous output on reauthentication`);
   await setRole('teacher');await page.route('**/api/v1/ai-lab/status',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'x-actor-id':'another-actor'}});});
   await page.reload();await page.getByRole('heading',{name:'当前无法继续'}).waitFor();assert.equal(await page.getByRole('button').count(),0);checks.push(`${name}: mismatched X-Actor-Id cannot reveal an old identity's output`);
   assert.deepEqual(errors,[]);checks.push(`${name}: no uncaught page errors`);await context.close();
  }finally{await f.cleanup();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
await writeFile(join(root,'test-results/deeptutor/browser-contract.json'),JSON.stringify({passed:checks.length,checks,syntheticAccounts:true,provider:'explicit local contract fixture',realModelExecution:false,realModelEvidence:'live-regression.json'},null,2));console.log(`DeepTutor browser contract checks ${checks.length}/${checks.length} passed; model results are separate real evidence.`);
