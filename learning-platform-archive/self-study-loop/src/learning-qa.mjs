import {ApiError,fail,jsonBody,requireRole,id,now,rateLimit,digest,hmac} from './security.mjs';
import {boundedJson} from './draft-provider.mjs';
import sourceManifest from '../integrations/learning-qa/sources.json' with {type:'json'};
const CONTRACT='learning-qa-original-v1',TTL=1800000;
const NOTICE='AI 可能出错，回答尚未经老师审核，只供学习时核对；不读取学生档案或题库答案，不用于正式评分。';
const cache=new Map();
const privateInput=/\b\d{15,18}[xX]?\b|(?:\+?86[- ]?)?1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|姓名|手机号|身份证|家庭住址|学号|班级|我叫|学生叫|我的名字|my\s+name\s+is|student.?s?\s+(?:name|record|score)|\baddress\b/i;
function config(env){return env.LEARNING_QA_ENABLED==='true'&&env.LEARNING_QA_ORIGIN==='http://127.0.0.1:18084'&&typeof env.LEARNING_QA_TOKEN==='string'&&/^[A-Za-z0-9_-]{43,100}$/.test(env.LEARNING_QA_TOKEN);}
async function provider(env,path,{method='GET',body,fetcher=fetch}={}){
 if(!config(env))fail(503,'LEARNING_QA_DISABLED','学习问答尚未启用或已暂停，没有调用模型。');
 try{
  const res=await fetcher(env.LEARNING_QA_ORIGIN+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${env.LEARNING_QA_TOKEN}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(res.status===429)fail(429,'LEARNING_QA_BUSY','模型正在处理其他问题，请稍后重新提交。');
  if(res.status===404&&path.startsWith('/jobs/'))fail(410,'LEARNING_QA_EXPIRED','临时问答结果已过期或服务已重启，没有自动重试。');
  const value=await boundedJson(res,22000);
  if(JSON.stringify(value).includes(env.LEARNING_QA_TOKEN))fail(502,'LEARNING_QA_OUTPUT_INVALID','问答结果未通过安全检查。');
  return value;
 }catch(e){if(e instanceof ApiError)throw e;fail(503,'LEARNING_QA_UNAVAILABLE','学习问答暂不可用，没有返回替代答案。');}
}
export async function publicLearningQaStatus(env,options={}){
 const key=digest(JSON.stringify([env.LEARNING_QA_ENABLED,env.LEARNING_QA_ORIGIN,env.LEARNING_QA_TOKEN])),old=cache.get(key);
 if(old&&old.until>Date.now())return old.promise;
 const promise=(async()=>{let ready=false;if(config(env))try{const s=await provider(env,'/status',options);ready=s.contract===CONTRACT&&s.status==='ready'&&s.freeInput===true&&s.grading===false&&s.ttlSeconds===1800;}catch{}
 return {status:ready?'limited':'unavailable',freeInput:ready,roles:['teacher','student'],label:ready?'受保护学习问答已接入':'学习问答暂不可用',scope:['等式性质与一元一次方程方法','有理数基础四则运算','一般现在时 be 动词'],notice:NOTICE,retention:'问题与回答正文不写入平台数据库；临时问答结果缓存最多30分钟。仅本地模型处理，不发送外部服务。',maxCharacters:300,ttlSeconds:1800,checkedAt:now(),cacheMaxAgeSeconds:15,gradingAllowed:false};})();
 if(cache.size>=4)cache.delete(cache.keys().next().value);cache.set(key,{promise,until:Date.now()+15000});return promise;
}
const guard="EXISTS (SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=? AND u.org_id=? AND u.role IN ('teacher','student') AND u.active=1 AND u.must_change_password=0 AND s.token_hash=? AND s.expires_at>?)";
const args=u=>[u.id,u.org_id,u.token_hash,Date.now()];
async function active(env,u){if(!await env.DB.prepare(`SELECT 1 AS ok WHERE ${guard}`).bind(...args(u)).first())fail(404,'NOT_FOUND','当前账号授权或会话已失效');}
async function owned(env,u,key){const r=await env.DB.prepare(`SELECT * FROM learning_qa_jobs WHERE id=? AND org_id=? AND owner_id=? AND ${guard}`).bind(key,u.org_id,u.id,...args(u)).first();if(!r)fail(404,'NOT_FOUND','问答任务不存在或无权访问');return r;}
function view(row,result=null){return {id:row.id,subject:row.subject,state:row.state,createdAt:row.created_at,expiresAt:row.expires_at,outcome:row.outcome||null,result,notice:NOTICE};}
function validateResult(value,subject){
 if(!value||value.contract!==CONTRACT||value.subject!==subject||value.teacherReviewed!==false||value.gradingAllowed!==false||![0,1].includes(value.modelCalls)||!['refused','unreliable','needs_verification'].includes(value.outcome)||!Array.isArray(value.citations)||value.citations.length>4)fail(502,'LEARNING_QA_OUTPUT_INVALID','问答输出格式不正确。');
 if(value.outcome==='needs_verification'&&(value.modelCalls!==1||typeof value.answer!=='string'||value.answer.length<(value.automaticCheck==='specific_answer_checked'?1:5)||value.answer.length>1800||privateInput.test(value.answer)))fail(502,'LEARNING_QA_OUTPUT_INVALID','问答文本未通过检查。');
 if(value.outcome!=='needs_verification'&&value.answer!==null)fail(502,'LEARNING_QA_OUTPUT_INVALID','拒答或不可靠结果不得提供替代答案。');
 const citations=value.citations.map(c=>{const source=sourceManifest.sources.find(s=>s.id===c.sourceId&&s.subject===subject);if(!source||c.digest!==source.digest||typeof c.quote!=='string'||c.quote.length<10||c.quote.length>3500||!source.text.includes(c.quote)||c.nativePageCitation!==false)fail(502,'LEARNING_QA_CITATION_INVALID','引用不能定位到已核对的原创讲解。');return {sourceId:source.id,title:source.title,digest:source.digest,quote:c.quote,nativePageCitation:false};});
 if(value.outcome==='needs_verification'&&!citations.length)fail(502,'LEARNING_QA_CITATION_INVALID','模型回答缺少经核对的原创证据。');
 if(value.outcome==='refused'&&value.modelCalls!==0)fail(502,'LEARNING_QA_SCOPE_INVALID','范围拒答的调用记录不一致。');
 return {outcome:value.outcome,answer:value.answer,citations,modelCalls:value.modelCalls,teacherReviewed:false,gradingAllowed:false,automaticCheck:typeof value.automaticCheck==='string'?value.automaticCheck:null,reason:typeof value.reason==='string'&&/^[A-Z_]{1,60}$/.test(value.reason)?value.reason:null,message:value.outcome==='refused'?'当前范围或隐私检查不允许回答；未调用模型。':value.outcome==='unreliable'?'模型结果未通过可靠性检查，无法可靠回答；没有用预设答案代替。':NOTICE};
}
async function recordState(env,u,row,state,outcome,resultHash=null){
 const at=now();await env.DB.batch([
  env.DB.prepare(`UPDATE learning_qa_jobs SET state=?,outcome=?,result_digest=COALESCE(?,result_digest),updated_at=? WHERE id=? AND state=? AND ${guard}`).bind(state,outcome,resultHash,at,row.id,row.state,...args(u)),
  env.DB.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),u.org_id,u.id,'learning_qa_state',row.id,at)
 ]);
}
export async function learningQaRoutes(request,env,path,user,url,options={}){
 if(!/^\/learning-qa(?:\/|$)/.test(path))return null;requireRole(user,'teacher','student');
 if(path==='/learning-qa/status'&&request.method==='GET'){if(url.search)fail(400,'INVALID_INPUT','状态接口不接受参数');const status=await publicLearningQaStatus(env,options);await active(env,user);return {data:status};}
 if(path==='/learning-qa/jobs'&&request.method==='POST'){
  const b=await jsonBody(request,['requestId','subject','question','noPersonalDataConfirmed']);
  if(typeof b.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.requestId)||!['math','english'].includes(b.subject)||typeof b.question!=='string'||b.noPersonalDataConfirmed!==true)fail(400,'INVALID_INPUT','请选择学科、输入学习问题并确认不含个人资料。');
  const question=b.question.normalize('NFKC').trim();if(question.length<5||question.length>300||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(question))fail(400,'INVALID_INPUT','问题须为5至300字普通文本。');
  if(privateInput.test(question))fail(400,'PRIVATE_DATA_NOT_ALLOWED','请移除姓名、联系方式、学号或个人记录；这里只接受普通学习问题。');
  const fingerprint=hmac(env.SESSION_SECRET,JSON.stringify([user.id,b.subject,question])),db=env.DB;
  const prior=await db.prepare('SELECT id FROM learning_qa_jobs WHERE org_id=? AND owner_id=? AND request_id=?').bind(user.org_id,user.id,b.requestId).first();
  if(prior){const row=await owned(env,user,prior.id);if(row.question_digest!==fingerprint)fail(409,'IDEMPOTENCY_CONFLICT','同一请求编号不能用于其他问题。');return {data:view(row),status:['created','running'].includes(row.state)?202:200};}
  await active(env,user);if(!config(env))fail(503,'LEARNING_QA_DISABLED','学习问答已暂停或尚未配置，没有调用模型。');await rateLimit(env,`learning-qa:${user.id}`,8,3600000);
  const key=id(),at=now();await db.batch([
   db.prepare(`INSERT INTO learning_qa_jobs (id,org_id,owner_id,request_id,question_digest,subject,state,created_at,updated_at,expires_at) SELECT ?,?,?,?,?,?,'created',?,?,? WHERE ${guard} ON CONFLICT(org_id,owner_id,request_id) DO NOTHING`).bind(key,user.org_id,user.id,b.requestId,fingerprint,b.subject,at,at,Date.now()+TTL,...args(user)),
   db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),user.org_id,user.id,'learning_qa_requested',key,at)
  ]);
  const saved=await db.prepare('SELECT id FROM learning_qa_jobs WHERE org_id=? AND owner_id=? AND request_id=?').bind(user.org_id,user.id,b.requestId).first();if(!saved)fail(404,'NOT_FOUND','授权已失效');if(saved.id!==key)return {data:view(await owned(env,user,saved.id)),status:202};
  const row=await owned(env,user,key);let state='running',outcome=null;
  try{await active(env,user);const response=await provider(env,'/jobs',{...options,method:'POST',body:{jobId:key,subject:b.subject,question}});if(response.jobId!==key||!['running','completed'].includes(response.state))fail(502,'LEARNING_QA_OUTPUT_INVALID','任务响应不匹配');}
  catch{state='failed';outcome='unavailable';}
  await recordState(env,user,row,state,outcome);return {data:view(await owned(env,user,key)),status:state==='running'?202:200};
 }
 const match=path.match(/^\/learning-qa\/jobs\/([0-9a-f-]{36})$/);
 if(match&&request.method==='GET'){
  if(url.search)fail(400,'INVALID_INPUT','任务查询不接受附加参数');let row=await owned(env,user,match[1]);
  if(row.expires_at<=Date.now()){await env.DB.prepare(`UPDATE learning_qa_jobs SET state='expired',updated_at=? WHERE id=? AND ${guard}`).bind(now(),row.id,...args(user)).run();await active(env,user);fail(410,'LEARNING_QA_EXPIRED','临时结果已过期；只保留请求摘要与状态。');}
  if(row.state==='failed'||row.state==='expired')return {data:view(row)};
  let result=null,state='completed',outcome=null,resultHash=null;
  try{const job=await provider(env,'/jobs/'+row.id,options);if(job.jobId!==row.id||job.subject!==row.subject||!['running','completed','failed'].includes(job.state))fail(502,'LEARNING_QA_OUTPUT_INVALID','任务响应不匹配');state=job.state;if(state==='completed'){result=validateResult(job.result,row.subject);resultHash=digest(JSON.stringify(result));outcome=result.outcome;if(row.result_digest&&row.result_digest!==resultHash)fail(502,'LEARNING_QA_RESULT_CHANGED','结果摘要不一致。');}if(state==='failed')outcome='unavailable';}
  catch(e){state=e instanceof ApiError&&e.status===410?'expired':'failed';outcome=e instanceof ApiError&&e.code==='LEARNING_QA_RESULT_CHANGED'?'invalid_result':'unavailable';result=null;resultHash=null;}
  if(state!==row.state)await recordState(env,user,row,state,outcome,resultHash);
  row=await owned(env,user,row.id);return {data:view(row,result)};
 }
 return null;
}
