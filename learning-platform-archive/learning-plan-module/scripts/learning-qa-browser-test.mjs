// Real browser + real API, synthetic accounts and explicit UI transport fixture; no model claims.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {browserHarness} from '../tests/browser-harness.mjs';
import {randomToken} from '../src/security.mjs';
import {root} from './environment.mjs';
import sources from '../integrations/learning-qa/sources.json' with {type:'json'};
const checks=[],jobs=new Map(),token=randomToken();let submissions=0;
const fixture=createServer(async(req,res)=>{
 if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(404);res.end();return;}
 let value;
 if(req.url==='/status')value={contract:'learning-qa-original-v1',status:'ready',freeInput:true,grading:false,ttlSeconds:1800};
 else if(req.url==='/jobs'&&req.method==='POST'){
  const chunks=[];for await(const c of req)chunks.push(c);const payload=JSON.parse(Buffer.concat(chunks));submissions++;
  if(payload.question.includes('故障')){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'EXPLICIT_TEST_FAILURE'}));return;}
  jobs.set(payload.jobId,payload);value={jobId:payload.jobId,state:'running'};
 }else if(req.url.startsWith('/jobs/')){
  const job=jobs.get(req.url.slice(6)),refused=job.question.includes('月球'),source=sources.sources.find(s=>s.subject===job.subject);
  value={jobId:job.jobId,subject:job.subject,state:'completed',result:{contract:'learning-qa-original-v1',subject:job.subject,teacherReviewed:false,gradingAllowed:false,modelCalls:refused?0:1,outcome:refused?'refused':'needs_verification',answer:refused?null:'合成UI契约测试解释：用于验证页面展示，不是真实模型效果证据。',citations:refused?[]:[{sourceId:source.id,digest:source.digest,quote:source.text.slice(0,160),nativePageCitation:false}],automaticCheck:'source_bound_not_semantically_proven'}};
 }else{res.writeHead(404);res.end();return;}
 res.writeHead(req.method==='POST'?202:200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));
});
await new Promise((resolve,reject)=>{fixture.once('error',reject);fixture.listen(18084,'127.0.0.1',resolve);});
try{
 for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const f=await browserHarness();try{
   const context=await f.browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(f.origin+'/learning-qa.html');await page.getByRole('heading',{name:'当前无法继续'}).waitFor();assert.equal(await page.locator('textarea').count(),0);checks.push(`${name}: anonymous cannot access input or answers`);
   async function setRole(role){const actor=await f.login(role);await context.addCookies([{name:'lp_session',value:actor.cookie.split('=').slice(1).join('='),url:f.origin,httpOnly:true,sameSite:'Strict'}]);return actor;}
   for(const role of ['parent','admin']){await setRole(role);await page.reload();await page.getByText('学习问答仅供学生或教师账号使用。',{exact:true}).waitFor();checks.push(`${name}: ${role} cannot access the input`);}
   const student=await setRole('student');await page.reload();await page.getByRole('heading',{name:'学习问答暂不可用'}).waitFor();assert.equal(await page.getByRole('button',{name:'提交学习问题'}).isDisabled(),true);checks.push(`${name}: unavailable service is explicit and disabled`);
   Object.assign(f.env,{LEARNING_QA_ENABLED:'true',LEARNING_QA_ORIGIN:'http://127.0.0.1:18084',LEARNING_QA_TOKEN:token});await page.reload();await page.getByRole('heading',{name:'受保护学习问答已接入'}).waitFor();
   const input=page.getByLabel('你的学习问题（5–300字）',{exact:true}),submit=page.getByRole('button',{name:'提交学习问题',exact:true});
   await input.fill('为什么等式两边需要同时减去相同的数？');const before=submissions;await submit.click();assert.equal(submissions,before);checks.push(`${name}: personal-data exclusion confirmation is mandatory`);
   let lost=false;
   await page.route('**/api/v1/learning-qa/jobs',async route=>{if(route.request().method()!=='POST'||lost)return route.continue();lost=true;const response=await route.fetch(),payload=await response.json();await page.request.get(f.origin+'/api/v1/learning-qa/jobs/'+payload.data.id);await route.abort('failed');});
   await page.getByRole('checkbox').check();await submit.click();await page.getByText('Failed to fetch',{exact:true}).waitFor();const once=submissions;await submit.click();await page.getByRole('heading',{name:'模型解释 · 待核对'}).waitFor();assert.equal(submissions,once);await page.unroute('**/api/v1/learning-qa/jobs');checks.push(`${name}: lost POST response retries completed job without another model request`);
   assert.match(await page.locator('#workspace').innerText(),/原创讲解：/);assert.equal(await input.inputValue(),'');checks.push(`${name}: free input reaches asynchronous API and an unreviewed source-bound result`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push(`${name}: no horizontal overflow`);
   await mkdir(join(root,'test-results/learning-qa'),{recursive:true});await page.screenshot({path:join(root,'test-results/learning-qa',`qa-${name}-synthetic-ui.png`),fullPage:true});
   const row=f.DB.sqlite.prepare('SELECT id FROM learning_qa_jobs WHERE owner_id=? ORDER BY created_at DESC LIMIT 1').get(student.id);f.DB.sqlite.prepare('UPDATE learning_qa_jobs SET expires_at=0 WHERE id=?').run(row.id);
   await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.getByRole('heading',{name:'临时结果已过期'}).waitFor();assert.equal(await page.getByText('合成UI契约测试解释：用于验证页面展示，不是真实模型效果证据。',{exact:true}).count(),0);checks.push(`${name}: TTL expiry clears previously visible output`);
   await input.fill('月球距离地球有多远？');await page.getByRole('checkbox').check();await submit.click();await page.getByText('本次未调用模型。',{exact:true}).waitFor();checks.push(`${name}: refusal is displayed without a substitute answer`);
   await input.fill('请测试等式问答服务故障时的处理。');await submit.click();await page.getByRole('heading',{name:'无法完成本次问答'}).waitFor();assert.equal(await page.getByRole('heading',{name:'模型解释 · 待核对'}).count(),0);checks.push(`${name}: provider failure is not shown as model success`);
   const teacher=await setRole('teacher');await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.getByRole('heading',{name:'受保护学习问答已接入'}).waitFor();assert.equal(await input.inputValue(),'');assert.equal(await page.getByRole('heading',{name:'无法完成本次问答'}).count(),0);checks.push(`${name}: switching account clears the former question and result`);
   f.DB.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(teacher.id);await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.getByRole('heading',{name:'当前无法继续'}).waitFor();assert.equal(await page.locator('textarea').count(),0);checks.push(`${name}: revoked session closes the question form`);
   await setRole('student');await page.route('**/api/v1/learning-qa/status',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'x-actor-id':'different-user'}});});await page.reload();await page.getByRole('heading',{name:'当前无法继续'}).waitFor();assert.equal(await page.locator('textarea').count(),0);checks.push(`${name}: X-Actor-Id mismatch cannot load another identity`);
   assert.deepEqual(errors,[]);checks.push(`${name}: no uncaught browser errors`);await context.close();
  }finally{await f.cleanup();}
 }
}finally{await new Promise(resolve=>fixture.close(resolve));}
await writeFile(join(root,'test-results/learning-qa/browser-contract.json'),JSON.stringify({passed:checks.length,checks,syntheticAccounts:true,provider:'explicit local UI contract fixture',realModelExecution:false,realModelEvidence:'live-evaluation.json'},null,2));console.log(`Learning QA browser contract checks ${checks.length}/${checks.length} passed; real models are separately evidenced.`);
