import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { join,resolve,extname,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { fixture,TEST_PASSWORD } from '../tests/helpers.mjs';
import { handleApi } from '../src/api.mjs';
import { securityHeaders } from '../src/security.mjs';
import { EXPORTS,exportUrl } from '../public/export-registry.js';
import { root } from './environment.mjs';

const packagePath=process.env.PLAYWRIGHT_MODULE||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium }=await import(pathToFileURL(packagePath).href);
const f=await fixture(),publicRoot=resolve(root,'public'),out=join(root,'test-results/pdf');await mkdir(out,{recursive:true});
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,f.env.APP_ORIGIN);let response;if(url.pathname.startsWith('/api/'))response=await handleApi(new Request(url,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body:Readable.toWeb(req),duplex:'half'})}),f.env);else{const path=resolve(publicRoot,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!path.startsWith(publicRoot+sep))response=new Response('Not found',{status:404});else try{response=new Response(await readFile(path),{headers:{...securityHeaders,'Content-Type':mime[extname(path)]||'application/octet-stream'}});}catch{response=new Response('Not found',{status:404});}}res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));f.env.APP_ORIGIN=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const summary={environment:'Headless Chrome on Windows; desktop 1440x1000 and mobile viewport 390x844 (not physical phones)',fixture:'Isolated in-memory SQLite; actual API grading/persistence, automated test teacher approvals; no actual student data or human verification',exports:[],checks:[]};
try{
  const clients={};for(const name of ['student','teacher','parent','admin','student2'])clients[name]=await f.login(name);
  await f.review(clients.teacher);
  const attempts=[],packs=[];
  for(const sub of ['math','english']){
    const created=await f.request('/attempts',{client:clients.student,method:'POST',body:{studentId:clients.student.id,subject:sub,phase:'diagnostic'}});assert.equal(created.status,201);const a=created.data;
    const ans=f.correctAnswers(a);ans[0].selectedOption=(ans[0].selectedOption+1)%4;
    await f.request(`/attempts/${a.id}/submit`,{client:clients.student,method:'POST',body:{answers:ans}});attempts.push(a.id);
    const matched=await f.request('/packs',{client:clients.student,method:'POST',body:{diagnosticId:a.id}});const p=matched.data;
    const reviewed=await f.request(`/packs/${p.id}`,{client:clients.teacher,method:'PATCH',body:{revision:p.revision,knowledgeIds:a.questions.map(q=>q.knowledgeId),teacherNote:'请逐步写出过程，再核对。分数运算先通分；等式两边同时运算。',approve:true}});assert.equal(reviewed.status,200);packs.push(p.id);
    for(const phase of ['practice','retest']){
      const created=await f.request('/attempts',{client:clients.student,method:'POST',body:{studentId:clients.student.id,subject:sub,phase,packId:p.id}});assert.equal(created.status,201);const result=await f.request(`/attempts/${created.data.id}/submit`,{client:clients.student,method:'POST',body:{answers:f.correctAnswers(created.data)}});assert.equal(result.status,200);
    }
  }
  const imagePage=await browser.newPage({viewport:{width:800,height:800}});
  await imagePage.setContent('<html lang="zh-CN"><meta charset="UTF-8"><body style="font:24px Microsoft YaHei;background:white;padding:55px"><h1>示例试卷 · 合成测试素材</h1><p>本页不含真实学生信息。</p><hr><p>1. 解方程 2x + 3 = 11。</p><p>2. 计算 1/3 + 1/6。</p><p>步骤：先通分，再求和。</p><hr><p>此图仅验证私有图片与 PDF 保真。</p></body></html>');
  const imageBytes=await imagePage.screenshot();await imagePage.close();
  const upload=(await f.request(`/uploads?studentId=${clients.student.id}`,{client:clients.student,method:'POST',raw:true,headers:{'Content-Type':'image/png'},body:imageBytes})).data;
  await f.request(`/uploads/${upload.id}/review`,{client:clients.teacher,method:'PATCH',body:{revision:1,confirmed:true,text:'人工核对：2x + 3 = 11；x = 4。1/3 + 1/6 = 1/2。图片与文本仅用于导出验证。'}});
  const longUpload=(await f.request(`/uploads?studentId=${clients.student.id}`,{client:clients.student,method:'POST',raw:true,headers:{'Content-Type':'image/png'},body:imageBytes})).data;
  const longText=Array.from({length:70},(_,i)=>`第${i+1}段：这是一条用于检验 A4 长文本分页的人工核对记录。请完整保留中文、数字、分数 1/3 和公式 2x+3=11，不应出现重叠、截断或丢字。`).join('\n');
  await f.request(`/uploads/${longUpload.id}/review`,{client:clients.teacher,method:'PATCH',body:{revision:1,confirmed:true,text:longText}});
  async function makePaper(kind,items,confirm=true){const created=await f.request('/papers',{client:clients.teacher,method:'POST',body:{studentId:clients.student.id,subject:'math',title:kind==='scored_paper'?'原卷部分分示例':'独立能力观察示例',kind,requestId:crypto.randomUUID(),uploadId:kind==='scored_paper'?upload.id:null}});assert.equal(created.status,201);const saved=await f.request(`/papers/${created.data.id}`,{client:clients.teacher,method:'PATCH',body:{revision:created.data.revision,title:created.data.title,items}});assert.equal(saved.status,200);if(!confirm)return saved.data;const final=await f.request(`/papers/${saved.data.id}/confirm`,{client:clients.teacher,method:'POST',body:{revision:saved.data.revision,confirmed:true}});assert.equal(final.status,200);return final.data;}
  const scoredItems=[{questionNo:'21(1)',prompt:'计算 1.5/2 与 1/3 + 1/6，保留小数除式原文。',qtype:'solution',mappingLevel:'chapter',scopeText:'有理数',maxScore:4,earnedScore:2.5,reviewed:true,note:'实际步骤部分正确，人工核对2.5分。'},{questionNo:'21(2)',prompt:'解方程 2x + 3 = 11，并代回检验。',qtype:'solution',mappingLevel:'knowledge',knowledgeId:'math-equation',maxScore:6,earnedScore:3.5,reviewed:true,note:'按原卷实际表现给分。原文1/2.5不得被拆成整数分数。'}];
  const paper=await makePaper('scored_paper',scoredItems),observation=await makePaper('ability_observation',[{questionNo:'1',prompt:'描述通分的方法。',qtype:'observation',mappingLevel:'unresolved',observationLevel:2,reviewed:true,note:'人工能力观察保留2档，不换算为72%。'}]),draft=await makePaper('scored_paper',[{...scoredItems[0],earnedScore:null,reviewed:false}],false);
  const roleFor=kind=>kind.startsWith('admin-')?'admin':kind==='content'?'teacher':kind==='paper-summaries'?'parent':'student';
  const paramsFor=kind=>['growth','attempts','packs','uploads','papers','paper-summaries'].includes(kind)?{studentId:clients.student.id}:kind==='attempt'?{id:attempts[0]}:['pack','assignment'].includes(kind)?{id:packs[0]}:kind==='upload'?{id:upload.id}:['paper','paper-report'].includes(kind)?{id:paper.id}:kind==='knowledge'?{subject:'math'}:{};
  async function contextFor(name,viewport){const context=await browser.newContext({viewport});await context.addCookies([{name:'lp_session',value:clients[name].cookie.split('=')[1],url:f.env.APP_ORIGIN,httpOnly:true,sameSite:'Strict'}]);return context;}
  for(const [profile,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
    const contexts={};for(const name of ['student','teacher','parent','admin','student2'])contexts[name]=await contextFor(name,viewport);
    const app=await contexts.student.newPage();const errors=[];app.on('pageerror',e=>errors.push(e.message));await app.goto(f.env.APP_ORIGIN);await app.getByRole('heading',{name:'今天，也向前一点。'}).waitFor();await app.screenshot({path:join(out,`${profile}-dashboard.png`),fullPage:true});assert.equal(await app.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
    // Verify visible navigation and export actions are usable in both responsive layouts.
    await app.locator('[data-nav="learning"]:visible').first().click();await app.getByRole('heading',{name:'我的通关包'}).waitFor();assert(await app.getByRole('link',{name:'导出 PDF',exact:true}).count()>=3);await app.getByRole('button',{name:'打开通关包',exact:true}).first().click();await app.getByText('无答案通关练习单',{exact:true}).waitFor();assert(await app.getByRole('link',{name:'打印',exact:true}).count()>=2);summary.checks.push(`${profile}: app navigation, visible PDF/print links, no horizontal overflow`);await app.close();
    for(const kind of Object.keys(EXPORTS).filter(kind=>!kind.startsWith('ocr-')&&!kind.startsWith('homework'))){
      const page=await contexts[roleFor(kind)].newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
      await page.goto(f.env.APP_ORIGIN+exportUrl(kind,paramsFor(kind)));await page.waitForSelector('#document[data-ready="true"]',{timeout:15000});
      assert.equal(await page.locator('#print').isDisabled(),true);await page.locator('#confirm').check();assert.equal(await page.locator('#print').isEnabled(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${profile}/${kind} overflow`);
      assert.deepEqual(pageErrors,[]);const printedText=await page.locator('#document').innerText();assert(!/foreignStudent|password_hash|Testing-only/.test(printedText));if(roleFor(kind)!=='admin')assert(!printedText.includes('student2'));
      await page.pdf({path:join(out,`${profile}-${kind}.pdf`),format:'A4',printBackground:true,preferCSSPageSize:true});
      if(['growth','content','upload','assignment'].includes(kind))await page.screenshot({path:join(out,`${profile}-${kind}.png`),fullPage:true});
      if(kind==='growth'){
        await page.evaluate(()=>{window.__printCalls=0;window.print=()=>window.__printCalls++;});await page.locator('#print').click();await page.waitForFunction(()=>window.__printCalls===1);summary.checks.push(`${profile}: print action revalidates and calls browser print`);
      }
      summary.exports.push({profile,kind,file:`${profile}-${kind}.pdf`,status:'generated-from-real-test-API'});await page.close();
    }
    const long=await contexts.student.newPage();await long.goto(f.env.APP_ORIGIN+exportUrl('upload',{id:longUpload.id}));await long.waitForSelector('#document[data-ready="true"]');await long.pdf({path:join(out,`${profile}-long-text.pdf`),format:'A4',printBackground:true,preferCSSPageSize:true});summary.exports.push({profile,kind:'long-text',file:`${profile}-long-text.pdf`,status:'pagination-stress'});await long.close();
    for(const [name,record,kind]of [['observation',observation,'paper-report'],['draft-paper',draft,'paper']]){const page=await contexts.teacher.newPage();await page.goto(f.env.APP_ORIGIN+exportUrl(kind,{id:record.id}));await page.waitForSelector('#document[data-ready="true"]');await page.pdf({path:join(out,`${profile}-${name}.pdf`),format:'A4',printBackground:true,preferCSSPageSize:true});summary.exports.push({profile,kind:name,file:`${profile}-${name}.pdf`,status:'separate-evidence-print'});await page.close();}
    for(const [name,kind,params,expected] of [['student2','growth',{studentId:clients.student2.id},'暂无可导出数据'],['student2','attempt',{id:attempts[0]},'导出失败'],['parent','attempt',{id:attempts[0]},'导出失败'],['student','admin-users',{},'导出失败']]){
      const page=await contexts[name].newPage();await page.goto(f.env.APP_ORIGIN+exportUrl(kind,params));await page.waitForFunction(expected=>document.querySelector('#status').textContent.includes(expected),expected);assert(await page.locator('#print').isDisabled());summary.checks.push(`${profile}: ${name}/${kind} blocked or empty`);await page.close();
    }
    const loading=await contexts.student.newPage();let release;const gate=new Promise(r=>release=r);await loading.route('**/api/v1/students/*/growth',async route=>{await gate;await route.continue();});await loading.goto(f.env.APP_ORIGIN+exportUrl('growth',{studentId:clients.student.id}),{waitUntil:'domcontentloaded'});assert(await loading.locator('#print').isDisabled());release();await loading.waitForSelector('#document[data-ready="true"]');summary.checks.push(`${profile}: loading disables printing`);await loading.close();
    const failed=await contexts.student.newPage();await failed.route('**/api/v1/students/*/growth',route=>route.abort());await failed.goto(f.env.APP_ORIGIN+exportUrl('growth',{studentId:clients.student.id}));await failed.waitForFunction(()=>document.querySelector('#status').textContent.includes('导出失败'));assert(await failed.locator('#print').isDisabled());summary.checks.push(`${profile}: network error disables printing`);await failed.close();
    for(const kind of ['growth','attempts','packs','uploads','roster','papers','paper-summaries']){
      const name=kind==='roster'?'teacher2':'student2';
      if(!clients[name])clients[name]=await f.login(name);
      const emptyContext=await contextFor(name,viewport),emptyPage=await emptyContext.newPage();
      await emptyPage.goto(f.env.APP_ORIGIN+exportUrl(kind,kind==='roster'?{}:{studentId:clients.student2.id}));
      await emptyPage.waitForFunction(()=>document.querySelector('#status').textContent.includes('暂无可导出数据'));assert(await emptyPage.locator('#print').isDisabled());summary.checks.push(`${profile}: empty ${kind} disables print`);await emptyContext.close();
    }
    const anonContext=await browser.newContext({viewport});
    for(const kind of Object.keys(EXPORTS).filter(kind=>!kind.startsWith('ocr-')&&!kind.startsWith('homework'))){
      const page=await anonContext.newPage();await page.goto(f.env.APP_ORIGIN+exportUrl(kind,paramsFor(kind)));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('导出失败'));assert(await page.locator('#print').isDisabled());summary.checks.push(`${profile}: anonymous ${kind} denied`);await page.close();
    }
    await anonContext.close();
    const brokenImage=await contexts.student.newPage();await brokenImage.route('**/api/v1/uploads/*/image',route=>route.abort());await brokenImage.goto(f.env.APP_ORIGIN+exportUrl('upload',{id:upload.id}));await brokenImage.waitForFunction(()=>document.querySelector('#status').textContent.includes('导出失败'));assert(await brokenImage.locator('#print').isDisabled());summary.checks.push(`${profile}: necessary image failure disables print`);await brokenImage.close();
    for(const [name,kind,record]of [['parent','paper',paper],['student2','paper-report',paper],['student','paper',draft],['teacher','paper-report',draft]]){const page=await contexts[name].newPage();await page.goto(f.env.APP_ORIGIN+exportUrl(kind,{id:record.id}));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('导出失败'));assert(await page.locator('#print').isDisabled());summary.checks.push(`${profile}: ${name}/${kind}/${record.status} export blocked`);await page.close();}
    for(const context of Object.values(contexts))await context.close();
  }
  // Revocation after opening a preview must be checked again before the print action.
  const ctx=await contextFor('parent',{width:1200,height:900}),page=await ctx.newPage();await page.goto(f.env.APP_ORIGIN+exportUrl('growth',{studentId:clients.student.id}));await page.waitForSelector('#document[data-ready="true"]');await page.locator('#confirm').check();
  const links=(await f.request('/admin/relationships',{client:clients.admin})).data;await f.request(`/admin/relationships/${links.find(r=>r.kind==='parent').id}`,{client:clients.admin,method:'DELETE'});await page.locator('#print').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('导出失败'));assert(await page.locator('#print').isDisabled());summary.checks.push('revoked relationship clears preview and blocks printing');await ctx.close();
  const anonymous=await browser.newPage();await anonymous.goto(f.env.APP_ORIGIN+exportUrl('growth',{studentId:clients.student.id}));await anonymous.waitForFunction(()=>document.querySelector('#status').textContent.includes('导出失败'));assert(await anonymous.locator('#print').isDisabled());summary.checks.push('anonymous export denied');await anonymous.close();
  summary.passed=true;await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(`浏览器与PDF：${summary.exports.length} 个实际PDF；${summary.checks.length} 项界面/权限/错误检查通过。`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));f.close();}
