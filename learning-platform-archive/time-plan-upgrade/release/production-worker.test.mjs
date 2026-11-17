import test from'node:test';import assert from'node:assert/strict';import worker from'./production-worker.mjs';
const env={APP_ORIGIN:'https://mrxu.uk',PREVIEW_ORIGIN:'https://learning-platform-production.wenshu4119.workers.dev',BACKEND_ORIGIN:'https://earning-origin.mrxu.uk',BRIDGE_SECRET:'synthetic-bridge-credential',ASSETS:{fetch:()=>new Response('shell')}};
test('formal gateway accepts only designated hosts and persistent origin',async()=>{assert.equal((await worker.fetch(new Request('https://wrong.invalid/'),env)).status,403);assert.equal((await worker.fetch(new Request(env.APP_ORIGIN+'/api/v1/health'),{...env,BACKEND_ORIGIN:'https://random.trycloudflare.com'})).status,503);assert.equal((await worker.fetch(new Request(env.APP_ORIGIN+'/'),{...env,MAINTENANCE:'true'})).status,503);});
test('formal gateway pins transport origin and trusted originating host',async()=>{const previous=global.fetch;try{for(const origin of[env.APP_ORIGIN,env.PREVIEW_ORIGIN]){global.fetch=async(url,opts)=>{assert.equal(url,env.BACKEND_ORIGIN+'/api/v1/auth/session');assert.equal(opts.headers.get('x-learning-origin'),origin);assert.equal(opts.headers.get('x-trial-bridge'),env.BRIDGE_SECRET);assert.equal(opts.redirect,'manual');return Response.json({data:{synthetic:true}},{headers:{'Set-Cookie':'synthetic=1; Secure; HttpOnly'}});};const r=await worker.fetch(new Request(origin+'/api/v1/auth/session',{headers:{'X-Learning-Origin':'https://forged.invalid','X-Trial-Bridge':'fake'}}),env);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert(r.headers.get('Strict-Transport-Security'));}}finally{global.fetch=previous;}});
test('formal gateway refuses upstream redirects and non-API private binary paths',async()=>{const previous=global.fetch;try{global.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://untrusted.invalid'}});assert.equal((await worker.fetch(new Request(env.APP_ORIGIN+'/api/v1/health'),env)).status,503);global.fetch=async()=>new Response('bytes',{headers:{'Content-Type':'image/png'}});assert.equal((await worker.fetch(new Request(env.APP_ORIGIN+'/api/v1/auth/session'),env)).status,503);}finally{global.fetch=previous;}});
test('bank CSV remains authenticated upstream, no-store, and limited to its export route',async()=>{
 const previous=global.fetch;
 try{
  global.fetch=async()=>new Response('synthetic,csv',{headers:{'Content-Type':'text/csv;charset=utf-8'}});
  const response=await worker.fetch(new Request(env.APP_ORIGIN+'/api/v1/bank/questions/synthetic-id/export?format=csv'),env);
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal((await worker.fetch(new Request(env.APP_ORIGIN+'/api/v1/bank/questions/synthetic-id?format=csv'),env)).status,503);
  global.fetch=async()=>Response.json({error:{code:'UNAUTHENTICATED'}},{status:401});
  assert.equal((await worker.fetch(new Request(env.APP_ORIGIN+'/api/v1/bank/questions/synthetic-id/export?format=csv'),env)).status,401);
 }finally{global.fetch=previous;}
});
