import {ApiError,fail} from './security.mjs';

export const BRIDGE_CONTRACT='junior-candidates-v1';
const descriptions={NOT_CONFIGURED:'候选题服务未配置',CALLS_DISABLED:'外部调用尚未授权启用',COST_POLICY_REQUIRED:'尚未确认无费用调用条件',CONFIGURATION_INVALID:'候选题服务配置不完整',UNVERIFIED_CONTRACT:'尚未确认桥接契约'};
export function trustedUrl(value,{endpoint=false}={}){
  let url;try{url=new URL(value);}catch{return null;}
  const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&loopback)))return null;
  if(!endpoint&&url.pathname!=='/')return null;
  return {url,loopback};
}
function config(env){
  if(!env.DRAFT_PROVIDER_URL)return {reason:'NOT_CONFIGURED'};
  if(env.DRAFT_PROVIDER_ALLOW_CALLS!=='true')return {reason:'CALLS_DISABLED'};
  if(env.DRAFT_PROVIDER_COST_POLICY!=='no_cost_confirmed')return {reason:'COST_POLICY_REQUIRED'};
  if(env.DRAFT_PROVIDER_CONTRACT!==BRIDGE_CONTRACT)return {reason:'UNVERIFIED_CONTRACT'};
  const endpoint=trustedUrl(env.DRAFT_PROVIDER_URL,{endpoint:true}),kind=env.DRAFT_PROVIDER_KIND;
  const safeLabel=v=>typeof v==='string'&&/^[A-Za-z0-9._:/-]{1,100}$/.test(v);
  if(!endpoint||!['deeptutor_bridge','model_bridge','contract_fixture'].includes(kind)||!safeLabel(env.DRAFT_PROVIDER_REVISION)||!safeLabel(env.DRAFT_PROVIDER_MODEL)||typeof env.DRAFT_PROVIDER_TOKEN!=='string'||env.DRAFT_PROVIDER_TOKEN.length<16||/[\r\n]/.test(env.DRAFT_PROVIDER_TOKEN))return {reason:'CONFIGURATION_INVALID'};
  if(kind==='contract_fixture'&&(env.APP_ENV!=='local'||!endpoint.loopback))return {reason:'CONFIGURATION_INVALID'};
  return {url:endpoint.url.href,kind,revision:env.DRAFT_PROVIDER_REVISION,model:env.DRAFT_PROVIDER_MODEL,token:env.DRAFT_PROVIDER_TOKEN};
}
export function draftCapabilities(env){
  const c=config(env);return {available:!c.reason,reason:c.reason||null,notice:c.reason?descriptions[c.reason]+'；不会返回模拟题目。':'仅生成隔离候选，仍须人工逐题审核；不参与成绩。',contract:BRIDGE_CONTRACT,provider:c.kind||null,model:c.model||null,providerRevision:c.revision||null,syntheticOnly:true,ragVerified:false,gradingAllowed:false};
}
export async function boundedJson(response,maxBytes=65536){
  if(!response.ok)fail(503,'PROVIDER_HTTP_ERROR','上游请求失败，未保存候选题');
  if(!response.headers.get('content-type')?.includes('application/json'))fail(502,'PROVIDER_OUTPUT_INVALID','上游输出不是约定JSON');
  if(Number(response.headers.get('content-length')||0)>maxBytes)fail(502,'PROVIDER_OUTPUT_TOO_LARGE','上游输出超过限制');
  const reader=response.body?.getReader();if(!reader)fail(502,'PROVIDER_OUTPUT_INVALID','上游未返回内容');
  let total=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>maxBytes){await reader.cancel();fail(502,'PROVIDER_OUTPUT_TOO_LARGE','上游输出超过限制');}parts.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail(502,'PROVIDER_OUTPUT_INVALID','上游JSON无法解析');}
}
export async function generateCandidates(env,input,{fetcher=fetch,timeoutMs=12000}={}){
  const c=config(env);if(c.reason)fail(503,c.reason,descriptions[c.reason]+'；没有生成替代结果');
  const timeout=Math.max(10,Math.min(12000,timeoutMs));const controller=new AbortController();
  let timer;const expired=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ApiError(504,'PROVIDER_TIMEOUT','候选题服务超时；不会自动重试'));},timeout);});
  try{
    // Sources are trusted server snapshots after owner/organization authorization.
    // No learner IDs, answers, arbitrary URLs, tools or upstream user tokens are accepted.
    const operation=(async()=>{
      const response=await fetcher(c.url,{method:'POST',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${c.token}`},body:JSON.stringify({...input,contract:BRIDGE_CONTRACT,model:c.model,providerRevision:c.revision,maxOutputTokens:2048,tools:[],syntheticOnly:true,gradingAllowed:false})});
      const output=await boundedJson(response);
      if(JSON.stringify(output).includes(c.token))fail(502,'PROVIDER_OUTPUT_INVALID','上游输出未通过安全校验');
      if(!output||output.contract!==BRIDGE_CONTRACT||Object.keys(output).some(k=>!['contract','questions','usage'].includes(k))||!Array.isArray(output.questions)||output.questions.length!==input.count)fail(502,'PROVIDER_OUTPUT_INVALID','上游输出与候选题契约不符');
      const usage=output.usage??{inputTokens:null,outputTokens:null};
      if(!usage||typeof usage!=='object'||Array.isArray(usage)||Object.keys(usage).some(k=>!['inputTokens','outputTokens'].includes(k))||['inputTokens','outputTokens'].some(k=>usage[k]!==null&&(!Number.isInteger(usage[k])||usage[k]<0||usage[k]>1000000)))fail(502,'PROVIDER_OUTPUT_INVALID','上游用量记录格式不正确');
      return {questions:output.questions,provenance:{kind:c.kind,contract:BRIDGE_CONTRACT,providerRevision:c.revision,model:c.model,transportExecuted:true,modelExecution:c.kind==='contract_fixture'?'not_executed_test_fixture':'provider_reported_unverified',usage,syntheticOnly:true,gradingAllowed:false}};
    })();
    return await Promise.race([operation,expired]);
  }catch(error){if(error instanceof ApiError)throw error;fail(503,'PROVIDER_FAILED','候选题服务不可用，未返回替代结果');}
  finally{clearTimeout(timer);controller.abort();}
}
