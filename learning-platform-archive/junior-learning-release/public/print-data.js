import {DRAFT_EXPORTS} from './draft-export-registry.js';
import {loadDraftDocument} from './draft-print-loader.js';
import { EXPORTS } from './export-registry.js';
import {scopeDescription,scopeSummary} from './assessment-scope.js';
const subjects={math:'数学',english:'英语'},phases={diagnostic:'筛查',practice:'练习',retest:'复测'},roles={admin:'管理员',teacher:'老师',student:'学生',parent:'家长'};
const statuses={draft:'待教师审核',approved:'已批准',in_progress:'学习中',completed:'已完成'};
const hwStatus={draft:'草稿未发布',published:'已发布待提交',submitted:'已提交待人工批改',graded:'已人工批改'};
export async function readApi(path,expectedActor=null,options={}){
  options.assertCurrent?.();let res;try{res=await fetch(`/api/v1${path}`,{credentials:'same-origin',cache:'no-store',signal:options.signal});}catch{throw new Error('网络不可用，未能验证最新权限。请联网后重试。');}
  options.assertCurrent?.();
  if([401,403,404].includes(res.status))throw new Error('账号或资料授权已失效，请重新登录并打开导出入口。');
  const actor=res.headers.get('X-Actor-Id');if(res.ok&&(!actor||(expectedActor&&actor!==expectedActor)))throw new Error('登录身份无法匹配，请重新打开导出预览。');
  let result;try{result=await res.json();}catch{throw new Error('服务响应无法验证，已阻止导出。');}options.assertCurrent?.();
  if(!res.ok)throw new Error(result.error?.message||'权限或数据无法验证，已阻止导出。');if(!result||!Object.hasOwn(result,'data'))throw new Error('服务数据不完整，已阻止导出。');
  if(path==='/auth/session'&&result.data?.user?.id!==actor)throw new Error('会话身份无法验证，已阻止导出。');return result.data;
}
const section=text=>({type:'heading',text}),text=(value,extra={})=>({type:'text',text:value,...extra}),table=(headers,rows)=>({type:'table',headers,rows}),notice=value=>({type:'notice',text:value});
const date=value=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—';
async function studentName(id,actor){const list=await readApi('/students',actor);const student=list.find(s=>s.id===id);if(!student)throw new Error('没有查看该学生的权限。');return student.displayName;}
function questions(qs,includeAnswers=true,writing=false){return qs.map((q,i)=>({type:'question',number:i+1,prompt:q.prompt,options:q.options,...(includeAnswers&&Number.isInteger(q.correctOption)?{correctOption:q.correctOption,rationale:q.rationale,selectedOption:q.selectedOption}:{}),writing}));}
function packBlocks(p){return [notice(`示例学习包 · ${statuses[p.status]} · 版本 ${p.revision}。${p.status==='draft'?'尚未批准，不能用于正式学习。':''}`),...p.materials.flatMap(m=>[section(m.title),text(m.explanation),text(`记背卡：${m.memoryCard}`,{memory:true})]),section('教师指导'),text(p.teacherNote||'暂无额外指导。'),text(`匹配规则：${p.algorithm}。审核时间：${date(p.reviewedAt)}。`)]}
function paperSummaryBlocks(records){return [notice('实际卷面分、0–3人工能力观察与在线作答分别记录；未复测不推断进步。'),table(['标题 / 科目','证据来源','已确认结果','确认时间'],records.map(p=>[`${p.title} / ${subjects[p.subject]}`,p.kind==='scored_paper'?'人工卷面评分':'人工能力观察',p.score?`${p.score.earned} / ${p.score.max} 分（卷面得分率 ${p.score.percent}%）`:p.observationCounts.map(o=>`${o.level}档:${o.count}条`).join('；'),date(p.confirmedAt)]))];}
export async function loadDocument(kind,params,options={}){
  const scopedRead=(path,actor=null)=>readApi(path,actor,options);
  const session=await scopedRead('/auth/session',options.expectedActor??null);if(session.user.mustChangePassword)throw new Error('请先更新初始密码。');
  const finish=async doc=>{const current=await scopedRead('/auth/session',session.user.id);if(current.user.role!==session.user.role||current.user.mustChangePassword)throw new Error('账号角色或状态已变化，请重新打开导出入口。');options.assertCurrent?.();return {...doc,authorization:{actorId:session.user.id,role:session.user.role,scope:kind+'?'+params.toString(),expiresAt:current.expiresAt??null}};};
  if(Object.hasOwn(DRAFT_EXPORTS,kind))return finish(await loadDraftDocument(kind,params,(path,actor)=>scopedRead(path,actor??session.user.id)));
  const spec=EXPORTS[kind];if(!spec)throw new Error('该内容尚未登记导出能力。');
  if(!spec.roles.includes(session.user.role))throw new Error('当前账号没有此导出权限。');
  const read=path=>scopedRead(path,session.user.id);
  if(kind==='time-plan'){const {loadTimePlanDocument}=await import('./planning/print-loader.js');return finish(await loadTimePlanDocument(params,session,read));}
  const value=spec.key?params.get(spec.key):null;
  if(spec.key&&!spec.optional&&!value)throw new Error('缺少导出对象，请返回业务页面重新打开。');
  const doc={kind,title:spec.title,viewer:session.user.displayName,role:roles[session.user.role],student:null,blocks:[],empty:false,count:0};
  const sid=params.get('studentId');
  const studentName=async(id,actor)=>{const list=await scopedRead('/students',actor),student=list.find(s=>s.id===id);if(!student)throw new Error('没有查看该学生的权限。');return student.displayName;};
  if(['growth','attempts','packs','uploads','papers','paper-summaries','homeworks','homework-summaries'].includes(kind))doc.student=await studentName(sid,session.user.id);
  if(kind==='growth'){
    const g=await read(`/students/${encodeURIComponent(sid)}/growth`);doc.count=g.evidence.length+(g.paperEvidence?.length||0)+(g.homeworkEvidence?.length||0);doc.empty=!doc.count;doc.blocks.push(notice(g.notice));
    if(!doc.empty){doc.blocks.push(section('知识点作答记录'),table(['知识点','阶段','答对 / 作答'],g.topicEvidence.map(t=>[t.title,phases[t.phase],`${t.correct} / ${t.answered}`])));
      for(let i=0;i<g.topicEvidence.length;i+=6)doc.blocks.push({type:'chart',rows:g.topicEvidence.slice(i,i+6).map(t=>({label:`${t.title} · ${phases[t.phase]}`,correct:t.correct,total:t.answered}))});
      doc.blocks.push(section('真实学习时间线'),table(['时间','科目 / 阶段 / 保存范围','答对 / 总题数','来源'],g.evidence.map(a=>[date(a.submittedAt),`${subjects[a.subject]} / ${phases[a.phase]}；${scopeSummary(a.scope)}`,`${a.correct}/${a.total}`,a.source==='student_self'?'自主作答':'教师录入'])));
      if(g.comparisons.length)doc.blocks.push(section('同一学习包的前后记录'),table(['筛查答对 / 总题数','复测答对 / 总题数'],g.comparisons.map(c=>[`${c.diagnosticCorrect}/${c.diagnosticTotal}`,`${c.retestCorrect}/${c.retestTotal}`])),text('题目与范围可能不同，不直接换算能力增长率。'));
      if(g.paperEvidence?.length)doc.blocks.push(section('线下人工记录（独立口径）'),...paperSummaryBlocks(g.paperEvidence));
      if(g.homeworkEvidence?.length)doc.blocks.push(section('独立作业（实际提交，独立口径）'),table(['作业','提交时间','状态','人工成绩'],g.homeworkEvidence.map(h=>[h.title,date(h.submittedAt),hwStatus[h.status],h.score?`${h.score.earned} / ${h.score.max}`:'待人工批改，暂无成绩'])),text('作业不自动作为通关练习或复测，不换算为能力提高。'));
    }
  }else if(kind==='homeworks'){
    const records=await read(`/homeworks?studentId=${encodeURIComponent(sid)}`);doc.count=records.length;doc.empty=!doc.count;doc.blocks.push(table(['作业','科目','状态','截止提示'],records.map(h=>[h.title,subjects[h.subject],hwStatus[h.status],date(h.dueAt)])),text('最多最近100份；草稿仅负责人可见，未提交不进入成长证据。'));
  }else if(kind==='homework-summaries'){
    const records=await read(`/students/${encodeURIComponent(sid)}/homework-summaries`);doc.count=records.length;doc.empty=!doc.count;doc.blocks.push(notice('本摘要不含题目答案、学生作答正文和逐题反馈；未提交安排不代表已学习。'),table(['作业','状态','人工成绩','给家长的摘要'],records.map(h=>[h.title,hwStatus[h.status],h.score?`${h.score.earned} / ${h.score.max}`:h.status==='published'?'尚未提交':'待人工批改',h.familySummary||'未填写公开摘要'])));
  }else if(['homework','homework-sheet','homework-feedback'].includes(kind)){
    const suffix=kind==='homework-sheet'?'/sheet':kind==='homework-feedback'?'/feedback':'';const task=await read(`/homeworks/${encodeURIComponent(value)}${suffix}`);doc.student=await studentName(task.studentId,session.user.id);doc.title=`${task.title} · ${kind==='homework-sheet'?'无答案作业单':kind==='homework-feedback'?'人工批改反馈':'保存记录'}`;doc.count=task.questions.length;doc.empty=!doc.count;
    doc.blocks.push(notice(`${hwStatus[task.status]}。${task.notice}`),text(`科目：${subjects[task.subject]}；截止提示：${date(task.dueAt)}；版本：${task.revision}。`));if(task.instructions)doc.blocks.push(section('教师指引'),text(task.instructions));
    if(kind==='homework-sheet'){doc.blocks.push(notice('本作业单不含标准答案或学生提交内容。纸面完成后须由学生本人在平台提交，才形成作业记录。'),...questions(task.questions,false,true));}
    else{
      if(session.user.role==='teacher'&&task.status!=='graded')doc.blocks.push(notice('教师用记录：包含参考答案，请不要当作无答案作业单发给学生。'));
      for(const q of task.questions)doc.blocks.push({type:'homework-item',question:q});
      if(task.status==='submitted')doc.blocks.push(notice('已实际提交，尚未人工批改；没有成绩，不能将空值当作0分。'));
      if(task.result)doc.blocks.push(section('人工批改结果'),text(`教师人工分数：${task.result.score.earned} / ${task.result.score.max}。评分来源：teacher_homework_marked；没有OCR/RAG判分。`),section('给学生的反馈'),text(task.feedback),section('给家长的公开摘要'),text(task.familySummary||'未填写公开摘要'));
      if(task.paperReference)doc.blocks.push(text(`人工阅卷参考：${task.paperReference.title}；只建立引用，不自动换算作业分数。`));
    }
  }else if(kind==='papers'){
    const records=await read(`/papers?studentId=${encodeURIComponent(sid)}`);doc.count=records.length;doc.empty=!doc.count;doc.blocks.push(table(['标题','科目','证据类型','状态'],records.map(p=>[p.title,subjects[p.subject],p.kind==='scored_paper'?'卷面实际成绩':'0–3人工能力观察',p.status==='confirmed'?'已确认':'草稿，未确认'])),text('最多最近100条；草稿不计入正式报告或成长摘要。'));
  }else if(kind==='paper-summaries'){
    const records=await read(`/students/${encodeURIComponent(sid)}/paper-summaries`);doc.count=records.length;doc.empty=!doc.count;doc.blocks.push(...paperSummaryBlocks(records));
  }else if(kind==='paper'||kind==='paper-report'){
    const p=await read(`/papers/${encodeURIComponent(value)}${kind==='paper-report'?'/report':''}`);doc.student=await studentName(p.studentId,session.user.id);doc.title=`${p.title} · ${kind==='paper-report'?'人工阅卷报告':'逐题核对明细'}`;doc.count=p.items.length;doc.empty=!doc.count;
    doc.blocks.push(notice(`${p.status==='confirmed'?'已人工复核确认':'草稿尚未确认，不是正式成绩'} · ${p.kind==='scored_paper'?'实际卷面评分':'0–3能力观察，不换算分数'}。${p.notice}`),text(`内容来源：${p.ocrProvenance?'教师核对过的OCR文字':'人工录入'}；评分来源：${p.source}；版本 ${p.revision}；确认时间 ${date(p.confirmedAt)}。`));
    if(p.ocrProvenance)doc.blocks.push(text(`OCR来源：${p.ocrProvenance.provider.id} ${p.ocrProvenance.provider.version}；文字由教师于${date(p.ocrProvenance.reviewedAt)}核对；原图摘要 ${p.ocrProvenance.imageDigest}。评分仍为人工，不由OCR生成。`));
    if(p.report){const r=p.report;doc.blocks.push(section('已确认汇总'),text(r.score?`实际得分 ${r.score.earned} / ${r.score.max}；卷面得分率 ${r.score.percent}%。`:r.observationCounts.map(x=>`${x.level}档：${x.count}条`).join('；')),text(`叶子题/观察 ${r.itemCount} 项；未映射 ${r.unresolvedCount} 项，仅到章节 ${r.chapterOnlyCount} 项；算法 ${r.algorithmVersion}；AI未参与评分。`));if(r.byScope.length)doc.blocks.push(table(['范围','映射层级','实际得分 / 满分'],r.byScope.map(g=>[g.scopeText,g.mappingLevel==='knowledge'?'知识点':g.mappingLevel==='chapter'?'章节':'未映射',`${g.score.earned} / ${g.score.max}`])));}
    doc.blocks.push(section('逐题 / 小题人工复核'));
    for(const i of p.items)doc.blocks.push({type:'paper-item',title:`${i.questionNo}. ${i.prompt}`,details:[`所属大题：${i.parentNo||'独立题'}；范围：${i.scopeText}（${i.mappingLevel==='knowledge'?'知识点':i.mappingLevel==='chapter'?'章节':'未映射'}）`,p.kind==='scored_paper'?`满分：${i.maxScore??'待填写'}；实际得分：${i.earnedScore??'待填写'}${i.earnedScore>0&&i.earnedScore<i.maxScore?'（部分分）':''}`:`人工观察：${i.observationLevel??'待观察'}档`,`核对说明：${i.note||'无补充说明'}`,`本题核对：${i.reviewed?'教师已勾选核对':'待核对'}`]});
    if(p.attachment?.available)doc.blocks.push(section('关联原图'),{type:'image',src:`/api/v1/uploads/${encodeURIComponent(p.attachment.id)}/image`,caption:'按原图现有访问权限加载；原图到期不删除已经确认的评分记录。'});else if(p.attachment)doc.blocks.push(text('关联原图已过期，不影响已确认人工评分记录。'));
  }else if(kind==='attempt'){
    const a=await read(`/attempts/${encodeURIComponent(value)}`);doc.student=await studentName(a.studentId,session.user.id);doc.title=`${subjects[a.subject]}${phases[a.phase]} · 题目与${a.status==='submitted'?'报告解析':'作答单'}`;doc.count=a.questions.length;doc.empty=!doc.count;
    doc.blocks.push(notice('原创微型示例题；每个知识点每阶段仅一题，不代表完整能力测量。'),text(scopeDescription(a.scope)),text(a.status==='submitted'?`已提交 ${date(a.submittedAt)} · 答对 ${a.result.correct}/${a.result.total} 题 · ${a.source==='student_self'?'学生自主作答':'教师录入'}`:'尚未提交，不能导出标准答案或成绩。'),...questions(a.questions));
  }else if(kind==='attempts'){
    const list=await read(`/attempts?studentId=${encodeURIComponent(sid)}`);doc.count=list.length;doc.empty=!doc.count;doc.blocks.push(table(['科目','类型 / 保存范围','状态','创建时间'],list.map(a=>[subjects[a.subject],`${phases[a.phase]}；${scopeSummary(a.scope)}`,a.status==='submitted'?'已提交':'未提交',date(a.createdAt)])),text('当前最多显示最近 100 条记录；未覆盖知识点不作诊断，不补0分。'));
  }else if(kind==='pack'){
    const p=await read(`/packs/${encodeURIComponent(value)}`);doc.student=await studentName(p.studentId,session.user.id);doc.count=p.materials.length;doc.empty=!doc.count;doc.blocks.push(...packBlocks(p));
  }else if(kind==='packs'){
    const list=await read(`/packs?studentId=${encodeURIComponent(sid)}`);doc.count=list.length;doc.empty=!doc.count;doc.blocks.push(table(['科目','内容','状态','版本'],list.map(p=>[subjects[p.subject],p.materials.map(m=>m.title).join('、'),statuses[p.status],String(p.revision)])),text('当前最多显示最近 100 个学习包。'));
  }else if(kind==='assignment'){
    const p=await read(`/packs/${encodeURIComponent(value)}/worksheet`);doc.student=await studentName(p.studentId,session.user.id);doc.title=`${subjects[p.subject]}通关练习作业单`;doc.count=p.questions.length;doc.empty=!doc.count;doc.blocks.push(notice('已审核的原创示例练习。此打印不创建或提交学习记录；需要在平台实际提交才能进入成长档案。'),text(`教师指导：${p.teacherNote||'请先复习对应记背卡，再独立完成。'}`),...questions(p.questions,false,true));
  }else if(kind==='content'){
    const queue=await read('/content/review-queue');const ts=value?queue.filter(t=>t.id===value):queue;
    doc.count=ts.length;doc.empty=!doc.count;
    for(const t of ts)doc.blocks.push(section(t.title),notice(`${t.reviewStatus==='human_reviewed'?'本机构教师已确认审核':'待教师人工审核，不能当作已验证内容'} · 示例 v${t.version}`),text(t.explanation),text(`记背卡：${t.memory_card}`,{memory:true}),...questions(t.questions),text(`出处：${t.source}；审核时间：${date(t.reviewed_at)}。`));
  }else if(kind==='knowledge'){
    const list=await read(`/knowledge?subject=${encodeURIComponent(value)}`);doc.count=list.length;doc.empty=!doc.count;doc.blocks.push(notice('仅为示例知识点目录，不是完整初中课程标准。'),table(['知识点','版本','审核状态'],list.map(t=>[t.title,String(t.version),t.reviewStatus==='human_reviewed'?'本机构已人工审核':'待人工审核'])));
  }else if(kind==='uploads'){
    const list=await read(`/uploads?studentId=${encodeURIComponent(sid)}`);doc.count=list.length;doc.empty=!doc.count;doc.blocks.push(notice('仅列出未过期图片。OCR 服务未接通；人工核对不等于题目审核或评分。'),table(['记录编号','核对状态','到期时间'],list.map(u=>[u.id,u.status==='confirmed'?'已人工核对':'待核对',date(u.expiresAt)])));
  }else if(kind==='ocr-runs'){
    const u=await read(`/uploads/${encodeURIComponent(value)}`),list=await read(`/uploads/${encodeURIComponent(value)}/ocr-runs`);doc.student=await studentName(u.studentId,session.user.id);doc.count=list.length;doc.empty=!doc.count;doc.blocks.push(notice('OCR只提取未审核文字，不生成评分；置信分不是准确率。'),table(['创建时间','状态','引擎','教师核对'],list.map(r=>[date(r.createdAt),r.status,`${r.provider.id} ${r.provider.version}`,r.reviewedAt?date(r.reviewedAt):'未核对'])));
  }else if(kind==='ocr-run'){
    const r=await read(`/ocr-runs/${encodeURIComponent(value)}`);doc.student=await studentName(r.studentId,session.user.id);doc.count=1;if(r.status==='failed')doc.title='OCR识别失败记录';doc.blocks.push(notice(`${r.status==='teacher_confirmed'?'老师已核对文字；不等于试题已审核或评分':r.status==='failed'?'识别失败，不存在可确认的识别文字':r.status==='running'?'正在识别，尚无结果':'待教师审核 / 尚无正式学习记录'}。${r.notice}`),text(`状态：${r.status}；来源：${r.provider.id} ${r.provider.version}；语言：${r.language}；引擎置信分：${r.confidence??'无'}（不是正确率）；时间：${date(r.createdAt)}。`));
    if(r.errorCode)doc.blocks.push(text(`识别失败：${r.errorCode}；没有生成替代文字。`));
    if(r.text)doc.blocks.push(section('OCR原文（保留识别错误，未修改）'),text(r.text,{long:true}));
    if(r.reviewedText)doc.blocks.push(section('教师核对后的文字'),text(r.reviewedText,{long:true}),text(`教师核对时间：${date(r.reviewedAt)}；版本 ${r.revision}。`));
    doc.blocks.push(section('原图'),{type:'image',src:`/api/v1/uploads/${encodeURIComponent(r.uploadId)}/image`,caption:'原图与识别记录共用私有访问边界和到期时间。'});
  }else if(kind==='upload'){
    const u=await read(`/uploads/${encodeURIComponent(value)}`);doc.student=await studentName(u.studentId,session.user.id);doc.count=1;doc.blocks.push(notice(u.notice),text(`核对状态：${u.status==='confirmed'?'已确认':'待核对'}；图片访问到期：${date(u.expiresAt)}。`),{type:'image',src:`/api/v1/uploads/${encodeURIComponent(u.id)}/image`,caption:'私有试卷图片，仅供当前已授权用户导出。'},section('人工核对文本'),text(u.correctedText||'尚无人工核对文本。',{long:true}));
  }else if(kind==='roster'){
    const list=await read('/students');doc.count=list.length;doc.empty=!doc.count;doc.blocks.push(table(['显示别名'],list.map(s=>[s.displayName])),text('只包含当前账号可以访问的学生。'));
  }else if(kind==='admin-users'){
    const list=await read('/admin/users');doc.count=list.length;doc.empty=!doc.count;doc.blocks.push(table(['登录别名','显示别名','角色','状态'],list.map(u=>[u.username,u.displayName,roles[u.role],u.active?'有效':'停用'])),text('当前机构最多 200 条；不包含初始密码、密码哈希或会话。'));
  }else if(kind==='admin-relationships'){
    const [links,users]=await Promise.all([read('/admin/relationships'),read('/admin/users')]);const names=new Map(users.map(u=>[u.id,u.displayName]));doc.count=links.length;doc.empty=!doc.count;doc.blocks.push(table(['老师 / 家长','学生','授权类型'],links.map(l=>[names.get(l.adultId)||l.adultId,names.get(l.studentId)||l.studentId,roles[l.kind]])),text('当前机构最多 200 条关系。'));
  }else if(kind==='admin-audit'){
    const list=await read('/admin/audit');doc.count=list.length;doc.empty=!doc.count;doc.blocks.push(table(['时间','事件','操作者 ID','对象 ID'],list.map(e=>[date(e.createdAt),e.action,e.actorId,e.resourceId])),text('最近 100 条脱敏事件；不包含密码、原图、题干、作答内容或用户输入。'));
  }
  return finish(doc);
}
