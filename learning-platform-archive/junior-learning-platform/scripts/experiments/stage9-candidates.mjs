// Import unchanged real model output into a synthetic isolated lab, never production.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {browserHarness} from '../../tests/browser-harness.mjs';
import {getSource,validateCandidates,createDraft} from '../../src/draft-content.mjs';
import {root} from '../environment.mjs';
const result=JSON.parse(readFileSync(join(root,'test-results/stage9/retrieval-generation.json'),'utf8'));
const h=await browserHarness(),t=await h.login('teacher'),actor={id:t.id,org_id:h.org,role:'teacher'},ids=[];
const out=join(root,'test-results/stage9/pdf');mkdirSync(out,{recursive:true});
try{
 for(const c of result.candidates){assert(c.schemaValid,'Invalid outputs must not be silently repaired');const sourceText=readFileSync(join(root,'scripts/experiments/stage9/sources',c.sourceFile),'utf8');assert.equal(createHash('sha256').update(sourceText).digest('hex'),c.sourceSha256);
  const sr=await h.request('/draft-sources',{client:t,method:'POST',body:{requestId:crypto.randomUUID(),title:c.subject==='math'?'合成数学资料':'合成英语资料',subject:c.subject,text:sourceText,sourceLabel:'阶段9原创合成资料；未经过真人教学审核',licenseDeclaration:'original_private',syntheticOnly:true,rightsConfirmed:true}});assert.equal(sr.status,201);
  const s=sr.data,raw=await getSource(h.DB,actor,s.id),q={...c.candidate,topic:c.subject==='math'?'等式性质':'一般现在时be动词',grade:7,phase:'practice',citations:[{sourceId:s.id,sourceVersion:1,digest:s.digest,lineStart:1,lineEnd:s.text.split('\n').length,text:s.text}]};
  const checked=await validateCandidates([q],[raw],h.org),title=`真实模型${c.subject==='math'?'数学':'英语'}候选 · ${c.simpleAnswerCheck?'简单预检通过':'答案预检失败'} · 待审核`;
  const saved=await createDraft(h.DB,actor,{requestId:crypto.randomUUID(),title,subject:c.subject,sources:[raw],...checked,intent:{experiment:'stage9',rawOutputSha:createHash('sha256').update(c.rawOutput).digest('hex')},provenance:{kind:'deeptutor_live_experiment',contract:'native_complete_experiment',providerRevision:'deeptutor-1.7.2_llamacpp-b12375_qwen3-23749fef',model:c.model,transportExecuted:true,modelExecution:'provider_reported_unverified',usage:{inputTokens:null,outputTokens:null},syntheticOnly:true,gradingAllowed:false}});
  ids.push({subject:c.subject,id:saved.row.id,status:saved.row.status,answerPrecheckPassed:c.simpleAnswerCheck});assert.equal(saved.row.status,'pending_human');
 }
 for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await h.browser.newContext({viewport});await context.addCookies([{name:'lp_session',value:t.cookie.split('=')[1],url:h.origin,httpOnly:true,sameSite:'Strict'}]);const page=await context.newPage();
  const js=body=>({status:200,contentType:'text/javascript',body});
  await page.route('**/export-registry.js',route=>route.fulfill(js(readFileSync(join(root,'public/export-registry.js'),'utf8')+'\n'+readFileSync(join(root,'integrations/drafts/export-registry.js'),'utf8'))));
  await page.route('**/original-print-data.js',route=>route.fulfill(js(readFileSync(join(root,'public/print-data.js'),'utf8'))));
  await page.route('**/draft-print-loader.js',route=>route.fulfill(js(readFileSync(join(root,'integrations/drafts/print-loader.js'),'utf8'))));
  await page.route('**/print-data.js',route=>route.fulfill(js("import {readApi} from './original-print-data.js';import {loadDraftDocument} from './draft-print-loader.js';export const loadDocument=(kind,params)=>loadDraftDocument(kind,params,readApi);")));
  for(const c of ids){await page.goto(`${h.origin}/print.html?kind=question-draft&id=${c.id}`);await page.waitForSelector('#document[data-ready=true]');const content=await page.locator('#document').innerText();assert(content.includes('待教师逐题审核'));assert(content.includes('候选答案'));assert(!content.includes('正确答案'));if(c.subject==='english')assert(content.includes('答案预检失败'));await page.locator('#confirm').check();assert(await page.locator('#print').isEnabled());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.pdf({path:join(out,`${profile}-${c.subject}-pending.pdf`),format:'A4',preferCSSPageSize:true,printBackground:true});}
  await page.screenshot({path:join(out,`${profile}-preview.png`),fullPage:true});await context.close();
 }
 const lab=join(root,'.local/real-model-labs');mkdirSync(lab,{recursive:true});const dbFile=join(lab,`stage9-${Date.now()}.sqlite`);h.DB.sqlite.exec("VACUUM INTO '"+dbFile.replaceAll("'","''")+"'");
 const summary={candidates:ids,lab:dbFile,pdfCount:4,humanReviews:0,published:0,formalQuestions:h.DB.sqlite.prepare('SELECT COUNT(*) n FROM questions').get().n,notice:'Raw real model outputs preserved, including incorrect English answer. Synthetic accounts/materials only; website/Android untouched.'};writeFileSync(join(root,'test-results/stage9/candidate-import.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{await h.cleanup();}
