// Privacy regression: real isolated local API plus explicit response fault injection. Never writes production data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {browserHarness} from '../tests/browser-harness.mjs';
import {root} from './environment.mjs';
import CONTENT from '../data/arts-content.json' with {type:'json'};

const out=path.join(root,'test-results/arts-privacy');fs.mkdirSync(out,{recursive:true});
const selectedScenario=process.argv.find(x=>x.startsWith('--scenario='))?.slice('--scenario='.length);
const point=CONTENT.points.find(p=>p.subject==='math'),privateStrings=point.questions.flatMap(q=>[q.prompt,q.rationale]);
const report={notice:'Only in-memory SQLite and synthetic accounts. HTTP denial/actor cases are explicitly injected; cookie switch and session revocation use actual authentication. Visibility/page-transition synthetic events supplement real navigation. No runtime source modifications.',checks:[],scenarios:[],failures:[],pdfs:[],lifecycle:[]};
const f=await browserHarness(),teacher=await f.login('teacher'),parent=await f.login('parent');
const runtime=['public/arts/workspace.js','public/arts/workspace.html','public/arts/arts.css'];
report.runtimeHashes=Object.fromEntries(runtime.map(p=>[p,createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]));
function check(label,a,b=true){assert.deepEqual(a,b,label);report.checks.push(label);}
async function putCookie(context,client){const [name,...value]=client.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:f.origin,httpOnly:true,sameSite:'Strict'}]);}
async function newPage(){const context=await f.browser.newContext({viewport:{width:1440,height:1000}});await putCookie(context,teacher);await context.addInitScript(()=>{window.__printCalls=0;window.print=()=>{window.__printCalls++;};});const page=await context.newPage();page.setDefaultTimeout(8000);return {context,page};}
async function openReview(page){await page.goto(f.origin+'/arts/workspace.html');await page.locator('#plan-editor').waitFor();await page.locator('[data-tab="review"]').click();await page.locator(`[data-review="${point.id}"]`).click();await page.locator('#print-review').waitFor();check('teacher private question actually rendered',await page.locator('[name="prompt-0"]').inputValue(),point.questions[0].prompt);}
async function cleared(page,label){await page.waitForFunction(()=>document.querySelector('#view').childElementCount===0&&document.querySelector('#workspace').hidden);check(label+': DOM/options/identity cleared',await page.evaluate(()=>[document.querySelector('#view').innerHTML,document.querySelector('#student').options.length,document.querySelector('#plan-select').options.length,document.querySelector('#identity').textContent]),['',0,0,'']);check(label+': no private text anywhere in DOM',await page.evaluate(strings=>!strings.some(s=>document.body.innerHTML.includes(s)),privateStrings));}
async function authOnResume(page,trigger,label){let release;const gate=new Promise(r=>release=r);let reached;const entered=new Promise(r=>reached=r);const pattern='**/api/v1/auth/session';await page.route(pattern,async route=>{reached();await gate;await route.continue();},{times:1});const pending=trigger();await entered;await cleared(page,label+' while auth pending');release();await pending;await page.locator('#plan-editor').waitFor();check(label+': fresh session reloaded',await page.locator('#identity').innerText(),'teacher · 教师');}
async function snapshotPdf(page,file,{allow=false}={}){await page.emulateMedia({media:'print'});const visible=await page.locator('#workspace-main').isVisible();check(file+': print visibility',visible,allow);await page.pdf({path:path.join(out,file),format:'A4',printBackground:true,preferCSSPageSize:true});await page.emulateMedia({media:'screen'});report.pdfs.push({file,allow,expected:allow?privateStrings:[],forbidden:allow?[]:privateStrings});}
async function scenario(name,run){if(selectedScenario&&name!==selectedScenario)return;const {context,page}=await newPage();try{await openReview(page);await run(page,context);report.scenarios.push({name,status:'passed'});}catch(e){report.failures.push({scenario:name,message:e.message,stack:e.stack});report.scenarios.push({name,status:'failed'});await page.screenshot({path:path.join(out,name.replace(/[^a-z0-9-]/gi,'-')+'-failure.png'),fullPage:true}).catch(()=>{});}finally{await context.close();}}

