import {ApiError,fail,id,now,digest,textField,exactKeys} from './security.mjs';
import {retrieveScoped} from './retrieval-contract.mjs';

export const DRAFT_NOTICE='隔离合成候选；自动校验不等于真人审题。教师确认后仍未发布，不可用于学生测评或正式评分。';
export const draftRows=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
export const ownerGuard=table=>`${table}.org_id=? AND ${table}.owner_id=? AND EXISTS (SELECT 1 FROM users u WHERE u.id=${table}.owner_id AND u.org_id=${table}.org_id AND u.role='teacher' AND u.active=1)`;
const activeOwner="EXISTS (SELECT 1 FROM users WHERE id=? AND org_id=? AND role='teacher' AND active=1)";
export function requestKey(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))fail(400,'INVALID_REQUEST_ID','需要有效的请求UUID');return value.toLowerCase();}
export function draftSubject(value){if(!['math','english'].includes(value))fail(400,'INVALID_SUBJECT','仅支持math或english');return value;}
export function revision(value){if(!Number.isInteger(value)||value<1)fail(400,'INVALID_REVISION','需要当前保存版本');return value;}
const hash=value=>digest(JSON.stringify(value));
export function sourceView(s){return {id:s.id,title:s.title,subject:s.subject,text:s.source_text,digest:s.source_digest,version:s.revision,sourceLabel:s.source_label,licenseDeclaration:s.license,syntheticOnly:true,rightsVerified:false,createdAt:s.created_at,notice:'原创/授权声明由提交老师提供，平台未核验版权或教学正确性。'};}
export async function getSource(db,user,key){const row=await db.prepare(`SELECT * FROM draft_sources WHERE id=? AND ${ownerGuard('draft_sources')}`).bind(key,user.org_id,user.id).first();if(!row)fail(404,'NOT_FOUND','资料不存在或无权访问');return row;}
export async function sourcesFor(db,user,ids,subject){
  if(!Array.isArray(ids)||!ids.length||ids.length>2||ids.some(v=>typeof v!=='string')||new Set(ids).size!==ids.length)fail(400,'INVALID_SOURCE_SCOPE','请选择1至2份本人资料');
  const sources=[];for(const key of ids){const s=await getSource(db,user,key);if(s.subject!==subject)fail(400,'SOURCE_SUBJECT_MISMATCH','资料科目不一致');sources.push(s);}return sources;
}
export const sourceMetadata=sources=>sources.map(s=>({id:s.id,title:s.title,version:s.revision,digest:s.source_digest,sourceLabel:s.source_label,licenseDeclaration:s.license}));
export async function createSource(db,user,body){
  const requestId=requestKey(body.requestId),normalized={title:textField(body.title,'资料标题',1,120),subject:draftSubject(body.subject),text:textField(body.text,'合成资料',1,12000).replace(/\r\n?/g,'\n'),sourceLabel:textField(body.sourceLabel,'来源说明',1,300),licenseDeclaration:body.licenseDeclaration,syntheticOnly:body.syntheticOnly,rightsConfirmed:body.rightsConfirmed};
  if(normalized.syntheticOnly!==true||normalized.rightsConfirmed!==true||!['original_private','CC0-1.0'].includes(normalized.licenseDeclaration))fail(400,'SYNTHETIC_SOURCE_REQUIRED','本阶段仅接受明确授权的原创合成资料，不接收真实学生数据');
  const fingerprint=hash(normalized),key=id(),at=now();
  await db.batch([
    db.prepare(`INSERT INTO draft_sources (id,org_id,owner_id,request_id,request_hash,title,subject,source_text,source_digest,source_label,license,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${activeOwner} ON CONFLICT(org_id,owner_id,request_id) DO NOTHING`).bind(key,user.org_id,user.id,requestId,fingerprint,normalized.title,normalized.subject,normalized.text,digest(normalized.text),normalized.sourceLabel,normalized.licenseDeclaration,at,user.id,user.org_id),
    db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),user.org_id,user.id,'draft_source_created',key,at)
  ]);
  const saved=await db.prepare(`SELECT * FROM draft_sources WHERE request_id=? AND ${ownerGuard('draft_sources')}`).bind(requestId,user.org_id,user.id).first();if(!saved)fail(404,'NOT_FOUND','当前教师授权已失效');if(saved.request_hash!==fingerprint)fail(409,'IDEMPOTENCY_CONFLICT','相同请求标识对应不同资料');return {data:sourceView(saved),status:saved.id===key?201:200};
}

