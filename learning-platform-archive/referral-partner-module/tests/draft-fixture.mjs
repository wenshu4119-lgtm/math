import {createServer} from 'node:http';
import {fixture} from './helpers.mjs';
import {BRIDGE_CONTRACT} from '../src/draft-provider.mjs';
export const sourceBody=(overrides={})=>({requestId:crypto.randomUUID(),title:'原创合成分数资料',subject:'math',text:'合成资料，不含学生信息。\n分数加法先通分，再相加分子。\n1/2 + 1/4 = 3/4。',sourceLabel:'测试自编资料；并非核验教材',licenseDeclaration:'original_private',syntheticOnly:true,rightsConfirmed:true,...overrides});
export function sampleQuestion(s,overrides={}){return {topic:'分数加法',grade:7,phase:'practice',prompt:'计算 1/2 + 1/4。',options:['1/4','1/2','3/4','1'],correctOption:2,rationale:'通分为 2/4 + 1/4 = 3/4。',citations:[{sourceId:s.id,sourceVersion:s.version,digest:s.digest,lineStart:2,lineEnd:3,text:s.text.split('\n').slice(1,3).join('\n')}],...overrides};}
export const checks=questions=>questions.map(q=>({questionId:q.id,answer:true,rationale:true,source:true,ageAppropriate:true}));
export async function draftFixture(){
  const f=await fixture(),teacher=await f.login('teacher'),source=(await f.request('/draft-sources',{client:teacher,method:'POST',body:sourceBody()})).data;
  const body={requestId:crypto.randomUUID(),title:'待人工审核的合成候选',subject:'math',sourceIds:[source.id],questions:[sampleQuestion(source)]};
  return {...f,teacher,source,body,async create(overrides={}){return f.request('/question-drafts',{client:teacher,method:'POST',body:{...body,...overrides}});}};
}
export async function contractServer(handler){
  const requests=[];const server=createServer(async(req,res)=>{let chunks=[];for await(const c of req)chunks.push(c);const body=JSON.parse(Buffer.concat(chunks).toString());requests.push({body,authorization:req.headers.authorization});await handler(req,res,body);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const env={APP_ENV:'local',DRAFT_PROVIDER_URL:`http://127.0.0.1:${server.address().port}/candidate-bridge`,DRAFT_PROVIDER_TOKEN:'synthetic-transport-secret-only',DRAFT_PROVIDER_CONTRACT:BRIDGE_CONTRACT,DRAFT_PROVIDER_ALLOW_CALLS:'true',DRAFT_PROVIDER_COST_POLICY:'no_cost_confirmed',DRAFT_PROVIDER_KIND:'contract_fixture',DRAFT_PROVIDER_MODEL:'no-model-fixture',DRAFT_PROVIDER_REVISION:'test-contract-v1'};
  return {env,requests,async close(){server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
export const respond=(res,questions)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({contract:BRIDGE_CONTRACT,questions,usage:{inputTokens:null,outputTokens:null}}));};
