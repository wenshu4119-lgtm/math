import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the real shared monitor and page scripts against an isolated DOM/fetch fixture.
// This does not claim real browser, BFCache, system-print or device coverage.
class Target {
  listeners=new Map();
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  dispatch(name,event={}){for(const fn of [...this.listeners.get(name)||[]])fn(event);}
}
class Element extends Target {
  constructor(tag='div'){
    super();this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.textContent='';this.className='';this.isConnected=true;this.value='';
    const classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),contains:x=>classes.has(x)};
  }
  append(...nodes){for(const node of nodes){if(node instanceof Element)node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){for(const node of this.children)if(node instanceof Element)node.isConnected=false;this.children=[];this.textContent='';this.append(...nodes);}
  setAttribute(name,value){this.attributes[name]=value;if(name==='value')this.value=value;if(name==='id')this.id=value;if(name==='class')this.className=value;}
  querySelectorAll(){return [];}
  querySelector(){return null;}
  remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
  get options(){return this.children;}
}
const find=(root,predicate)=>predicate(root)?root:root.children?.map(x=>x instanceof Element?find(x,predicate):null).find(Boolean)||null;
const files=['question-bank.js','ai-lab.js','learning-qa.js'];
const question={id:'synthetic-question',revision:1,subject:'math',grade:7,difficulty:'low',knowledgeDifficulty:'low',purposes:['practice'],knowledgeTitle:'合成测试',reviewStatus:'pending_human',prompt:'合成题干',options:['甲','乙','丙','丁'],correctOption:0,rationale:'合成解析',sourceLabel:'synthetic',license:'synthetic',textbookScope:'synthetic',region:'synthetic',sourceReferences:[]};
const response=(data,actor='actor-one')=>Response.json({data},{headers:actor?{'X-Actor-Id':actor}:{}});
async function fixture(file){
  const bank=file==='question-bank.js',qa=file==='learning-qa.js',root=new Element('main'),body=new Element('body'),document=new Target(),window=new Target();
  body.append(root);document.visibilityState='visible';document.body=body;
  document.querySelector=selector=>selector==='.print-document'?find(body,node=>node.className==='print-document'):root;
  document.getElementById=id=>find(body,node=>node.id===id);
  document.createElement=tag=>new Element(tag);
  document.createTextNode=text=>text;
  document.createDocumentFragment=()=>new Element('fragment');
  let clock=Date.now(),reloads=0,printCalls=0;const timeouts=new Map();let timerId=0;
  class Clock extends Date {static now(){return clock;}}
  const session={user:{id:'actor-one',role:'teacher',mustChangePassword:false},csrfToken:'synthetic-csrf'};
  const defaultFetch=async url=>{
    const path=String(url);
    if(path.includes('/auth/session'))return response(session);
    if(path.includes('/bank/questions/synthetic-question'))return response(question);
    if(path.includes('/bank/questions'))return response({items:[],total:0});
    if(path.includes('/ai-lab/status'))return response({label:'合成测试',message:'test',notice:'test',presets:[],status:'unavailable'});
    if(path.includes('/learning-qa/status'))return response({label:'合成测试',scope:[],retention:'test',status:'unavailable'});
    return response({ok:true});
  };
  const context=vm.createContext({document,window,location:{pathname:bank?'/question-bank.html':'/'+file.replace('.js','.html'),reload(){reloads++;}},AbortController,DOMException,URL,URLSearchParams,Response,Headers,Date:Clock,Set,Object,Array,JSON,console,crypto:{randomUUID:()=>crypto.randomUUID()},BroadcastChannel:class{postMessage(){}},localStorage:{setItem(){}},fractionSegments:value=>[{text:value}],setInterval(){return ++timerId;},clearInterval(){},setTimeout(fn){const id=++timerId;timeouts.set(id,fn);return id;},clearTimeout(id){timeouts.delete(id);},fetch:defaultFetch,question});
  window.print=()=>{printCalls++;window.dispatch('beforeprint',{target:window});};
  const helper=fs.readFileSync(new URL('../public/session-guard.js',import.meta.url),'utf8').replace(/^export /gm,'');
  const page=fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  const probe=`globalThis.probe=()=>({actor:${bank?'actor':'user'},csrf,job:${bank?'null':'jobId'},intent:${qa?'intent':'null'},monitorActor:monitor.actorId${bank?',ticket:printTicket':''}});`;
  vm.runInContext(helper+'\n'+page+'\n'+probe,context);
  await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(context.probe().actor?.id,'actor-one');assert.equal(context.probe().monitorActor,'actor-one');
  return {context,root,body,document,window,bank,qa,defaultFetch,run:code=>vm.runInContext(code,context),signal(){window.dispatch('storage',{key:'learning.session.invalidate.v1',newValue:JSON.stringify({v:1,kind:'invalidate',nonce:'fixture_nonce_123456',at:clock})});},advance(ms){clock+=ms;},get reloads(){return reloads;},get printCalls(){return printCalls;}};
}
const invalidResponses=[
  {name:'401',status:401,body:'{}',headers:{}},
  {name:'HTML 403',status:403,body:'<html>forbidden</html>',headers:{}},
  {name:'HTML 404',status:404,body:'<html>not found</html>',headers:{}},
  {name:'malformed JSON',status:200,body:'invalid json',headers:{'X-Actor-Id':'actor-one'}},
  {name:'missing actor',status:200,body:'{"data":{}}',headers:{}},
  {name:'changed actor',status:200,body:'{"data":{}}',headers:{'X-Actor-Id':'actor-two'}},
  {name:'null envelope',status:200,body:'null',headers:{'X-Actor-Id':'actor-one'}},
  {name:'missing data envelope',status:200,body:'{}',headers:{'X-Actor-Id':'actor-one'}},
  {name:'revoked access code',status:409,body:'{"error":{"code":"ACCESS_OR_VERSION_CHANGED"}}',headers:{}},
  {name:'session identity mismatch',path:'/auth/session',status:200,body:'{"data":{"user":{"id":"actor-two"}}}',headers:{'X-Actor-Id':'actor-one'}}
];
for(const file of files){
  for(const item of invalidResponses)test(`${file}: ${item.name} clears private state before reuse`,async()=>{
    const f=await fixture(file);f.root.replaceChildren('PRIVATE_SENTINEL');if(!f.bank)f.run("jobId='old-job';"+(f.qa?"intent={question:'old question'};":''));
    f.context.fetch=async()=>new Response(item.body,{status:item.status,headers:item.headers});
    await assert.rejects(()=>f.run(`api(${JSON.stringify(item.path||'/private-record')})`));
    assert.equal(f.context.probe().actor,null);assert.equal(f.context.probe().monitorActor,null);assert.ok(!f.context.probe().csrf);assert.equal(f.context.probe().job,null);assert.equal(f.context.probe().intent,null);assert.ok(!f.root.children.includes('PRIVATE_SENTINEL'));
  });
  test(`${file}: valid response keeps the authenticated binding`,async()=>{
    const f=await fixture(file);assert.equal((await f.run("api('/private-record')")).ok,true);assert.equal(f.context.probe().monitorActor,'actor-one');
  });
  test(`${file}: actual shared signal clears identity and pending state`,async()=>{
    const f=await fixture(file);f.root.replaceChildren('PRIVATE_SENTINEL');if(!f.bank)f.run("jobId='old-job';"+(f.qa?"intent={question:'old question'};":''));f.body.classList.add('print-authorized');f.signal();
    assert.equal(f.context.probe().actor,null);assert.equal(f.context.probe().job,null);assert.equal(f.context.probe().intent,null);assert.ok(!f.root.children.includes('PRIVATE_SENTINEL'));if(f.bank)assert.equal(f.body.classList.contains('print-authorized'),false);
  });
  test(`${file}: hidden lifecycle clears and visible resume reloads`,async()=>{
    const f=await fixture(file);f.document.visibilityState='hidden';f.document.dispatch('visibilitychange');assert.equal(f.context.probe().actor,null);f.document.visibilityState='visible';f.document.dispatch('visibilitychange');assert.equal(f.reloads,1);
  });
  test(`${file}: body completing after invalidation cannot return private data`,async()=>{
    const f=await fixture(file);f.context.fetch=async()=>({status:200,ok:true,headers:new Headers({'X-Actor-Id':'actor-one'}),async json(){f.signal();return {data:{private:'old'}};}});
    await assert.rejects(()=>f.run("api('/private-record')"));assert.equal(f.context.probe().actor,null);
  });
}
test('AI private HTML uses shared deny-print CSS while bank retains its dedicated print gate',()=>{
  for(const name of ['ai-lab.html','learning-qa.html']){const html=fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');assert.ok(html.includes('body class="session-private"'));assert.ok(html.includes('href="/session-guard.css"'));}
  for(const name of ['question-bank.html','bank-practice.html']){const html=fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');assert.ok(html.includes('href="/session-guard.css"'));assert.ok(!html.includes('body class="session-private"'));}
});
test('bank direct beforeprint without a fresh ticket remains denied',async()=>{
  const f=await fixture('question-bank.js');f.body.classList.add('print-authorized');f.window.dispatch('beforeprint');assert.equal(f.body.classList.contains('print-authorized'),false);assert.equal(f.context.probe().ticket,null);
});
test('bank fresh print ticket is consumed once and cleared after print',async()=>{
  const f=await fixture('question-bank.js');let first=false,used=false,second=true;f.window.print=()=>{f.window.dispatch('beforeprint');first=f.body.classList.contains('print-authorized');used=f.context.probe().ticket.used;f.window.dispatch('beforeprint');second=f.body.classList.contains('print-authorized');};await f.run('printQuestion(question)');assert.equal(first,true);assert.equal(used,true);assert.equal(second,false);assert.equal(f.context.probe().ticket,null);
});
test('bank five-second ticket expires before the print event',async()=>{
  const f=await fixture('question-bank.js');let permitted=true;f.window.print=()=>{f.advance(5001);f.window.dispatch('beforeprint');permitted=f.body.classList.contains('print-authorized');};await f.run('printQuestion(question)');assert.equal(permitted,false);assert.equal(f.context.probe().ticket,null);
});
test('bank signal after fresh read but before printing revokes the ticket',async()=>{
  const f=await fixture('question-bank.js');let permitted=true;f.window.print=()=>{f.signal();f.window.dispatch('beforeprint');permitted=f.body.classList.contains('print-authorized');};await f.run('printQuestion(question)');assert.equal(permitted,false);assert.equal(f.context.probe().actor,null);assert.equal(f.context.probe().ticket,null);
});
test('bank refuses print before issuing a ticket when fresh permission is rejected',async()=>{
  const f=await fixture('question-bank.js');f.context.fetch=async()=>new Response('forbidden',{status:403});await assert.rejects(()=>f.run('printQuestion(question)'));assert.equal(f.printCalls,0);assert.equal(f.context.probe().ticket,null);assert.equal(f.body.classList.contains('print-authorized'),false);
});
for(const type of ['text/html','application/json','text/plain',null])test(`bank CSV rejects ${type||'missing content type'} despite a correct actor`,async()=>{
  const f=await fixture('question-bank.js');let blobs=0;f.context.URL=class extends URL{static createObjectURL(){blobs++;return 'blob:synthetic';}};
  f.context.fetch=async url=>String(url).includes('/export?')?new Response(new Uint8Array([60,104,116,109,108,62]),{headers:{'X-Actor-Id':'actor-one',...(type?{'Content-Type':type}:{})}}):f.defaultFetch(url);
  await assert.rejects(()=>f.run("download(question,'csv')"));assert.equal(f.context.probe().actor,null);assert.equal(blobs,0);
});
test('bank CSV with expected MIME and fresh authorization downloads normally',async()=>{
  const f=await fixture('question-bank.js');let downloaded=0,blob=null;f.context.Blob=Blob;f.context.URL=class extends URL{static createObjectURL(value){blob=value;return 'blob:synthetic';}static revokeObjectURL(){}};
  f.document.createElement=tag=>{const node=new Element(tag);node.click=()=>{downloaded++;};return node;};
  f.context.fetch=async url=>String(url).includes('/export?')?new Response('simulation,answer\r\ntrue,A',{headers:{'X-Actor-Id':'actor-one','Content-Type':'text/csv; charset=utf-8'}}):f.defaultFetch(url);
  await f.run("download(question,'csv')");assert.equal(downloaded,1);assert.equal(await blob.text(),'simulation,answer\r\ntrue,A');assert.equal(f.context.probe().actor?.id,'actor-one');
});
test('bank CSV body arriving after session invalidation cannot create a download',async()=>{
  const f=await fixture('question-bank.js');let blobs=0;f.context.URL=class extends URL{static createObjectURL(){blobs++;return 'blob:synthetic';}};
  f.context.fetch=async url=>String(url).includes('/export?')?{status:200,ok:true,headers:new Headers({'X-Actor-Id':'actor-one','Content-Type':'text/csv'}),async text(){f.signal();return 'private,old';}}:f.defaultFetch(url);
  await assert.rejects(()=>f.run("download(question,'csv')"));assert.equal(f.context.probe().actor,null);assert.equal(blobs,0);
});
