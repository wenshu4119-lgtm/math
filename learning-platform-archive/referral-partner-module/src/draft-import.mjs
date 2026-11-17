import {createHash} from 'node:crypto';
import {fail} from './security.mjs';

// Parses JSON data only: never evaluates automatedCheck.expr from a source bank.
export function isolatedBankGroups(raw,{batches=null}={}){
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>2000000)fail(413,'DRAFT_BANK_TOO_LARGE','隔离草稿文件最多2MB');
  let bank;try{bank=JSON.parse(raw);}catch{fail(400,'INVALID_DRAFT_BANK','草稿库JSON不正确');}
  if(bank.isolationStatus!=='isolated_draft_only'||typeof bank.bankVersion!=='string'||!Array.isArray(bank.questions)||!bank.questions.length||bank.questions.length>300)fail(400,'INVALID_DRAFT_BANK','仅允许至多300题的隔离草稿文件');
  if(batches!==null&&(!Array.isArray(batches)||!batches.length||batches.some(n=>!Number.isInteger(n)||n<1)||new Set(batches).size!==batches.length))fail(400,'INVALID_IMPORT_SCOPE','请显式选择不重复的批次');
  const groups=new Map(),ids=new Set();
  for(const q of bank.questions){
    if(!q||typeof q.id!=='string'||ids.has(q.id)||q.reviewStatus!=='pending_human'||q.isolationStatus!=='isolated_draft_only'||q.source!=='original_authored_cc0'||q.license!=='CC0-1.0'||!['math','english'].includes(q.subject)||typeof q.knowledgeId!=='string'||typeof q.knowledgeTitle!=='string'||!Array.isArray(q.options)||q.options.length!==4||q.options.some(v=>typeof v!=='string')||typeof q.prompt!=='string'||typeof q.rationale!=='string')fail(400,'INVALID_DRAFT_BANK','草稿状态、来源声明或题目结构不符合导入边界');
    ids.add(q.id);if(batches&&!batches.includes(q.batch))continue;const key=`${q.subject}:${q.knowledgeId}`;const group=groups.get(key)||{key,title:q.knowledgeTitle,subject:q.subject,items:[]};group.items.push(q);if(group.items.length>3)fail(400,'DRAFT_BATCH_TOO_LARGE','每知识点批次最多3题');groups.set(key,group);
  }
  const digest=createHash('sha256').update(raw).digest('hex');
  const selected=[...groups.values()].flatMap(g=>g.items);if(!selected.length||selected.length>60)fail(400,'IMPORT_SCOPE_TOO_LARGE','本轮转存最多60题；请显式选择批次，不能静默截断');
  return {bankVersion:bank.bankVersion,digest,inputQuestionCount:bank.questions.length,questionCount:selected.length,selectedBatches:batches,excludedIds:bank.questions.filter(q=>!selected.includes(q)).map(q=>q.id),groups:[...groups.values()].map(group=>{
    const lines=[`原型隔离草稿 ${bank.bankVersion}：${group.title}`,`仅为候选转存来源；不是已核验教材。原文件SHA256 ${digest}`],questions=[];
    for(const q of group.items){const start=lines.length+1;lines.push(`原始ID：${q.id}；${q.phase}`,q.prompt,...q.options.map((v,i)=>`${String.fromCharCode(65+i)}. ${v}`),`候选解析：${q.rationale}`);
      questions.push({topic:group.title,grade:q.grade,phase:q.phase,prompt:q.prompt,options:q.options,correctOption:q.correctOption,rationale:q.rationale,citationLines:{start,end:lines.length}});
    }
    return {...group,items:undefined,text:lines.join('\n'),questions};
  })};
}