try{
 for(const denial of [{status:401,code:'UNAUTHENTICATED'},{status:403,code:'FORBIDDEN'},{status:404,code:'NOT_FOUND'},{status:409,code:'ACCESS_OR_VERSION_CHANGED'},{status:200,code:'ACTOR_MISMATCH'}]){
  await scenario('rejected-'+denial.code,async page=>{
   const pattern='**/api/v1/arts/content/*/print';let observed=false;
   await page.route(pattern,async route=>{observed=true;if(denial.status===200){const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'x-actor-id':parent.id}});}else await route.fulfill({status:denial.status,contentType:'application/json',headers:{'cache-control':'no-store'},body:JSON.stringify({error:{code:denial.code,message:'Synthetic access refusal'}})});},{times:1});
   await page.locator('#print-review').click();await cleared(page,denial.code);check(denial.code+': API denial observed',observed);check(denial.code+': no print was invoked',await page.evaluate(()=>window.__printCalls),0);
   await authOnResume(page,()=>page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))),denial.code+' pageshow');
  });
 }
 for(const malformed of [
  {name:'html-403',status:403,contentType:'text/html',body:'<html><body>Gateway forbidden</body></html>'},
  {name:'bad-json-404',status:404,contentType:'application/json',body:'{"error":'},
  {name:'wrong-actor-html-200',status:200,contentType:'text/html',actor:parent.id,body:'<html><body>Unverified response</body></html>'},
  {name:'missing-actor-200',status:200,copyWithoutActor:true},
  {name:'bad-json-valid-actor-200',status:200,contentType:'application/json',actor:teacher.id,body:'{"data":'}
 ]){
  await scenario(malformed.name,async page=>{
   let observed=false;await page.route('**/api/v1/arts/content/*/print',async route=>{observed=true;if(malformed.copyWithoutActor){const response=await route.fetch(),headers={...response.headers()};delete headers['x-actor-id'];await route.fulfill({response,headers});}else await route.fulfill({status:malformed.status,contentType:malformed.contentType,headers:{'cache-control':'no-store',...(malformed.actor?{'x-actor-id':malformed.actor}:{})},body:malformed.body});},{times:1});
   await page.locator('#print-review').click();await cleared(page,malformed.name);check(malformed.name+': injected response observed',observed);check(malformed.name+': native print not invoked',await page.evaluate(()=>window.__printCalls),0);await snapshotPdf(page,'blocked-'+malformed.name+'.pdf');
  });
 }
 await scenario('actual-teacher-to-parent-cookie',async(page,context)=>{
  await putCookie(context,parent);const response=page.waitForResponse(r=>r.url().includes('/arts/content/')&&r.url().endsWith('/print'));await page.locator('#print-review').click();check('real parent cookie cannot print teacher content',(await response).status(),403);await cleared(page,'teacher to parent');check('parent switch cannot invoke print',await page.evaluate(()=>window.__printCalls),0);
  let authCount=0;page.on('request',r=>{if(r.url().endsWith('/auth/session'))authCount++;});await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.locator('#identity').filter({hasText:'parent · 家长'}).waitFor();check('parent identity reauthenticated',authCount>0);check('parent does not recover teacher private questions',await page.locator('#content-editor').count(),0);
 });
 await scenario('logout-network-failure',async page=>{
  let aborted=false;await page.route('**/api/v1/auth/logout',async route=>{aborted=true;await route.abort('internetdisconnected');},{times:1});await page.locator('#logout').click();await cleared(page,'logout network failure');check('logout request really aborted',aborted);check('logout failure is explicit, not false success',(await page.locator('#session-status').innerText()).includes('服务器退出尚未确认'));await snapshotPdf(page,'blocked-logout-network-failure.pdf');
 });
 await scenario('print-gate-one-use-and-expiry',async page=>{
  await snapshotPdf(page,'blocked-direct-print.pdf');
  let printRequests=0;page.on('request',r=>{if(r.url().includes('/arts/content/')&&r.url().endsWith('/print'))printRequests++;});await page.locator('#print-review').click();await page.waitForFunction(()=>window.__printCalls===1);check('official print button fetches fresh permission',printRequests,1);await snapshotPdf(page,'allowed-fresh-review.pdf',{allow:true});
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));check('afterprint revokes authorization class',await page.locator('body').evaluate(el=>el.classList.contains('arts-print-authorized')),false);await snapshotPdf(page,'blocked-afterprint.pdf');
  await page.locator('#print-review').click();await page.waitForFunction(()=>window.__printCalls===2);await page.evaluate(()=>{const real=Date.now;Date.now=()=>real()+16000;window.dispatchEvent(new Event('beforeprint'));Date.now=real;});check('expired ticket cannot authorize print',await page.locator('body').evaluate(el=>el.classList.contains('arts-print-authorized')),false);
 });
 await scenario('hidden-and-stale-response',async page=>{
  let reached,release;const entered=new Promise(r=>reached=r),gate=new Promise(r=>release=r);await page.route('**/api/v1/arts/content/*/print',async route=>{const response=await route.fetch();reached();await gate;await route.fulfill({response}).catch(()=>{});},{times:1});await page.locator('#print-review').click();await entered;
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await cleared(page,'hidden');release();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));check('late success after hidden cannot print',await page.evaluate(()=>window.__printCalls),0);await cleared(page,'late response');
  await authOnResume(page,()=>page.evaluate(()=>{delete document.visibilityState;delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}),'visible return');
 });
 await scenario('pagehide-pageshow-synthetic',async page=>{
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await cleared(page,'pagehide');await authOnResume(page,()=>page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))),'persisted pageshow');
 });
 await scenario('real-navigation-back',async(page,context)=>{
  // The async exposed-binding message can be lost during unload. Test-only synchronous
  // storage carries booleans, never content/IDs, across the actual navigation.
  await context.addInitScript(()=>{window.addEventListener('pageshow',ev=>{const key='__artsPrivacyLifecycleTest',a=JSON.parse(sessionStorage.getItem(key)||'[]');a.push({kind:'pageshow',persisted:ev.persisted});sessionStorage.setItem(key,JSON.stringify(a));});});
  await page.evaluate(()=>{const key='__artsPrivacyLifecycleTest';sessionStorage.removeItem(key);window.addEventListener('pagehide',ev=>{const a=JSON.parse(sessionStorage.getItem(key)||'[]');a.push({kind:'pagehide',persisted:ev.persisted,viewEmpty:document.querySelector('#view').childElementCount===0,workspaceHidden:document.querySelector('#workspace').hidden});sessionStorage.setItem(key,JSON.stringify(a));});window.addEventListener('pageshow',ev=>{const a=JSON.parse(sessionStorage.getItem(key)||'[]');a.push({kind:'pageshow',persisted:ev.persisted});sessionStorage.setItem(key,JSON.stringify(a));});});
  await page.goto(f.origin+'/arts/index.html');let authCount=0;page.on('request',r=>{if(r.url().endsWith('/auth/session'))authCount++;});await page.goBack({waitUntil:'domcontentloaded'});await page.locator('#plan-editor').waitFor();check('actual back navigation reauthenticates',authCount>0);check('back does not restore old review DOM',await page.locator('#content-editor').count(),0);report.lifecycle=await page.evaluate(()=>{const key='__artsPrivacyLifecycleTest',a=JSON.parse(sessionStorage.getItem(key)||'[]');sessionStorage.removeItem(key);return a;});check('actual pagehide clears private DOM',report.lifecycle.some(e=>e.kind==='pagehide'&&e.viewEmpty&&e.workspaceHidden));report.actualBackBfcacheObserved=report.lifecycle.some(e=>e.kind==='pageshow'&&e.persisted);
 });
 await scenario('actual-session-revocation-direct-print',async page=>{
  f.DB.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(teacher.id);await snapshotPdf(page,'blocked-after-session-revocation.pdf');const response=page.waitForResponse(r=>r.url().includes('/arts/content/')&&r.url().endsWith('/print'));await page.locator('#print-review').click();check('revoked real session rejected',(await response).status(),401);await cleared(page,'revoked session');
 });
 const python='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
 const code=`import json,sys,pathlib\nfrom pypdf import PdfReader\nfrom pypdfium2 import PdfDocument\np=pathlib.Path(sys.argv[1]);result=[]\nfor s in json.loads(sys.argv[2]):\n r=PdfReader(p/s['file']);text='\\n'.join(x.extract_text() or '' for x in r.pages);compact=''.join(text.split());d=PdfDocument(p/s['file']);renders=[]\n for i in range(len(d)):\n  name=s['file'].replace('.pdf',f'-page-{i+1}.png');d[i].render(scale=1.1).to_pil().save(p/name);renders.append(name)\n (p/s['file'].replace('.pdf','.txt')).write_text(text,encoding='utf-8');result.append({'file':s['file'],'pages':len(r.pages),'missingExpected':[x for x in s['expected'] if ''.join(x.split()) not in compact],'leakedPrivateText':[x for x in s['forbidden'] if ''.join(x.split()) in compact],'textLength':len(text),'renders':renders})\nprint(json.dumps(result,ensure_ascii=True))`;
 const extraction=spawnSync(python,['-X','utf8','-c',code,out,JSON.stringify(report.pdfs)],{encoding:'utf8'});check('PDF evidence extracts',extraction.status,0);report.pdfVerification=JSON.parse(extraction.stdout);for(const p of report.pdfVerification){check(p.file+': expected print contents',p.missingExpected,[]);check(p.file+': no forbidden private text',p.leakedPrivateText,[]);}
}catch(e){report.failures.push({scenario:'outer',message:e.message,stack:e.stack});}finally{await f.cleanup();fs.writeFileSync(path.join(out,selectedScenario?'report-'+selectedScenario.replace(/[^a-z0-9-]/gi,'-')+'.json':'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,scenarios:report.scenarios,failures:report.failures,pdfs:report.pdfVerification,actualBackBfcacheObserved:report.actualBackBfcacheObserved,report:path.join(out,selectedScenario?'report-'+selectedScenario+'.json':'report.json')},null,2));if(report.failures.length)process.exitCode=1;
