import {timePlanRoutes} from './time-plans.mjs';
import { ApiError,authenticate,checkOrigin,fail,id,rateLimit,securityHeaders } from './security.mjs';
import { accountRoutes,login } from './accounts.mjs';
import { learningRoutes } from './learning.mjs';
import { uploadRoutes } from './uploads.mjs';
import { paperRoutes } from './papers.mjs';
import { capabilities,ocrRoutes } from './ocr.mjs';
import { homeworkRoutes } from './homeworks.mjs';
import { draftRoutes } from './draft-api.mjs';
import {bankRoutes,publicCoverage} from './question-bank.mjs';
import {deepTutorRoutes,publicDeepTutorStatus} from './deeptutor-api.mjs';
import {learningQaRoutes,publicLearningQaStatus} from './learning-qa.mjs';
import {artsRoutes,publicArtsCatalog} from './arts.mjs';
import {referralRoutes,publicReferralExampleRules} from './referral.mjs';
import {referralContactRoutes,publicReferralContactStatus} from './referral-contact.mjs';

async function publicAiStatus(env){
  const [lab,qa]=await Promise.all([publicDeepTutorStatus(env),publicLearningQaStatus(env)]);
  if(qa.status!=='limited')return lab;
  return {status:'limited',label:'DeepTutor 受保护学习问答已接入',message:'学生与教师可输入普通学习问题；范围限等式与一元一次方程方法、有理数基础运算、一般现在时be。AI解释待核对，无法可靠作答会明确拒答；未开放AI出题或正式评分。',capabilities:{questionAnswering:true,syntheticKnowledgeRetrieval:true,freeInput:true,generation:false,grading:false},scope:qa.scope,notice:qa.notice};
}

export async function handleApi(request,env) {
  const requestId=id();
  try {
    const url=new URL(request.url);
    if(!env.DB || !env.SESSION_SECRET || env.SESSION_SECRET.length<32 || env.SESSION_SECRET.startsWith('generate-') || !env.APP_ORIGIN) fail(503,'CONFIGURATION_REQUIRED','服务尚未安全配置');
    if(env.APP_ENV==='local' && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(env.APP_ORIGIN)) fail(503,'CONFIGURATION_REQUIRED','本地模式只能绑定回环地址');
    if(env.APP_ENV!=='local' && !env.APP_ORIGIN.startsWith('https://')) fail(503,'CONFIGURATION_REQUIRED','正式环境必须启用 HTTPS');
    if(url.origin!==env.APP_ORIGIN) fail(403,'ORIGIN_REJECTED','请求地址不允许');
    const path=url.pathname.replace(/^\/api\/v1(?=\/|$)/,'');
    if(!url.pathname.startsWith('/api/v1/')) fail(404,'NOT_FOUND','接口不存在');
    if(!['GET','POST','PATCH','DELETE'].includes(request.method)) fail(405,'METHOD_NOT_ALLOWED','请求方法不支持');
    if(!['GET','HEAD'].includes(request.method)) checkOrigin(request,env);
    let result,actorId=null;
    if(path==='/health' && request.method==='GET') {const status=await publicAiStatus(env);result={data:{status:'ok',apiVersion:'v1',ocr:capabilities(env).ocr.available?'local_available':'unavailable',ai:status.status==='limited'?(status.capabilities.freeInput?'limited_learning_qa':'limited_teacher_lab'):'unavailable',aiGeneration:'unavailable',aiFormalGrading:false,matching:'rule-v1'}};}
    else if(path==='/public/coverage' && request.method==='GET') result={data:await publicCoverage(env.DB)};
    else if(path==='/public/ai-status' && request.method==='GET') result={data:await publicAiStatus(env)};
    else if(path==='/public/learning-qa-status' && request.method==='GET') result={data:await publicLearningQaStatus(env)};
    else if(path==='/public/arts/catalog' && request.method==='GET') result={data:publicArtsCatalog()};
    else if(path==='/public/referral/contact-status' && request.method==='GET') result={data:publicReferralContactStatus()};
    else if(path==='/public/referral/example-rules' && request.method==='GET') result={data:publicReferralExampleRules()};
    else if(path==='/auth/login' && request.method==='POST') result=await login(request,env);
    else {
      const session=await authenticate(request,env),user=session.user;
      actorId=user.id;
      if(user.mustChangePassword&&!['/auth/session','/auth/password','/auth/logout'].includes(path))fail(403,'PASSWORD_CHANGE_REQUIRED','请先修改初始密码后使用工作台');
      if(request.method!=='GET') await rateLimit(env,`write:${user.id}`,60);
      if(path==='/uploads' && request.method==='POST') await rateLimit(env,`upload:${user.id}`,5);
      result=await accountRoutes(request,env,path,user,session)
        || await referralContactRoutes(request,env,path,user,url)
        || await referralRoutes(request,env,path,user,url)
        || await timePlanRoutes(request,env,path,user,url)
        || await artsRoutes(request,env,path,user,url)
        || await bankRoutes(request,env,path,user,url)
        || await learningQaRoutes(request,env,path,user,url)
        || await deepTutorRoutes(request,env,path,user,url)
        || await draftRoutes(request,env,path,user,url)
        || await learningRoutes(request,env,path,user,url)
        || await paperRoutes(request,env,path,user,url)
        || await homeworkRoutes(request,env,path,user,url)
        || await ocrRoutes(request,env,path,user)
        || await uploadRoutes(request,env,path,user,url);
    }
    if(!result) fail(404,'NOT_FOUND','接口不存在');
    const headers={...securityHeaders,'X-Request-Id':requestId,...(actorId?{'X-Actor-Id':actorId}:{}),...result.headers};
    if(result.raw) return new Response(result.raw,{headers,status:result.status||200});
    return Response.json({data:result.data},{status:result.status||200,headers});
  } catch(e) {
    // Never log request bodies, URLs with input, credentials, SQL errors or student data.
    const conflict=!(e instanceof ApiError) && /UNIQUE constraint|FOREIGN KEY constraint/.test(String(e.message));
    const status=e instanceof ApiError?e.status:conflict?409:500;
    const code=e instanceof ApiError?e.code:conflict?'CONFLICT':'INTERNAL_ERROR';
    if(status===500) console.error(JSON.stringify({event:'api_error',requestId,code}));
    return Response.json({error:{code,message:e instanceof ApiError?e.message:conflict?'记录已存在或状态已改变，请重新加载':'服务暂时出错，请凭请求编号联系管理员',requestId}},{status,headers:{...securityHeaders,'X-Request-Id':requestId,...(status===429?{'Retry-After':'60'}:{})}});
  }
}
