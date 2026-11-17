import test from 'node:test';
import assert from 'node:assert/strict';
import {draftCapabilities,generateCandidates,BRIDGE_CONTRACT} from '../src/draft-provider.mjs';
import {inspectDeepTutor} from '../src/deeptutor-readonly.mjs';
const base={APP_ENV:'local',DRAFT_PROVIDER_URL:'http://127.0.0.1:1/test',DRAFT_PROVIDER_TOKEN:'synthetic-provider-secret',DRAFT_PROVIDER_CONTRACT:BRIDGE_CONTRACT,DRAFT_PROVIDER_ALLOW_CALLS:'true',DRAFT_PROVIDER_COST_POLICY:'no_cost_confirmed',DRAFT_PROVIDER_KIND:'contract_fixture',DRAFT_PROVIDER_MODEL:'no-actual-model',DRAFT_PROVIDER_REVISION:'fixture-v1'};
const input={requestId:'synthetic-request',subject:'math',count:1,instructions:'合成测试',sources:[]};
const output=()=>({contract:BRIDGE_CONTRACT,questions:[{fixtureOnly:true}],usage:{inputTokens:null,outputTokens:null}});
test('provider config fails closed without explicit enablement, cost policy and verified contract',async()=>{
  for(const [env,code]of [[{},'NOT_CONFIGURED'],[{...base,DRAFT_PROVIDER_ALLOW_CALLS:'false'},'CALLS_DISABLED'],[{...base,DRAFT_PROVIDER_COST_POLICY:''},'COST_POLICY_REQUIRED'],[{...base,DRAFT_PROVIDER_CONTRACT:'guessed'},'UNVERIFIED_CONTRACT'],[{...base,APP_ENV:'production'},'CONFIGURATION_INVALID'],[{...base,DRAFT_PROVIDER_URL:'http://169.254.169.254/'},'CONFIGURATION_INVALID'],[{...base,DRAFT_PROVIDER_URL:'https://user:pass@example.com/?key=x'},'CONFIGURATION_INVALID']]){
    let called=false;assert.equal(draftCapabilities(env).available,false);await assert.rejects(generateCandidates(env,input,{fetcher:()=>{called=true;}}),e=>e.code===code);assert.equal(called,false);
  }
});
test('provider timeout includes connection and streaming response and performs no retry',async()=>{
  let calls=0;const never=()=>{calls++;return new Promise(()=>{});};await assert.rejects(generateCandidates(base,input,{fetcher:never,timeoutMs:15}),e=>e.code==='PROVIDER_TIMEOUT');assert.equal(calls,1);
  const slowBody=new ReadableStream({start(){}});await assert.rejects(generateCandidates(base,input,{fetcher:async()=>new Response(slowBody,{headers:{'Content-Type':'application/json'}}),timeoutMs:15}),e=>e.code==='PROVIDER_TIMEOUT');
});
test('provider HTTP, wrong JSON, oversized streamed body and secret echo are rejected without raw errors',async()=>{
  const cases=[()=>new Response('synthetic-sensitive-error',{status:503}),()=>new Response('not json',{headers:{'Content-Type':'application/json'}}),()=>new Response('x'.repeat(65537),{headers:{'Content-Type':'application/json'}}),()=>Response.json({...output(),error:'synthetic-sensitive-error'}),()=>Response.json({...output(),questions:[{text:base.DRAFT_PROVIDER_TOKEN}]}),()=>Response.json({...output(),usage:{inputTokens:-1,outputTokens:0}})];
  for(const make of cases)await assert.rejects(generateCandidates(base,input,{fetcher:async()=>make()}),e=>e.status>=500&&!e.message.includes('sensitive')&&!e.message.includes(base.DRAFT_PROVIDER_TOKEN));
});
test('bridge fixes model and safety policy, sends auth only in header, and marks fixture honestly',async()=>{
  let call;const result=await generateCandidates(base,{...input,tools:['exec'],gradingAllowed:true,model:'override'},{fetcher:async(url,options)=>{call={url,options};return Response.json(output());}});
  const body=JSON.parse(call.options.body);assert.deepEqual(body.tools,[]);assert.equal(body.gradingAllowed,false);assert.equal(body.model,base.DRAFT_PROVIDER_MODEL);assert.equal(body.maxOutputTokens,2048);assert.equal(call.options.redirect,'error');assert(!call.options.body.includes(base.DRAFT_PROVIDER_TOKEN));assert.equal(result.provenance.modelExecution,'not_executed_test_fixture');
});
test('readonly DeepTutor adapter calls only health and schema, never infers model readiness',async()=>{
  const calls=[];const result=await inspectDeepTutor('http://127.0.0.1:8001',{fetcher:async(url,options)=>{calls.push({path:url.pathname,method:options.method});return Response.json(url.pathname==='/health/ready'?{status:'ready'}:{info:{version:'1.0.0'},paths:{'/api/knowledge-bases':{get:{}}}});}});
  assert.deepEqual(calls,[{path:'/health/ready',method:'GET'},{path:'/openapi.json',method:'GET'}]);assert.equal(result.modelConfigured,'unknown_from_health');assert.equal(result.ragVerified,false);assert.equal(result.generationExecuted,false);assert.equal(result.masteryRoutesPresent,false);
});
test('readonly adapter rejects paths, redirects/failures and timeout without secrets',async()=>{
  await assert.rejects(inspectDeepTutor('http://example.com/'),e=>e.code==='INVALID_PROVIDER_ORIGIN');await assert.rejects(inspectDeepTutor('http://127.0.0.1:8001/arbitrary'),e=>e.code==='INVALID_PROVIDER_ORIGIN');
  await assert.rejects(inspectDeepTutor('http://127.0.0.1:8001',{fetcher:async()=>{throw new Error('synthetic-secret');}}),e=>e.code==='DEEPTUTOR_READ_FAILED'&&!e.message.includes('synthetic-secret'));
  await assert.rejects(inspectDeepTutor('http://127.0.0.1:8001',{fetcher:()=>new Promise(()=>{}),timeoutMs:15}),e=>e.code==='DEEPTUTOR_TIMEOUT');
});