export async function validateCandidates(questions,sources,orgId,{provider=false}={}){
  try{
    if(!Array.isArray(questions)||!questions.length||questions.length>3)fail(400,'INVALID_CANDIDATES','每批需要1至3道候选题');
    const out=[],seen=new Set(),normalize=s=>s.normalize('NFKC').replace(/\s/g,'').toLowerCase();
    for(const [i,q]of questions.entries()){
      exactKeys(q,['id','topic','grade','phase','prompt','options','correctOption','rationale','citations']);
      const result={id:`q${i+1}`,topic:textField(q.topic,'知识点',1,120),grade:q.grade,phase:q.phase,prompt:textField(q.prompt,'题干',1,2000),options:[],correctOption:q.correctOption,rationale:textField(q.rationale,'解析',1,3000)};
      if((q.id!==undefined&&q.id!==result.id)||![7,8,9].includes(q.grade)||!['diagnostic','practice','retest'].includes(q.phase)||!Array.isArray(q.options)||q.options.length!==4||!Number.isInteger(q.correctOption)||q.correctOption<0||q.correctOption>3)fail(400,'INVALID_CANDIDATES','候选题年级、阶段或选项不正确');
      result.options=q.options.map(v=>textField(v,'选项',1,600));if(new Set(result.options.map(normalize)).size!==4||seen.has(normalize(result.prompt)))fail(400,'DUPLICATE_CANDIDATE','题干或选项重复');seen.add(normalize(result.prompt));
      if(!Array.isArray(q.citations)||!q.citations.length||q.citations.length>3)fail(400,'CITATION_REQUIRED','每题需要1至3段可定位来源');
      for(const c of q.citations){exactKeys(c,['sourceId','sourceVersion','digest','lineStart','lineEnd','text']);if(c.sourceVersion!==undefined&&c.sourceVersion!==1)fail(400,'SOURCE_VERSION_MISMATCH','引用版本不一致');}
      const checked=await retrieveScoped({retrieve:async()=>({citations:q.citations})},{orgId,sources:sources.map(s=>({orgId:s.org_id,id:s.id,status:'completed',text:s.source_text,digest:s.source_digest}))},'候选题引用边界校验');
      result.citations=checked.citations.map(c=>({...c,sourceVersion:1}));out.push(result);
    }
    return {questions:out,validation:{kind:'schema_and_exact_source_quote_only',schemaValid:true,citationsLocated:true,questionCount:out.length,accuracyEvaluated:false,humanReview:false,notice:'仅核验结构、重复项与原文定位，不判断答案正确性、教材质量或难度。'}};
  }catch(error){if(provider)fail(502,'CANDIDATE_OUTPUT_INVALID','生成候选未通过结构或来源校验；没有保存题目');throw error;}
}
export async function getDraftRow(db,user,key){const row=await db.prepare(`SELECT * FROM question_drafts WHERE id=? AND ${ownerGuard('question_drafts')}`).bind(key,user.org_id,user.id).first();if(!row)fail(404,'NOT_FOUND','候选批次不存在或无权访问');return row;}
export async function draftView(db,row,{history=true}={}){
  const versions=await draftRows(db,`SELECT * FROM draft_versions WHERE draft_id=? ${history?'':'AND revision=?'} ORDER BY revision`,...history?[row.id]:[row.id,row.revision]);
  const parsed=versions.map(v=>({revision:v.revision,status:v.status,questions:JSON.parse(v.questions_json),validation:JSON.parse(v.validation_json),review:v.review_json?JSON.parse(v.review_json):null,actorId:v.actor_id,createdAt:v.created_at}));
  const latest=parsed.find(v=>v.revision===row.revision);if(!latest)fail(500,'DRAFT_STATE_INVALID','候选批次保存版本不完整');
  return {id:row.id,title:row.title,subject:row.subject,status:row.status,revision:row.revision,sources:JSON.parse(row.sources_json),provenance:JSON.parse(row.provenance_json),questions:latest.questions,validation:latest.validation,review:latest.review,history:history?parsed:[],errorCode:row.error_code,createdAt:row.created_at,updatedAt:row.updated_at,syntheticOnly:true,published:false,gradingAllowed:false,notice:DRAFT_NOTICE};
}
export const manualProvenance={kind:'manual_synthetic',contract:null,providerRevision:null,model:null,transportExecuted:false,modelExecution:'not_executed',usage:{inputTokens:null,outputTokens:null},syntheticOnly:true,gradingAllowed:false};
export async function createDraft(db,user,{requestId,title,subject,sources,questions=[],validation={},status='pending_human',intent,provenance=manualProvenance}){
  requestId=requestKey(requestId);const fingerprint=hash(intent),key=id(),token=id(),at=now();
  await db.batch([
    db.prepare(`INSERT INTO question_drafts (id,org_id,owner_id,request_id,request_hash,title,subject,sources_json,provenance_json,status,created_at,updated_at,write_token) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${activeOwner} ON CONFLICT(org_id,owner_id,request_id) DO NOTHING`).bind(key,user.org_id,user.id,requestId,fingerprint,title,subject,JSON.stringify(sourceMetadata(sources)),JSON.stringify(provenance),status,at,at,token,user.id,user.org_id),
    db.prepare('INSERT INTO draft_versions SELECT id,revision,status,?,?,NULL,owner_id,updated_at FROM question_drafts WHERE id=? AND write_token=?').bind(JSON.stringify(questions),JSON.stringify(validation),key,token),
    db.prepare('INSERT INTO audit_events SELECT ?,org_id,owner_id,?,id,updated_at FROM question_drafts WHERE id=? AND write_token=?').bind(id(),'question_draft_created',key,token)
  ]);
  const saved=await db.prepare(`SELECT * FROM question_drafts WHERE request_id=? AND ${ownerGuard('question_drafts')}`).bind(requestId,user.org_id,user.id).first();if(!saved)fail(404,'NOT_FOUND','当前教师授权已失效');if(saved.request_hash!==fingerprint)fail(409,'IDEMPOTENCY_CONFLICT','相同请求标识对应不同候选需求');return {row:saved,created:saved.id===key};
}
export async function saveVersion(db,user,row,{title=row.title,status,questions,validation,review=null,provenance=JSON.parse(row.provenance_json),errorCode=null,fromGenerating=false}){
  const token=id(),at=now();const result=await db.batch([
    db.prepare(`UPDATE question_drafts SET title=?,status=?,revision=revision+1,error_code=?,provenance_json=?,updated_at=?,write_token=? WHERE id=? AND revision=? AND status ${fromGenerating?'=':'!='} 'generating' AND ${ownerGuard('question_drafts')}`).bind(title,status,errorCode,JSON.stringify(provenance),at,token,row.id,row.revision,user.org_id,user.id),
    db.prepare('INSERT INTO draft_versions SELECT id,revision,status,?,?,?,owner_id,updated_at FROM question_drafts WHERE id=? AND write_token=?').bind(JSON.stringify(questions),JSON.stringify(validation),review?JSON.stringify(review):null,row.id,token),
    db.prepare('INSERT INTO audit_events SELECT ?,org_id,owner_id,?,id,updated_at FROM question_drafts WHERE id=? AND write_token=?').bind(id(),review?'question_draft_reviewed':'question_draft_updated',row.id,token)
  ]);
  if(result[0].meta.changes!==1){await getDraftRow(db,user,row.id);fail(409,'VERSION_CONFLICT','候选批次已更新或仍在生成，请重新读取比较');}
  return draftView(db,await getDraftRow(db,user,row.id));
}
