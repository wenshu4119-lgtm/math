import {fail} from './security.mjs';
// Internal boundary only. No public search service or model is connected in this phase.
// sources must be loaded by trusted server code after org/relationship authorization, never client metadata.
export async function retrieveScoped(adapter,{orgId,sources},query){
  if(!adapter)fail(503,'RAG_UNAVAILABLE','完整知识库检索服务未接通；不会返回模拟引用或答案');
  if(typeof orgId!=='string'||!orgId||typeof query!=='string'||!query.trim()||query.length>500||!Array.isArray(sources)||!sources.length||sources.length>8)fail(400,'INVALID_RETRIEVAL_SCOPE','检索范围或问题不正确');
  if(sources.some(s=>!s||s.orgId!==orgId||s.status!=='completed'||typeof s.text!=='string'||typeof s.id!=='string'||!s.id||typeof s.digest!=='string'||!s.digest)||new Set(sources.map(s=>s.id)).size!==sources.length)fail(409,'SOURCE_NOT_READY','只能检索当前机构已完成处理且明确授权的资料');
  let result;try{result=await adapter.retrieve({query:query.trim(),sourceIds:sources.map(s=>s.id)});}catch{fail(503,'RAG_PROVIDER_FAILED','检索服务失败，没有生成替代结果');}
  if(result?.status==='needs_reindex')fail(503,'RAG_NEEDS_REINDEX','资料索引尚未就绪，需要重新建索引');
  if(result?.status==='unavailable')fail(503,'RAG_UNAVAILABLE','检索供应方当前不可用，没有替代结果');
  if(result?.status==='failed'||result?.error)fail(503,'RAG_PROVIDER_FAILED','检索服务失败，没有替代结果');
  if(!result||!Array.isArray(result.citations)||result.citations.length>10||result.answer!==undefined||result.score!==undefined||(result.status&&!['retrieved','no_match'].includes(result.status))||(result.status==='no_match'&&result.citations.length))fail(502,'RAG_OUTPUT_INVALID','检索输出未通过校验');
  const citations=result.citations.map(c=>{if(!c||typeof c!=='object'||typeof c.text!=='string'||c.text.length>20000)fail(502,'RAG_CITATION_INVALID','引用格式或长度不正确');const s=sources.find(s=>s.id===c.sourceId);if(!s||c.digest!==s.digest||!Number.isInteger(c.lineStart)||!Number.isInteger(c.lineEnd)||c.lineStart<1||c.lineEnd<c.lineStart)fail(502,'RAG_CITATION_INVALID','引用越界或来源不一致');const lines=s.text.split('\n');if(c.lineEnd>lines.length||c.text!==lines.slice(c.lineStart-1,c.lineEnd).join('\n'))fail(502,'RAG_CITATION_INVALID','引用无法定位到授权原文');return {sourceId:s.id,digest:s.digest,lineStart:c.lineStart,lineEnd:c.lineEnd,text:c.text};});
  return {status:citations.length?'retrieved':'no_match',citations,answer:null,needsTeacherReview:true,notice:'检索命中不是答案正确性或学生掌握度；当前未连接LLM生成。'};
}
