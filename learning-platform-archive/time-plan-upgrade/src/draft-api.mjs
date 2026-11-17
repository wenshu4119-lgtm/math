import {ApiError,requireRole,fail,jsonBody,exactKeys,textField,id,now} from './security.mjs';
import {draftRows,ownerGuard,sourceView,createSource,getSource,sourcesFor,draftSubject,revision,validateCandidates,getDraftRow,draftView,createDraft,saveVersion,manualProvenance} from './draft-content.mjs';
import {draftCapabilities,generateCandidates} from './draft-provider.mjs';
import {draftExport} from './draft-exports.mjs';

export async function draftRoutes(request,env,path,user,url){
  if(!/^\/(draft-provider|draft-sources|question-drafts|draft-exports)(\/|$)/.test(path))return null;
  requireRole(user,'teacher');const db=env.DB,method=request.method;
  if(path==='/draft-provider'&&method==='GET')return {data:draftCapabilities(env)};
  if(path==='/draft-exports'&&method==='GET')return draftExport(db,user,url.searchParams);
  if(path==='/draft-sources'&&method==='GET'){
    if(url.search)fail(400,'INVALID_INPUT','资料列表不接受身份或范围覆盖');
    return {data:(await draftRows(db,`SELECT * FROM draft_sources WHERE ${ownerGuard('draft_sources')} ORDER BY created_at DESC,id DESC LIMIT 100`,user.org_id,user.id)).map(sourceView)};
  }
  if(path==='/draft-sources'&&method==='POST')return createSource(db,user,await jsonBody(request,['requestId','title','subject','text','sourceLabel','licenseDeclaration','syntheticOnly','rightsConfirmed']));
  const sourceMatch=path.match(/^\/draft-sources\/([\w-]+)$/);if(sourceMatch&&method==='GET')return {data:sourceView(await getSource(db,user,sourceMatch[1]))};
  if(path==='/question-drafts'&&method==='GET'){
    if(url.search)fail(400,'INVALID_INPUT','候选列表不接受身份或范围覆盖');
    const list=await draftRows(db,`SELECT * FROM question_drafts WHERE ${ownerGuard('question_drafts')} ORDER BY created_at DESC,id DESC LIMIT 100`,user.org_id,user.id);return {data:await Promise.all(list.map(d=>draftView(db,d,{history:false})))};
  }
  if(path==='/question-drafts'&&method==='POST'){
    const b=await jsonBody(request,['requestId','title','subject','sourceIds','questions']);const subject=draftSubject(b.subject),title=textField(b.title,'批次标题',1,120),sources=await sourcesFor(db,user,b.sourceIds,subject),checked=await validateCandidates(b.questions,sources,user.org_id);
    const result=await createDraft(db,user,{requestId:b.requestId,title,subject,sources,...checked,intent:{kind:'manual',title,subject,sourceIds:b.sourceIds,questions:checked.questions}});return {data:await draftView(db,result.row),status:result.created?201:200};
  }
  if(path==='/question-drafts/generate'&&method==='POST'){
    const b=await jsonBody(request,['requestId','title','subject','sourceIds','count','instructions','syntheticOnly']);
    if(b.syntheticOnly!==true||!Number.isInteger(b.count)||b.count<1||b.count>3)fail(400,'INVALID_GENERATION','本阶段仅生成1至3道合成候选题');
    const subject=draftSubject(b.subject),title=textField(b.title,'批次标题',1,120),instructions=textField(b.instructions,'合成出题要求',1,1000),sources=await sourcesFor(db,user,b.sourceIds,subject);
    const result=await createDraft(db,user,{requestId:b.requestId,title,subject,sources,status:'generating',intent:{kind:'generation',title,subject,sourceIds:b.sourceIds,count:b.count,instructions},provenance:{...manualProvenance,kind:'generation_requested'}});
    if(!result.created)return {data:await draftView(db,result.row),status:result.row.status==='generating'?202:200};
    let saved;const capabilities=draftCapabilities(env);
    try{
      const output=await generateCandidates(env,{requestId:result.row.id,subject,count:b.count,instructions,sources:sources.map(s=>({sourceId:s.id,version:s.revision,digest:s.source_digest,text:s.source_text}))});
      const checked=await validateCandidates(output.questions,sources,user.org_id,{provider:true});
      saved=await saveVersion(db,user,result.row,{status:'pending_human',...checked,provenance:output.provenance,fromGenerating:true});
    }catch(error){
      // Never persist the provider exception, prompt dump, URL, headers or response body.
      if(error instanceof ApiError&&[401,403,404,409].includes(error.status))throw error;
      const code=error instanceof ApiError?error.code:'PROVIDER_FAILED',unavailable=['NOT_CONFIGURED','CALLS_DISABLED','COST_POLICY_REQUIRED','CONFIGURATION_INVALID','UNVERIFIED_CONTRACT'].includes(code);
      saved=await saveVersion(db,user,result.row,{status:unavailable?'unavailable':'failed',questions:[],validation:{humanReview:false,accuracyEvaluated:false,notice:'没有保存任何候选题；未执行自动评分。'},errorCode:code,provenance:{...manualProvenance,kind:capabilities.provider||'generation_requested',model:capabilities.model,providerRevision:capabilities.providerRevision,transportAttempted:capabilities.available,modelExecution:capabilities.available?'unknown_after_failure':'not_executed'},fromGenerating:true});
    }
    // 201 means a request record was saved, never that inference or review succeeded.
    return {data:saved,status:201};
  }
  const match=path.match(/^\/question-drafts\/([\w-]+)(\/review)?$/);if(!match)return null;
  const row=await getDraftRow(db,user,match[1]);
  if(!match[2]&&method==='GET')return {data:await draftView(db,row)};
  if(!match[2]&&method==='PATCH'){
    const b=await jsonBody(request,['revision','title','questions']);if(revision(b.revision)!==row.revision)fail(409,'VERSION_CONFLICT','候选批次已改变，请读取最新版本');
    if(row.status==='generating')fail(409,'GENERATION_PENDING','生成状态尚未确认，禁止覆盖或自动重试');
    const sources=await sourcesFor(db,user,JSON.parse(row.sources_json).map(s=>s.id),row.subject),checked=await validateCandidates(b.questions,sources,user.org_id);
    return {data:await saveVersion(db,user,row,{title:textField(b.title,'批次标题',1,120),status:'pending_human',...checked})};
  }
  if(match[2]&&method==='POST'){
    const b=await jsonBody(request,['revision','decision','note','confirmed','checks']);if(revision(b.revision)!==row.revision)fail(409,'VERSION_CONFLICT','候选批次已改变，请重新核对');
    if(row.status!=='pending_human')fail(409,'REVIEW_STATE_INVALID','仅待审候选可复核；修改后须重新审题');
    if(b.confirmed!==true||!['accept','reject'].includes(b.decision))fail(400,'HUMAN_CONFIRMATION_REQUIRED','必须明确记录本次人工复核决定');
    const current=await draftView(db,row);if(!Array.isArray(b.checks)||b.checks.length!==current.questions.length)fail(400,'INCOMPLETE_REVIEW','每道题均需单独核对');
    for(const q of current.questions){const matches=b.checks.filter(c=>c.questionId===q.id);if(matches.length!==1)fail(400,'INCOMPLETE_REVIEW','复核题目必须逐一对应');const c=matches[0];exactKeys(c,['questionId','answer','rationale','source','ageAppropriate']);if(['answer','rationale','source','ageAppropriate'].some(k=>typeof c[k]!=='boolean'||b.decision==='accept'&&!c[k]))fail(400,'INCOMPLETE_REVIEW','接受候选前必须核对答案、解析、来源和年级适用性');}
    const review={decision:b.decision,note:textField(b.note,'人工复核说明',10,2000),checks:b.checks,reviewerId:user.id,reviewedAt:now(),reviewedRevision:row.revision,attestationOnly:true,published:false};
    return {data:await saveVersion(db,user,row,{status:b.decision==='accept'?'accepted_isolated':'rejected',questions:current.questions,validation:current.validation,review})};
  }
  return null;
}
