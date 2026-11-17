import {boundedJson,trustedUrl} from './draft-provider.mjs';
import {fail,ApiError} from './security.mjs';

// Actual deployment health and schema only. Never invokes preflight, model tests,
// indexing, generation, uploads or an arbitrary caller-provided API path.
export async function inspectDeepTutor(baseUrl,{fetcher=fetch,timeoutMs=5000}={}){
  const configured=trustedUrl(baseUrl);if(!configured)fail(400,'INVALID_PROVIDER_ORIGIN','只读DeepTutor地址必须是受控HTTPS或回环源站');
  const controller=new AbortController();let timer;
  const expired=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ApiError(504,'DEEPTUTOR_TIMEOUT','DeepTutor只读检查超时'));},Math.min(Math.max(10,timeoutMs),10000));});
  try{
    return await Promise.race([(async()=>{
      const options={method:'GET',redirect:'error',signal:controller.signal};
      const health=await boundedJson(await fetcher(new URL('/health/ready',baseUrl),options),4096);
      const schema=await boundedJson(await fetcher(new URL('/openapi.json',baseUrl),options),2000000);
      if(!schema.paths||typeof schema.paths!=='object'||health.status!=='ready')fail(503,'DEEPTUTOR_NOT_READY','DeepTutor基础服务未就绪');
      return {status:'ready',schemaVersion:typeof schema.info?.version==='string'?schema.info.version:null,knowledgeRoutesPresent:Boolean(schema.paths['/api/knowledge-bases']),masteryRoutesPresent:Boolean(schema.paths['/api/mastery-paths/topics']),questionHttpRoutePresent:Boolean(schema.paths['/api/questions']),modelConfigured:'unknown_from_health',ragVerified:false,generationExecuted:false,modelRequests:0,notice:'就绪和路由存在不代表模型/嵌入可用；WS路由不由OpenAPI证明。'};
    })(),expired]);
  }catch(error){if(error instanceof ApiError)throw error;fail(503,'DEEPTUTOR_READ_FAILED','DeepTutor只读检查失败');}finally{clearTimeout(timer);controller.abort();}
}
