import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker-vps.mjs';
const origin='https://trial.invalid';
const env={APP_ORIGIN:origin,TRIAL_BACKEND_ORIGIN:'https://synthetic-test.trycloudflare.com',BRIDGE_SECRET:'synthetic-transport-secret',ASSETS:{fetch:()=>new Response('Public asset')}};
test('maintenance and missing backend fail closed',async()=>{
 for(const config of [{...env,TRIAL_PAUSED:'true'},{...env,BRIDGE_SECRET:''},{...env,TRIAL_BACKEND_ORIGIN:'http://untrusted.invalid'}])assert.equal((await worker.fetch(new Request(origin+'/api/v1/health'),config)).status,503);
});
test('origin cannot be changed by a client',async()=>assert.equal((await worker.fetch(new Request('https://wrong.invalid/api/v1/auth/session'),env)).status,403));
test('bridge overwrites untrusted forwarding headers and never follows redirects',async()=>{
 const previous=global.fetch;try{global.fetch=async(url,options)=>{assert.equal(options.headers.get('X-Trial-Bridge'),env.BRIDGE_SECRET);assert.equal(options.headers.get('X-Trial-Client-IP'),'198.51.100.11');assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://untrusted.invalid/'}});};const r=await worker.fetch(new Request(origin+'/api/v1/auth/session',{headers:{'X-Trial-Bridge':'forged','X-Trial-Client-IP':'forged','CF-Connecting-IP':'198.51.100.11'}}),env);assert.equal(r.status,503);assert(!JSON.stringify(await r.json()).includes(env.BRIDGE_SECRET));}finally{global.fetch=previous;}
});
test('upstream HTML and transport failure become explicit service failure',async()=>{
 const previous=global.fetch;try{for(const response of [()=>new Response('<html>failure</html>',{status:502}),()=>{throw Error('network');}]){global.fetch=response;assert.equal((await worker.fetch(new Request(origin+'/api/v1/health'),env)).status,503);}}finally{global.fetch=previous;}
});
test('public shell remains CSP protected and noncacheable',async()=>{const r=await worker.fetch(new Request(origin+'/'),env);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert(r.headers.get('Content-Security-Policy').includes("script-src 'self'"));});
test('only authorized image and draft CSV routes may return non-JSON',async()=>{
 const previous=global.fetch;try{
  for(const [path,type,expected]of[['/api/v1/uploads/synthetic-id/image','image/png',200],['/api/v1/auth/session','image/png',503],['/api/v1/draft-exports?kind=question-draft&id=x&format=csv','text/csv',200],['/api/v1/draft-exports?format=json','text/csv',503]]){
   global.fetch=async()=>new Response('synthetic payload',{headers:{'Content-Type':type}});const r=await worker.fetch(new Request(origin+path),env);assert.equal(r.status,expected);assert.equal(r.headers.get('Cache-Control'),'no-store');
  }
 }finally{global.fetch=previous;}
});
