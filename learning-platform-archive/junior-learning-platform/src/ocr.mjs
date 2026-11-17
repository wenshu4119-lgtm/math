import {ApiError,allowStudent,audit,digest,fail,id,jsonBody,now,rateLimit,readLimited,requireRole,textField} from './security.mjs';
const message='OCR只提供未审核文字，置信度不是正确率。公式、题号、分值和手写内容须人工核对；不会生成答案、评分或诊断。';
const safeFailure=new Set(['OCR_FAILED','OCR_TIMEOUT','OCR_BUSY','OCR_OUTPUT_TOO_LARGE','OCR_EMPTY','OCR_LANGUAGE_UNSUPPORTED']);
function publicProvider(raw){if(!raw||typeof raw.id!=='string'||typeof raw.version!=='string')return null;return {id:raw.id.slice(0,60),version:raw.version.slice(0,30),languages:Array.isArray(raw.languages)?raw.languages.filter(x=>['eng','chi_sim+eng'].includes(x)):[],modelRevision:typeof raw.modelRevision==='string'?raw.modelRevision.slice(0,64):null,mode:raw.mode==='local-only'?'local-only':'adapter',networkImagesSent:raw.networkImagesSent===false?false:null};}
async function recoverStale(db,uploadId){await db.prepare("UPDATE ocr_runs SET status='failed',error_code='OCR_INTERRUPTED',completed_at=? WHERE upload_id=? AND status='running' AND created_at<?").bind(now(),uploadId,new Date(Date.now()-120000).toISOString()).run();}
async function uploadFor(env,user,uid){const upload=await env.DB.prepare('SELECT * FROM uploads WHERE id=? AND org_id=? AND expires_at>?').bind(uid,user.org_id,Date.now()).first();if(!upload)fail(404,'NOT_FOUND','原图不存在或已过期');await allowStudent(env,user,upload.student_id);return upload;}
async function runFor(env,user,rid){let row=await env.DB.prepare('SELECT r.*,u.expires_at FROM ocr_runs r JOIN uploads u ON u.id=r.upload_id WHERE r.id=? AND r.org_id=? AND u.expires_at>?').bind(rid,user.org_id,Date.now()).first();if(!row)fail(404,'NOT_FOUND','识别记录不存在或已过期');await allowStudent(env,user,row.student_id);if(row.status==='running'&&row.created_at<new Date(Date.now()-120000).toISOString()){await recoverStale(env.DB,row.upload_id);row={...row,status:'failed',error_code:'OCR_INTERRUPTED',completed_at:now()};}return row;}
function view(row){return {id:row.id,uploadId:row.upload_id,studentId:row.student_id,language:row.language,status:row.status,revision:row.revision,provider:JSON.parse(row.provider_json),imageDigest:row.image_digest,text:row.raw_text,confidence:row.confidence,elapsedMs:row.elapsed_ms,errorCode:row.error_code,reviewedText:row.reviewed_text,reviewedBy:row.reviewed_by,reviewedAt:row.reviewed_at,createdAt:row.created_at,completedAt:row.completed_at,expiresAt:row.expires_at,needsReview:row.status==='needs_review',notice:message};}
export function capabilities(env){const provider=publicProvider(env.OCR?.description),available=Boolean(provider&&typeof env.OCR?.recognize==='function');return {ocr:{available,provider,reason:available?null:'OCR_NOT_CONFIGURED',notice:message},rag:{available:false,reason:'DEEPTUTOR_RUNTIME_NOT_CONNECTED',notice:'尚未接通完整DeepTutor RAG；独立检索实验不代表生产服务。'},questionGeneration:{available:false,reason:'GENERATION_NOT_CONNECTED'}};}
export async function ocrProvenance(env,user,runId,studentId){
  requireRole(user,'teacher');const r=await runFor(env,user,runId);
  if(r.student_id!==studentId)fail(400,'OCR_STUDENT_MISMATCH','识别记录与学生不匹配');
  if(r.status!=='teacher_confirmed'||!r.reviewed_by)fail(409,'OCR_REVIEW_REQUIRED','识别文字须经老师核对确认后才能引用到正式阅卷流程');
  return {runId:r.id,uploadId:r.upload_id,origin:'teacher_reviewed_ocr_text',provider:JSON.parse(r.provider_json),imageDigest:r.image_digest,reviewedTextDigest:digest(r.reviewed_text),reviewedBy:r.reviewed_by,reviewedAt:r.reviewed_at,revision:r.revision};
}
export async function ocrRoutes(request,env,path,user){
  const db=env.DB,method=request.method;
  if(path==='/capabilities'&&method==='GET')return {data:capabilities(env)};
  let match=path.match(/^\/uploads\/([^/]+)\/ocr-runs$/);
  if(match&&method==='GET'){
    const upload=await uploadFor(env,user,match[1]);await recoverStale(db,upload.id);const rows=(await db.prepare('SELECT * FROM ocr_runs WHERE upload_id=? AND org_id=? ORDER BY created_at DESC,rowid DESC LIMIT 20').bind(upload.id,user.org_id).all()).results;
    return {data:rows.map(r=>{const v=view({...r,expires_at:upload.expires_at});delete v.text;delete v.reviewedText;return v;})};
  }
  match=path.match(/^\/uploads\/([^/]+)\/recognize$/);
  if(match&&method==='POST'){
    requireRole(user,'teacher','student');const upload=await uploadFor(env,user,match[1]);
    if(!capabilities(env).ocr.available)fail(503,'OCR_UNAVAILABLE','当前服务没有可用OCR引擎；请人工核对。没有生成模拟识别结果。');
    const b=await jsonBody(request,['requestId','language']);const requestId=textField(b.requestId,'请求标识',36,36);
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId)||!['eng','chi_sim+eng'].includes(b.language))fail(400,'INVALID_INPUT','请求标识或识别语言不正确');
    await recoverStale(db,upload.id);const existing=await db.prepare('SELECT * FROM ocr_runs WHERE upload_id=? AND requested_by=? AND request_id=?').bind(upload.id,user.id,requestId).first();
    if(existing){if(existing.language!==b.language)fail(409,'IDEMPOTENCY_CONFLICT','不能用相同请求标识切换识别语言');return {data:view({...existing,expires_at:upload.expires_at})};}
    if(env.OCR.busy)fail(429,'OCR_BUSY','本机正在处理另一张图片，请稍后重试');
    await rateLimit(env,`ocr:${user.id}`,5,900000);
    const image=await env.PAPERS?.get(upload.object_key);if(!image)fail(503,'STORAGE_UNAVAILABLE','原图读取失败，未启动识别');
    const bytes=await readLimited({headers:new Headers(),body:new Response(image.body).body},2*1024*1024),runId=id(),at=now();
    const provider=publicProvider(env.OCR.description);if(!provider)fail(503,'OCR_UNAVAILABLE','OCR配置未通过校验');
    await db.batch([db.prepare("INSERT INTO ocr_runs (id,org_id,upload_id,student_id,requested_by,request_id,language,status,provider_json,image_digest,created_at) VALUES (?,?,?,?,?,?,?,'running',?,?,?)").bind(runId,user.org_id,upload.id,upload.student_id,user.id,requestId,b.language,JSON.stringify(provider),digest(bytes),at),audit(db,user,'ocr_started',runId)]);
    try{
      const result=await env.OCR.recognize(bytes,{language:b.language});
      if(typeof result?.text!=='string'||result.text.length>20000)throw Object.assign(new Error(),{code:'OCR_OUTPUT_TOO_LARGE'});
      const text=result.text.replaceAll('\u0000','').trim();if(!text)throw Object.assign(new Error(),{code:'OCR_EMPTY'});
      await uploadFor(env,user,upload.id);
      const active=await db.prepare('SELECT u.id FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=? AND u.active=1 AND s.token_hash=? AND s.expires_at>?').bind(user.id,user.token_hash,Date.now()).first();
      if(!active)fail(401,'UNAUTHENTICATED','会话已失效，识别结果未保存');
      const confidence=Number.isFinite(result.confidence)&&result.confidence>=0&&result.confidence<=100?result.confidence:null;
      const elapsed=Number.isFinite(result.elapsedMs)?Math.max(0,Math.round(result.elapsedMs)):null;
      const saved=await db.batch([db.prepare("UPDATE ocr_runs SET status='needs_review',raw_text=?,confidence=?,elapsed_ms=?,completed_at=? WHERE id=? AND status='running' AND EXISTS (SELECT 1 FROM uploads WHERE id=? AND expires_at>?)").bind(text,confidence,elapsed,now(),runId,upload.id,Date.now()),db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),user.org_id,user.id,'ocr_completed_unreviewed',runId,now())]);
      if(saved[0].meta.changes!==1)fail(404,'NOT_FOUND','原图已失效，识别结果未保存');
      return {status:201,data:view(await runFor(env,user,runId))};
    }catch(error){
      const accessLost=error instanceof ApiError&&(error.status===401||error.status===404);
      const code=safeFailure.has(error.code)?error.code:accessLost?'OCR_ACCESS_LOST':'OCR_FAILED';
      await db.prepare("UPDATE ocr_runs SET status='failed',error_code=?,completed_at=? WHERE id=? AND status='running'").bind(code,now(),runId).run();
      if(accessLost)throw error;
      fail(code==='OCR_BUSY'?429:503,code,code==='OCR_EMPTY'?'没有识别到文字，请裁剪或改用人工录入。':code==='OCR_TIMEOUT'?'本机识别超时，未生成结果，请缩小图片后重试。':'识别未完成，可查看失败记录或改用人工核对。');
    }
  }
  match=path.match(/^\/ocr-runs\/([^/]+)(?:\/(review))?$/);if(!match)return null;
  const r=await runFor(env,user,match[1]);
  if(!match[2]&&method==='GET')return {data:view(r)};
  if(match[2]==='review'&&method==='PATCH'){
    requireRole(user,'teacher');if(r.status!=='needs_review')fail(409,'OCR_REVIEW_STATE','仅待核对的识别结果可以确认；已确认文字不可覆盖');
    const b=await jsonBody(request,['revision','text','confirmed']);if(b.revision!==r.revision)fail(409,'VERSION_CONFLICT','识别记录版本已变化');if(b.confirmed!==true)fail(400,'REVIEW_REQUIRED','请确认已对照原图核对识别文字');
    const text=textField(b.text,'核对文字',1,20000);
    const saved=await db.batch([db.prepare("UPDATE ocr_runs SET status='teacher_confirmed',reviewed_text=?,reviewed_by=?,reviewed_at=?,revision=revision+1 WHERE id=? AND revision=? AND status='needs_review'").bind(text,user.id,now(),r.id,b.revision),db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),user.org_id,user.id,'ocr_teacher_confirmed',r.id,now())]);
    if(saved[0].meta.changes!==1)fail(409,'VERSION_CONFLICT','识别结果已被确认或更新');return {data:view(await runFor(env,user,r.id))};
  }
  return null;
}
