import {allowStudent,audit,digest,exactKeys,fail,id,jsonBody,now,requireRole,textField} from './security.mjs';
import {ocrProvenance} from './ocr.mjs';

export const PAPER_ALGORITHM='manual-paper-v1:explicit-leaf-score';
const rules='卷面分仅汇总明确满分和人工实际得分；0–3能力观察单独保留档位，不换算分数。AI推断不参与评分，未复测不推断进步。';
const list=async(db,sql,...p)=>(await db.prepare(sql).bind(...p).all()).results;
const score=value=>value===null?null:value/100;
export function cents(value,name){
  if(value===null||value===undefined)return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1000||Math.abs(value*100-Math.round(value*100))>1e-7)fail(400,'INVALID_SCORE',`${name}必须是0–1000之间且最多两位小数的数字`);
  return Math.round(value*100);
}
export async function validatePaperItems(db,paper,input){
  if(!Array.isArray(input)||input.length>60)fail(400,'INVALID_ITEMS','每份记录最多60个题目或小题');
  const items=[],numbers=new Set();
  for(const item of input){
    exactKeys(item,['questionNo','parentNo','prompt','qtype','mappingLevel','scopeText','knowledgeId','maxScore','earnedScore','observationLevel','note','reviewed']);
    const no=textField(item.questionNo,'题号',1,16).normalize('NFKC');
    if(!/^[1-9]\d{0,2}(?:\([1-9]\d?\))?$/.test(no)||numbers.has(no))fail(400,'INVALID_QUESTION_NUMBER','题号必须唯一且无前导零，支持1或21(1)等格式');numbers.add(no);
    const parent=no.includes('(')?no.split('(')[0]:null;
    if(item.parentNo!==undefined&&item.parentNo!==null&&item.parentNo!==''&&item.parentNo!==parent)fail(400,'INVALID_PARENT','小题所属大题与题号不一致');
    const prompt=textField(item.prompt,'题干或观察任务',1,1000);
    const qtype=item.qtype;
    if(!['choice','fill','solution','observation'].includes(qtype))fail(400,'INVALID_ITEMS','题型不正确');
    const mapping=item.mappingLevel;
    if(!['knowledge','chapter','unresolved'].includes(mapping))fail(400,'INVALID_MAPPING','请选择具体知识点、章节或未映射');
    let knowledge=null,scope=textField(item.scopeText??'','范围',0,120);
    if(mapping==='knowledge'){
      knowledge=await db.prepare('SELECT id,title,version FROM knowledge WHERE id=? AND subject=?').bind(textField(item.knowledgeId,'知识点'),paper.subject).first();
      if(!knowledge)fail(400,'INVALID_MAPPING','知识点不存在或与科目不符');scope=knowledge.title;
    }else if(item.knowledgeId!==undefined&&item.knowledgeId!==null&&item.knowledgeId!=='')fail(400,'INVALID_MAPPING','章节和未映射范围不能冒充具体知识点');
    if(mapping==='chapter'&&!scope)fail(400,'INVALID_MAPPING','章节级映射须填写章节名称');
    if(mapping==='unresolved'&&!scope)scope='未映射';
    const max=cents(item.maxScore,'满分'),earned=cents(item.earnedScore,'实际得分');let level=item.observationLevel??null;
    if(paper.kind==='scored_paper'){
      if(qtype==='observation'||level!==null)fail(400,'MIXED_EVIDENCE','卷面成绩中不能混入能力观察档位');
      if(max===0||(earned!==null&&(max===null||earned>max)))fail(400,'INVALID_SCORE','实际得分必须有明确满分且不能超过满分');
    }else{
      if(qtype!=='observation'||max!==null||earned!==null)fail(400,'MIXED_EVIDENCE','能力观察只记录0–3档，不接受卷面分值');
      if(level!==null&&(!Number.isInteger(level)||level<0||level>3))fail(400,'INVALID_OBSERVATION','能力观察档位必须是0、1、2或3');
    }
    if(typeof item.reviewed!=='boolean')fail(400,'INVALID_REVIEW','每题必须明确是否已人工核对');
    items.push({questionNo:no,parentNo:parent,prompt,qtype,mappingLevel:mapping,scopeText:scope,knowledgeId:knowledge?.id??null,knowledgeVersion:knowledge?.version??null,maxCents:max,earnedCents:earned,observationLevel:level,note:textField(item.note??'','核对说明',0,500),reviewed:item.reviewed});
  }
  if(items.some(item=>item.parentNo&&numbers.has(item.parentNo)))fail(400,'DOUBLE_COUNTED_PARENT','请只录入叶子小题，不能同时累计大题总分与它的小题分');
  return items;
}
function itemView(row){return {questionNo:row.question_no,parentNo:row.parent_no,prompt:row.prompt,qtype:row.qtype,mappingLevel:row.mapping_level,scopeText:row.scope_text,knowledgeId:row.knowledge_id,knowledgeVersion:row.knowledge_version,maxScore:score(row.max_cents),earnedScore:score(row.earned_cents),observationLevel:row.observation_level,note:row.note,reviewed:Boolean(row.reviewed_by),reviewedBy:row.reviewed_by};}
async function getPaper(env,user,pid){
  const p=await env.DB.prepare('SELECT * FROM paper_assessments WHERE id=? AND org_id=?').bind(pid,user.org_id).first();
  if(!p)fail(404,'NOT_FOUND','阅卷记录不存在或无权访问');
  await allowStudent(env,user,p.student_id);
  if(user.role!=='teacher'&&p.status!=='confirmed')fail(404,'NOT_FOUND','阅卷记录不存在或无权访问');
  return p;
}
async function view(env,p){
  const items=(await list(env.DB,'SELECT * FROM paper_items WHERE paper_id=? ORDER BY position',p.id)).map(itemView);
  let attachment=null;
  if(p.upload_id){const upload=await env.DB.prepare('SELECT id,expires_at FROM uploads WHERE id=?').bind(p.upload_id).first();attachment={id:p.upload_id,available:Boolean(upload&&upload.expires_at>Date.now())};}
  const provenance=p.ocr_provenance_json?JSON.parse(p.ocr_provenance_json):null;
  return {id:p.id,studentId:p.student_id,subject:p.subject,title:p.title,kind:p.kind,status:p.status,revision:p.revision,contentOrigin:provenance?'teacher_reviewed_ocr_text':p.content_origin,ocrRunId:p.ocr_run_id??null,ocrProvenance:provenance,source:p.kind==='scored_paper'?'teacher_marked':'teacher_observation',createdAt:p.created_at,updatedAt:p.updated_at,confirmedAt:p.confirmed_at,confirmedBy:p.confirmed_by,attachment,items,report:p.report_json?JSON.parse(p.report_json):null,notice:rules};
}
export function calculatePaperReport(kind,items){
  if(!items.length||items.some(i=>!i.reviewed))fail(409,'REVIEW_INCOMPLETE','至少录入一题，并逐题完成人工核对');
  const base={kind,algorithmVersion:PAPER_ALGORITHM,itemCount:items.length,unresolvedCount:items.filter(i=>i.mappingLevel==='unresolved').length,chapterOnlyCount:items.filter(i=>i.mappingLevel==='chapter').length,source:kind==='scored_paper'?'teacher_marked':'teacher_observation',aiUsedForGrading:false,notice:rules};
  if(kind==='ability_observation'){
    if(items.some(i=>!Number.isInteger(i.observationLevel)))fail(409,'OBSERVATION_INCOMPLETE','每条观察需要明确0–3档位');
    return {...base,score:null,observationCounts:[0,1,2,3].map(level=>({level,count:items.filter(i=>i.observationLevel===level).length})),byScope:[]};
  }
  if(items.some(i=>i.maxScore===null||i.earnedScore===null))fail(409,'SCORE_INCOMPLETE','每个题目或小题都需要明确满分和实际得分；缺失分值不会自动折算');
  const grouped=new Map();let max=0,earned=0;
  for(const i of items){const m=cents(i.maxScore,'满分'),e=cents(i.earnedScore,'实际得分');if(!m||e===null||e>m)fail(400,'INVALID_SCORE','分值不正确');max+=m;earned+=e;const key=`${i.mappingLevel}:${i.knowledgeId||i.scopeText}`;const group=grouped.get(key)||{mappingLevel:i.mappingLevel,scopeText:i.scopeText,knowledgeId:i.knowledgeId,max:0,earned:0,itemCount:0};group.max+=m;group.earned+=e;group.itemCount++;grouped.set(key,group);}
  const total=(m,e)=>({max:score(m),earned:score(e),percent:Math.round(e/m*10000)/100});
  return {...base,score:total(max,earned),observationCounts:[],byScope:[...grouped.values()].map(g=>({mappingLevel:g.mappingLevel,scopeText:g.scopeText,knowledgeId:g.knowledgeId,itemCount:g.itemCount,score:total(g.max,g.earned)}))};
}
export async function paperSummaries(env,user,studentId){
  await allowStudent(env,user,studentId,true);
  const records=await list(env.DB,"SELECT id,title,subject,kind,confirmed_at,report_json FROM paper_assessments WHERE org_id=? AND student_id=? AND status='confirmed' ORDER BY confirmed_at DESC LIMIT 100",user.org_id,studentId);
  return records.map(p=>{const r=JSON.parse(p.report_json);return {id:p.id,title:p.title,subject:p.subject,kind:p.kind,confirmedAt:p.confirmed_at,source:r.source,itemCount:r.itemCount,score:r.score,observationCounts:r.observationCounts,unresolvedCount:r.unresolvedCount,chapterOnlyCount:r.chapterOnlyCount,algorithmVersion:r.algorithmVersion,notice:r.notice};});
}
export async function paperRoutes(request,env,path,user,url){
  const db=env.DB,method=request.method;
  const summary=path.match(/^\/students\/([^/]+)\/paper-summaries$/);
  if(summary&&method==='GET')return {data:await paperSummaries(env,user,summary[1])};
  if(path==='/papers'&&method==='GET'){
    requireRole(user,'teacher','student');const studentId=textField(url.searchParams.get('studentId'),'学生');await allowStudent(env,user,studentId);
    return {data:await list(db,"SELECT id,student_id AS studentId,title,subject,kind,status,revision,created_at AS createdAt,confirmed_at AS confirmedAt FROM paper_assessments WHERE org_id=? AND student_id=? AND (?='teacher' OR status='confirmed') ORDER BY created_at DESC LIMIT 100",user.org_id,studentId,user.role)};
  }
  if(path==='/papers'&&method==='POST'){
    requireRole(user,'teacher');const b=await jsonBody(request,['studentId','subject','title','kind','requestId','uploadId','ocrRunId']);
    const studentId=textField(b.studentId,'学生');await allowStudent(env,user,studentId);
    if(!['math','english'].includes(b.subject)||!['scored_paper','ability_observation'].includes(b.kind))fail(400,'INVALID_INPUT','请选择科目和证据类型');
    const title=textField(b.title,'记录标题',1,100),requestId=textField(b.requestId,'请求标识',36,36);
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId))fail(400,'INVALID_INPUT','请求标识必须为UUID');
    const requestedUploadId=b.uploadId==null?null:textField(b.uploadId,'原图'),ocrRunId=b.ocrRunId==null?null:textField(b.ocrRunId,'OCR记录');
    const hash=digest(JSON.stringify({studentId,subject:b.subject,title,kind:b.kind,uploadId:requestedUploadId,...(ocrRunId?{ocrRunId}:{})}));
    const existing=await db.prepare('SELECT * FROM paper_assessments WHERE org_id=? AND created_by=? AND request_id=?').bind(user.org_id,user.id,requestId).first();
    if(existing){if(existing.request_hash!==hash)fail(409,'IDEMPOTENCY_CONFLICT','同一请求标识不能用于不同内容');return {data:await view(env,existing)};}
    const provenance=ocrRunId?await ocrProvenance(env,user,textField(ocrRunId,'OCR记录'),studentId):null;
    if(provenance&&requestedUploadId&&requestedUploadId!==provenance.uploadId)fail(400,'OCR_IMAGE_MISMATCH','OCR记录与原图不一致');
    const uploadId=requestedUploadId||provenance?.uploadId||null;
    if(uploadId!==null&&!await db.prepare('SELECT id FROM uploads WHERE id=? AND org_id=? AND student_id=? AND expires_at>?').bind(textField(uploadId,'原图'),user.org_id,studentId,Date.now()).first())fail(400,'INVALID_ATTACHMENT','原图不存在、已过期或不属于该学生');
    const pid=id(),at=now();
    await db.batch([db.prepare('INSERT INTO paper_assessments (id,org_id,student_id,subject,title,kind,write_token,request_id,request_hash,upload_id,created_by,created_at,updated_at,ocr_run_id,ocr_provenance_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(pid,user.org_id,studentId,b.subject,title,b.kind,id(),requestId,hash,uploadId,user.id,at,at,ocrRunId,provenance?JSON.stringify(provenance):null),audit(db,user,'paper_created',pid)]);
    return {status:201,data:await view(env,await getPaper(env,user,pid))};
  }
  const match=path.match(/^\/papers\/([^/]+)(?:\/(confirm|report))?$/);if(!match)return null;
  requireRole(user,'teacher','student');const p=await getPaper(env,user,match[1]);
  if(method==='GET'&&!match[2])return {data:await view(env,p)};
  if(method==='GET'&&match[2]==='report'){
    if(p.status!=='confirmed')fail(409,'PAPER_NOT_CONFIRMED','尚未逐题复核确认，不生成正式报告');
    return {data:await view(env,p)};
  }
  if(method==='PATCH'&&!match[2]){
    requireRole(user,'teacher');if(p.status!=='draft')fail(409,'PAPER_LOCKED','已确认记录只读，不能覆盖原始证据');
    const b=await jsonBody(request,['revision','title','items']);if(b.revision!==p.revision)fail(409,'VERSION_CONFLICT','记录已更新，请重新加载');
    const title=textField(b.title,'标题',1,100),items=await validatePaperItems(db,p,b.items),token=id(),at=now();
    const guard='EXISTS (SELECT 1 FROM paper_assessments WHERE id=? AND write_token=?)';
    const statements=[db.prepare("UPDATE paper_assessments SET title=?,revision=revision+1,write_token=?,updated_at=? WHERE id=? AND revision=? AND status='draft'").bind(title,token,at,p.id,b.revision),db.prepare(`DELETE FROM paper_items WHERE paper_id=? AND ${guard}`).bind(p.id,p.id,token)];
    items.forEach((i,position)=>statements.push(db.prepare(`INSERT INTO paper_items (paper_id,question_no,parent_no,position,prompt,qtype,mapping_level,scope_text,knowledge_id,knowledge_version,max_cents,earned_cents,observation_level,note,reviewed_by) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${guard}`).bind(p.id,i.questionNo,i.parentNo,position,i.prompt,i.qtype,i.mappingLevel,i.scopeText,i.knowledgeId,i.knowledgeVersion,i.maxCents,i.earnedCents,i.observationLevel,i.note,i.reviewed?user.id:null,p.id,token)));
    statements.push(db.prepare(`INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(id(),user.org_id,user.id,'paper_draft_saved',p.id,at,p.id,token));
    const result=await db.batch(statements);if(result[0].meta.changes!==1)fail(409,'VERSION_CONFLICT','记录已由其他操作更新，请重新加载');
    return {data:await view(env,await getPaper(env,user,p.id))};
  }
  if(method==='POST'&&match[2]==='confirm'){
    requireRole(user,'teacher');if(p.status!=='draft')fail(409,'ALREADY_CONFIRMED','记录已确认，不会重复计入');
    const b=await jsonBody(request,['revision','confirmed']);if(b.confirmed!==true)fail(400,'REVIEW_REQUIRED','请明确确认所有分值来自实际作答并已人工复核');if(b.revision!==p.revision)fail(409,'VERSION_CONFLICT','请重新加载最新版本');
    const detail=await view(env,p),report=calculatePaperReport(p.kind,detail.items),token=id(),at=now();
    const result=await db.batch([db.prepare("UPDATE paper_assessments SET status='confirmed',revision=revision+1,write_token=?,updated_at=?,confirmed_by=?,confirmed_at=?,report_json=? WHERE id=? AND revision=? AND status='draft'").bind(token,at,user.id,at,JSON.stringify(report),p.id,b.revision),db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM paper_assessments WHERE id=? AND write_token=?)').bind(id(),user.org_id,user.id,'paper_confirmed',p.id,at,p.id,token)]);
    if(result[0].meta.changes!==1)fail(409,'VERSION_CONFLICT','记录已被更新或确认，未重复写入');
    return {data:await view(env,await getPaper(env,user,p.id))};
  }
  return null;
}
