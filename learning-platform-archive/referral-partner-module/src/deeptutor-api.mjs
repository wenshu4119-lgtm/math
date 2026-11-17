import {ApiError,fail,jsonBody,requireRole,id,now,rateLimit,digest} from './security.mjs';
import {boundedJson} from './draft-provider.mjs';

const CONTRACT='deeptutor-synthetic-lab-v1';
export const LAB_PRESETS=[
 {id:'math-equation',title:'原创数学样例：x + 2 = 5',subject:'math'},
 {id:'english-be',title:'原创英语样例：She ___ a student（一般现在时）',subject:'english'},
 {id:'outside-scope',title:'范围外拒答回归：月球与地球的距离',subject:null}
];
const NOTICE='AI 可能出错。仅固定原创样例技术试用，未经过老师审核；不接收学生资料，不参与正式评分。';
const statusCache=new Map();
function configured(env){return env.DEEPTUTOR_LAB_ENABLED==='true'&&env.DEEPTUTOR_LAB_ORIGIN==='http://127.0.0.1:18083'&&typeof env.DEEPTUTOR_LAB_TOKEN==='string'&&/^[A-Za-z0-9_-]{43,100}$/.test(env.DEEPTUTOR_LAB_TOKEN);}
async function bridge(env,path,{method='GET',body,fetcher=fetch}={}){
 if(!configured(env))fail(503,'DEEPTUTOR_UNAVAILABLE','DeepTutor 教师实验室尚未接通，没有替代结果。');
 try{
  const res=await fetcher(env.DEEPTUTOR_LAB_ORIGIN+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${env.DEEPTUTOR_LAB_TOKEN}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(res.status===429)fail(429,'DEEPTUTOR_BUSY','模型正在处理其他实验，请稍后重试。');
  if(res.status===404&&path.startsWith('/jobs/'))fail(503,'DEEPTUTOR_JOB_EXPIRED','实验进程已重启或结果已过期，没有自动重试模型。');
  const value=await boundedJson(res,20000);
  if(JSON.stringify(value).includes(env.DEEPTUTOR_LAB_TOKEN))fail(502,'DEEPTUTOR_OUTPUT_INVALID','模型结果未通过安全校验。');
  return value;
 }catch(error){if(error instanceof ApiError)throw error;fail(503,'DEEPTUTOR_UNAVAILABLE','DeepTutor 实验服务不可用，没有替代结果。');}
}
export async function publicDeepTutorStatus(env,options={}){
 const key=digest(JSON.stringify([env.DEEPTUTOR_LAB_ENABLED,env.DEEPTUTOR_LAB_ORIGIN,env.DEEPTUTOR_LAB_TOKEN]));
 const prior=statusCache.get(key);
 if(prior&&prior.expiresAt>Date.now())return prior.value;
 const pending=readPublicStatus(env,options);
 if(statusCache.size>=4)statusCache.delete(statusCache.keys().next().value);
 statusCache.set(key,{expiresAt:Date.now()+15000,value:pending});
 return pending;
}
async function readPublicStatus(env,options){
 let ready=false;
 if(configured(env))try{const s=await bridge(env,'/status',options);ready=s.contract===CONTRACT&&s.status==='ready'&&s.syntheticOnly===true&&s.generation===false&&s.grading===false;}catch{}
 return {status:ready?'limited':'unavailable',label:ready?'DeepTutor 教师样例实验已接入':'DeepTutor 暂不可用',message:ready?'已连接自托管模型与知识库，仅供登录教师运行两个原创样例及拒答测试；完整自由问答和AI出题尚未开放。':'当前无法确认模型及知识库就绪；页面不会用模拟结果代替真实服务。',capabilities:{questionAnswering:ready,syntheticKnowledgeRetrieval:ready,generation:false,grading:false},scope:['等式性质原创样例','一般现在时 be 原创样例'],notice:NOTICE,checkedAt:now(),cacheMaxAgeSeconds:15};
}
const guard="EXISTS (SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=? AND u.org_id=? AND u.role='teacher' AND u.active=1 AND u.must_change_password=0 AND s.token_hash=? AND s.expires_at>?)";
function guardArgs(user){return [user.id,user.org_id,user.token_hash,Date.now()];}
async function activeTeacher(env,user){const active=await env.DB.prepare(`SELECT 1 AS ok WHERE ${guard}`).bind(...guardArgs(user)).first();if(!active)fail(404,'NOT_FOUND','教师授权或会话已失效');}
async function owned(env,user,key){const row=await env.DB.prepare(`SELECT * FROM deeptutor_lab_jobs WHERE id=? AND org_id=? AND owner_id=? AND ${guard}`).bind(key,user.org_id,user.id,...guardArgs(user)).first();if(!row)fail(404,'NOT_FOUND','实验不存在或无权访问');return row;}
function view(row){return {id:row.id,preset:row.preset,state:row.state,result:row.result_json?JSON.parse(row.result_json):null,createdAt:row.created_at,notice:NOTICE};}
function safeResult(value,preset){
 if(!value||value.contract!==CONTRACT||value.preset!==preset||value.syntheticOnly!==true||value.teacherReviewed!==false||value.gradingAllowed!==false||![0,1].includes(value.modelCalls)||!['answered','quarantined','no_match'].includes(value.outcome)||!Array.isArray(value.citations)||value.citations.length>2)fail(502,'DEEPTUTOR_OUTPUT_INVALID','实验输出未通过契约检查');
 const expected={'math-equation':'3','english-be':'is'};
 if(value.outcome==='answered'&&(typeof value.answer!=='string'||value.answer.trim().toLowerCase()!==expected[preset]||typeof value.explanation!=='string'||value.explanation.length>1800||value.automaticCheck!=='passed_for_fixed_example'))fail(502,'ANSWER_KEY_CONFLICT','模型答案不符合固定样例，已阻止返回成功结果');
 if(value.outcome!=='answered'&&value.answer!==null)fail(502,'DEEPTUTOR_OUTPUT_INVALID','隔离结果不能被当作答案');
 if(preset==='outside-scope'&&(value.outcome!=='no_match'||value.modelCalls!==0||value.citations.length))fail(502,'DEEPTUTOR_SCOPE_VIOLATION','范围外请求不允许调用模型或返回答案');
 const hashes={'stage9_math.txt':'4d988c88133bebcad031416113b53873b60a43f2e67593d5354b45d699943ce8','stage9_english.txt':'8ce22024e129fa44e3ce5bfb6e67eabce41775f7e1caa6730c229a7972d17f02'};
 const citations=value.citations.map(c=>{if(!c||hashes[c.source]!==c.sha256||typeof c.quote!=='string'||c.quote.length>3000||c.nativePageCitation!==false)fail(502,'DEEPTUTOR_CITATION_INVALID','引用不符合原创样例来源');return {source:c.source,sha256:c.sha256,quote:c.quote,nativePageCitation:false};});
 return {outcome:value.outcome,answer:value.answer,explanation:value.outcome==='answered'?value.explanation:null,automaticCheck:value.automaticCheck||null,citations,modelCalls:value.modelCalls,syntheticOnly:true,teacherReviewed:false,gradingAllowed:false,message:value.outcome==='quarantined'?'模型输出未通过固定样例自动检查，已隔离；不会用作答案或评分依据。':value.outcome==='no_match'?'问题超出受限样例范围或缺少对应证据，未调用模型。':NOTICE};
}
export async function deepTutorRoutes(request,env,path,user,url,options={}){
 if(!/^\/ai-lab(\/|$)/.test(path))return null;
 requireRole(user,'teacher');
 if(path==='/ai-lab/status'&&request.method==='GET'){
  if(url.search)fail(400,'INVALID_INPUT','状态接口不接受额外参数');
  const state=await publicDeepTutorStatus(env,options);await activeTeacher(env,user);return {data:{...state,presets:LAB_PRESETS}};
 }
 if(path==='/ai-lab/jobs'&&request.method==='POST'){
  const b=await jsonBody(request,['requestId','preset']);
  if(typeof b.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.requestId)||!LAB_PRESETS.some(p=>p.id===b.preset))fail(400,'INVALID_INPUT','请选择预设原创样例并使用请求UUID');
  const db=env.DB,previous=await db.prepare('SELECT id,preset FROM deeptutor_lab_jobs WHERE org_id=? AND owner_id=? AND request_id=?').bind(user.org_id,user.id,b.requestId).first();
  if(previous){const row=await owned(env,user,previous.id);if(row.preset!==b.preset)fail(409,'IDEMPOTENCY_CONFLICT','同一请求标识不能用于不同样例');return {data:view(row),status:row.state==='running'?202:200};}
  await activeTeacher(env,user);if(!configured(env))fail(503,'DEEPTUTOR_UNAVAILABLE','教师实验室暂不可用，没有调用模型。');
  await rateLimit(env,`deeptutor-lab:${user.id}`,6,3600000);
  const key=id(),at=now();
  await db.batch([
   db.prepare(`INSERT INTO deeptutor_lab_jobs (id,org_id,owner_id,request_id,preset,state,created_at,updated_at) SELECT ?,?,?,?,?,'created',?,? WHERE ${guard} ON CONFLICT(org_id,owner_id,request_id) DO NOTHING`).bind(key,user.org_id,user.id,b.requestId,b.preset,at,at,...guardArgs(user)),
   db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),user.org_id,user.id,'deeptutor_lab_requested',key,at)
  ]);
  const saved=await db.prepare('SELECT id FROM deeptutor_lab_jobs WHERE org_id=? AND owner_id=? AND request_id=?').bind(user.org_id,user.id,b.requestId).first();
  if(!saved)fail(404,'NOT_FOUND','教师授权已失效');if(saved.id!==key)return {data:view(await owned(env,user,saved.id)),status:202};
  let state='running',result=null;
  try{await activeTeacher(env,user);const output=await bridge(env,'/jobs',{...options,method:'POST',body:{jobId:key,preset:b.preset}});if(output.jobId!==key||!['running','completed'].includes(output.state))fail(502,'DEEPTUTOR_OUTPUT_INVALID','异步任务状态不正确');}
  catch(e){state='failed';result={outcome:'failed',code:e instanceof ApiError?e.code:'DEEPTUTOR_UNAVAILABLE',message:'真实实验未成功启动或响应未确认；不会自动重试，不返回模拟结果。'};}
  await db.prepare(`UPDATE deeptutor_lab_jobs SET state=?,result_json=?,updated_at=? WHERE id=? AND ${guard}`).bind(state,result?JSON.stringify(result):null,now(),key,...guardArgs(user)).run();
  return {data:view(await owned(env,user,key)),status:state==='running'?202:200};
 }
 const match=path.match(/^\/ai-lab\/jobs\/([0-9a-f-]{36})$/);
 if(match&&request.method==='GET'){
  if(url.search)fail(400,'INVALID_INPUT','实验查询不接受额外参数');
  let row=await owned(env,user,match[1]);
  if(['created','running'].includes(row.state)){
   let state=row.state,result=null;
   try{const job=await bridge(env,`/jobs/${row.id}`,options);if(job.jobId!==row.id||job.preset!==row.preset||!['running','completed','failed'].includes(job.state))fail(502,'DEEPTUTOR_OUTPUT_INVALID','异步任务不匹配');state=job.state;if(state==='completed')result=safeResult(job.result,row.preset);if(state==='failed')result={outcome:'failed',code:'DEEPTUTOR_EXECUTION_FAILED',message:'真实检索或模型执行失败，没有替代结果。'};}
   catch(e){state='failed';result={outcome:'failed',code:e instanceof ApiError?e.code:'DEEPTUTOR_UNAVAILABLE',message:'服务结果无法确认，未返回替代结果；不会自动重试。'};}
   if(state!==row.state)await env.DB.batch([
    env.DB.prepare(`UPDATE deeptutor_lab_jobs SET state=?,result_json=?,updated_at=? WHERE id=? AND state IN ('created','running') AND ${guard}`).bind(state,result?JSON.stringify(result):null,now(),row.id,...guardArgs(user)),
    env.DB.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),user.org_id,user.id,'deeptutor_lab_result',row.id,now())
   ]);
   row=await owned(env,user,row.id);
  }
  return {data:view(row)};
 }
 return null;
}
