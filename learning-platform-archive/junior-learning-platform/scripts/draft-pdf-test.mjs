// Integration fixture overlays only the new loader/registry in memory.
// No public/ files or production website routes are changed by this test.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {draftFixture,sourceBody,sampleQuestion,checks} from '../tests/draft-fixture.mjs';
import {handleApi} from '../src/api.mjs';
import {securityHeaders} from '../src/security.mjs';
import {root} from './environment.mjs';
const out=join(root,'test-results/stage8/pdf');await mkdir(out,{recursive:true});const results={checks:[],pdfs:[],notice:'Actual authorized draft API/SQLite, original print engine plus in-memory handoff loader. This verifies the loader, not completed website navigation or real phones.'};
const check=(label,value)=>{assert(value,label);results.checks.push(label);};
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const f=await draftFixture(),contexts=[],errors=[];let server;
 try{
  const staticRoot=resolve(root,'public');server=createServer(async(req,res)=>{try{
   const url=new URL(req.url,f.env.APP_ORIGIN);let response;
   if(url.pathname.startsWith('/api/'))response=await handleApi(new Request(url,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body:Readable.toWeb(req),duplex:'half'})}),f.env);
   else if(url.pathname==='/print-data.js')response=new Response("import {loadDocument as base,readApi} from '/original-print-data.js';import {loadDraftDocument} from '/draft-print-loader.js';import {DRAFT_EXPORTS} from '/export-registry.js';export function loadDocument(kind,params){return Object.hasOwn(DRAFT_EXPORTS,kind)?loadDraftDocument(kind,params,readApi):base(kind,params);}",{headers:{...securityHeaders,'Content-Type':'text/javascript'}});
   else if(url.pathname==='/export-registry.js')response=new Response("export * from '/original-export-registry.js';export {DRAFT_EXPORTS} from '/draft-handoff-registry.js';",{headers:{...securityHeaders,'Content-Type':'text/javascript'}});
   else{const special={'/draft-print-loader.js':'integrations/drafts/print-loader.js','/draft-handoff-registry.js':'integrations/drafts/export-registry.js','/original-print-data.js':'public/print-data.js','/original-export-registry.js':'public/export-registry.js'};const file=special[url.pathname]?join(root,special[url.pathname]):resolve(staticRoot,'.'+url.pathname);
    if(!special[url.pathname]&&!file.startsWith(staticRoot+sep))response=new Response('Not found',{status:404});else try{response=new Response(await readFile(file),{headers:{...securityHeaders,'Content-Type':{'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8'}[extname(file)]||'text/plain'}});}catch{response=new Response('Not found',{status:404});}}
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));f.env.APP_ORIGIN=`http://127.0.0.1:${server.address().port}`;
  const longText='合成资料，不含学生信息。\n分数加法先通分，再相加分子。\n1/2 + 1/4 = 3/4。\n'+Array.from({length:35},(_,i)=>`资料段${i+1}：逐步核验中文与公式1/2，保留完整来源；这不是已审核教材。`).join('\n');
  const source=(await f.request('/draft-sources',{client:f.teacher,method:'POST',body:sourceBody({text:longText})})).data;
  const draft=(await f.create({requestId:crypto.randomUUID(),sourceIds:[source.id],questions:[sampleQuestion(source)]})).data;
  async function open(actor){const context=await browser.newContext({viewport});contexts.push(context);const client=actor==='teacher'?f.teacher:await f.login(actor);await context.addCookies([{name:'lp_session',value:client.cookie.split('=')[1],url:f.env.APP_ORIGIN,httpOnly:true,sameSite:'Strict'}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {page,context,client};}
  const owner=await open('teacher');const url=(kind,id)=>`${f.env.APP_ORIGIN}/print.html?kind=${kind}${id?'&id='+id:''}`;
  async function pdf(name,kind,id,required){await owner.page.goto(url(kind,id));await owner.page.waitForSelector('#document[data-ready=true]');const text=await owner.page.locator('#document').innerText();for(const value of required)check(`${profile}/${name}: ${value}`,text.includes(value));check(`${profile}/${name}: layout`,await owner.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await owner.page.locator('#confirm').check();check(`${profile}/${name}: print enabled`,await owner.page.locator('#print').isEnabled());const filename=`${profile}-${name}.pdf`;await owner.page.pdf({path:join(out,filename),format:'A4',preferCSSPageSize:true,printBackground:true});results.pdfs.push(filename);}
  await pdf('source','draft-source',source.id,['资料段35','SHA256','尚未核验']);await owner.page.screenshot({path:join(out,`${profile}-preview.png`),fullPage:true});
  await pdf('sources','draft-sources',null,['原创合成分数资料']);await pdf('pending','question-draft',draft.id,['待教师逐题审核','未发布','候选解析']);
  const reviewed=await f.request(`/question-drafts/${draft.id}/review`,{client:f.teacher,method:'POST',body:{revision:1,decision:'accept',note:'合成自动化测试确认，不是真人审题质量证据。',confirmed:true,checks:checks(draft.questions)}});check(`${profile}: review persists as isolated`,reviewed.data.status==='accepted_isolated');
  await pdf('reviewed','question-draft',draft.id,['教师已确认','仍隔离','保存版本 1','保存版本 2','不是真人审题']);
  const failed=(await f.request('/question-drafts/generate',{client:f.teacher,method:'POST',body:{requestId:crypto.randomUUID(),title:'未接模型的请求',subject:'math',sourceIds:[source.id],count:1,instructions:'合成问题',syntheticOnly:true}})).data;
  await pdf('unavailable','question-draft',failed.id,['生成服务不可用','NOT_CONFIGURED','没有发布']);await pdf('drafts','question-drafts',null,['未接模型的请求','仍隔离']);
  for(const role of ['student','parent','admin','teacher2']){const viewer=await open(role);for(const [kind,key]of [['draft-source',source.id],['question-draft',draft.id]]){await viewer.page.goto(url(kind,key));await viewer.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('导出失败'));check(`${profile}/${role}/${kind}: blocked`,await viewer.page.locator('#print').isDisabled());check(`${profile}/${role}/${kind}: no private contents`,!(await viewer.page.locator('#document').innerText()).includes('候选解析'));}}
  const empty=await open('teacher2');await empty.page.goto(url('question-drafts'));await empty.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('暂无可导出'));check(`${profile}: empty disabled`,await empty.page.locator('#print').isDisabled());
  await owner.page.route('**/api/v1/draft-exports?*',route=>route.abort('failed'));await owner.page.goto(url('draft-source',source.id));await owner.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('导出失败'));check(`${profile}: network failure disabled`,await owner.page.locator('#print').isDisabled());await owner.page.unroute('**/api/v1/draft-exports?*');
  await owner.page.goto(url('question-draft',draft.id));await owner.page.waitForSelector('#document[data-ready=true]');await owner.page.locator('#confirm').check();const admin=await f.login('admin');await f.request(`/admin/users/${f.teacher.id}`,{client:admin,method:'PATCH',body:{active:false}});await owner.page.locator('#print').click();await owner.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('导出失败'));check(`${profile}: deactivation before print clears contents`,await owner.page.locator('#print').isDisabled()&&!(await owner.page.locator('#document').innerText()).includes('候选解析'));
  await f.request(`/admin/users/${f.teacher.id}`,{client:admin,method:'PATCH',body:{active:true}});const restored=await f.login('teacher');await owner.context.addCookies([{name:'lp_session',value:restored.cookie.split('=')[1],url:f.env.APP_ORIGIN,httpOnly:true,sameSite:'Strict'}]);
  let signal,release;const captured=new Promise(r=>signal=r),gate=new Promise(r=>release=r);await owner.page.route('**/api/v1/draft-exports?*',async route=>{const response=await route.fetch();signal();await gate;await route.fulfill({response});});const navigation=owner.page.goto(url('question-draft',draft.id));await captured;const changed=await f.login('teacher2');await owner.context.addCookies([{name:'lp_session',value:changed.cookie.split('=')[1],url:f.env.APP_ORIGIN,httpOnly:true,sameSite:'Strict'}]);release();await navigation;await owner.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('导出失败'));check(`${profile}: old authorized response cannot appear after account switch`,!(await owner.page.locator('#document').innerText()).includes('候选解析'));await owner.page.unroute('**/api/v1/draft-exports?*');
  check(`${profile}: no browser errors`,errors.length===0);
 }finally{for(const c of contexts)await c.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}f.close();}
}}finally{await browser.close();await writeFile(join(out,'summary.json'),JSON.stringify({...results,passed:results.checks.length},null,2));}
console.log(`隔离打印加载器 ${results.checks.length} 项通过，生成 ${results.pdfs.length} 份实际PDF。正式网站入口待网站线程合入。`);
