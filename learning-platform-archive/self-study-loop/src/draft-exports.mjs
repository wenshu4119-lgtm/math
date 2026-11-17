import {fail} from './security.mjs';
import {draftRows,ownerGuard,sourceView,getSource,getDraftRow,draftView,DRAFT_NOTICE} from './draft-content.mjs';

export const DRAFT_EXPORTS=Object.freeze({
  'draft-sources':{title:'隔离合成资料清单',roles:['teacher']},
  'draft-source':{title:'隔离合成资料与来源',roles:['teacher'],key:'id'},
  'question-drafts':{title:'隔离候选批次清单',roles:['teacher']},
  'question-draft':{title:'隔离候选题与复核记录',roles:['teacher'],key:'id'}
});
const state={generating:'生成请求处理中',pending_human:'待教师逐题审核',accepted_isolated:'教师已确认 · 仍隔离未发布',rejected:'已退回',failed:'生成失败',unavailable:'生成服务不可用'};
const text=value=>({type:'text',text:value}),heading=value=>({type:'heading',text:value}),notice=value=>({type:'notice',text:value});
const table=(headers,rows)=>({type:'table',headers,rows});
export async function draftExport(db,user,params){
  if([...params.keys()].some(k=>!['kind','id','format'].includes(k)))fail(400,'INVALID_EXPORT','导出参数不正确');
  const kind=params.get('kind'),spec=DRAFT_EXPORTS[kind],key=params.get('id'),format=params.get('format')||'document';
  if(!spec||!['document','json','csv'].includes(format)||spec.key&&!key)fail(400,'INVALID_EXPORT','需要已登记的导出类型、对象和格式');
  const doc={kind,title:spec.title,viewer:user.display_name,role:'老师',student:null,count:0,empty:false,blocks:[notice(DRAFT_NOTICE)]};let records=[],csvRows=[];
  if(kind==='draft-sources'||kind==='draft-source'){
    records=kind==='draft-source'?[sourceView(await getSource(db,user,key))]:(await draftRows(db,`SELECT * FROM draft_sources WHERE ${ownerGuard('draft_sources')} ORDER BY created_at DESC,id DESC LIMIT 100`,user.org_id,user.id)).map(sourceView);
    csvRows=[['资料ID','标题','科目','版本','SHA256','来源声明','许可声明','合成资料正文'],...records.map(s=>[s.id,s.title,s.subject,s.version,s.digest,s.sourceLabel,s.licenseDeclaration,s.text])];
    if(kind==='draft-source')for(const s of records)doc.blocks.push(heading(s.title),text(`科目 ${s.subject}；不可变版本 ${s.version}；SHA256 ${s.digest}`),text(`来源声明：${s.sourceLabel}；许可声明：${s.licenseDeclaration}（尚未核验）`),text(s.text));
    else doc.blocks.push(table(['标题','科目','版本','来源声明'],records.map(s=>[s.title,s.subject,String(s.version),s.sourceLabel])));
  }else{
    const stored=kind==='question-draft'?[await getDraftRow(db,user,key)]:await draftRows(db,`SELECT * FROM question_drafts WHERE ${ownerGuard('question_drafts')} ORDER BY created_at DESC,id DESC LIMIT 100`,user.org_id,user.id);
    for(const row of stored)records.push(await draftView(db,row,{history:kind==='question-draft'}));
    csvRows=[['批次ID','标题','状态','版本','题号','知识点','题干','选项','候选答案','候选解析','生成来源','是否发布'],...records.flatMap(d=>d.questions.length?d.questions.map(q=>[d.id,d.title,state[d.status],d.revision,q.id,q.topic,q.prompt,q.options.join('；'),String.fromCharCode(65+q.correctOption),q.rationale,d.provenance.kind,'否']):[[d.id,d.title,state[d.status],d.revision,'','','','','','',d.provenance.kind,'否']])];
    if(kind==='question-drafts')doc.blocks.push(table(['标题','状态','版本','候选数量'],records.map(d=>[d.title,state[d.status],String(d.revision),String(d.questions.length)])));
    else for(const d of records){
      doc.blocks.push(heading(d.title),notice(`${state[d.status]}；版本 ${d.revision}；没有发布到正式题库。`),text(`来源方式：${d.provenance.kind}；模型：${d.provenance.model||'未运行'}；模型执行：${d.provenance.modelExecution}；供应方版本：${d.provenance.providerRevision||'无'}`));
      if(d.errorCode)doc.blocks.push(notice(`服务未产出候选：${d.errorCode}。失败记录不表示出题成功。`));
      for(const s of d.sources)doc.blocks.push(text(`来源 ${s.title} v${s.version}；${s.digest}；${s.sourceLabel}；许可声明 ${s.licenseDeclaration}`));
      for(const v of d.history){doc.blocks.push(heading(`保存版本 ${v.revision} · ${state[v.status]}`),text(v.validation.notice||'本版本未形成可校验的题目。'));
        for(const [i,q]of v.questions.entries()){doc.blocks.push(text(`${q.topic}；${q.grade}年级；${q.phase}`),{type:'paper-item',title:`${i+1}. ${q.prompt}`,details:[...q.options.map((o,index)=>`${String.fromCharCode(65+index)}. ${o}`),`候选答案（未发布、须核验）：${String.fromCharCode(65+q.correctOption)}`,`候选解析（须人工核对）：${q.rationale}`]});for(const c of q.citations)doc.blocks.push(text(`引用 ${c.sourceId} v${c.sourceVersion}，第 ${c.lineStart}–${c.lineEnd} 行；SHA256 ${c.digest}`),text(c.text));}
        if(v.review)doc.blocks.push(notice(`复核结论 ${v.review.decision}；仍未发布。`),text(v.review.note),text(`复核人 ${v.review.reviewerId}；时间 ${v.review.reviewedAt}；这是账号确认记录，不是独立审题质量认证。`));
      }
    }
  }
  doc.count=records.length;doc.empty=!records.length;
  if(kind==='draft-sources'||kind==='question-drafts')doc.blocks.push(text('当前清单最多100条；无记录时禁止打印空业务报表。'));
  if(format==='json')return {data:{formatVersion:'1',kind,records,notice:DRAFT_NOTICE}};
  if(format==='csv'){const cell=v=>{const raw=String(v??''),safe=/^[\s]*[=+\-@\t\r]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"';};return {raw:'\ufeff'+csvRows.map(r=>r.map(cell).join(',')).join('\r\n'),headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':`attachment; filename="${kind}.csv"`}};}
  return {data:doc};
}
