import {createHomeworkGrade} from './teacher-editors.js';
import {safeCsvCell} from './paper-workspace.js';
export const homeworkStatuses={draft:'草稿 · 未发布',published:'已发布 · 待提交',submitted:'已提交 · 待人工批改',graded:'已人工批改'};
const subjects={math:'数学',english:'英语'};
const time=v=>v?new Date(v).toLocaleString('zh-CN',{hour12:false}):'未设置';
let viewSerial=0;
function beginView(ctx){const serial=++viewSerial,marker=ctx.el('span',{hidden:true});return {active:()=>ctx.main.isConnected&&serial===viewSerial&&marker.parentNode===ctx.main,replace:(...children)=>ctx.main.replaceChildren(marker,...children)};}
export function homeworkCsv(h){return '\ufeff'+[['作业','状态','题目','选项作答','过程','满分','人工得分','逐题反馈','标准答案（仅有权查看时）','来源'],...h.questions.map(q=>[h.title,homeworkStatuses[h.status],q.prompt,Number.isInteger(q.selectedOption)?String.fromCharCode(65+q.selectedOption):'',q.workText??'',q.maxScore,q.earnedScore??'',q.teacherNote??'',Number.isInteger(q.correctOption)?String.fromCharCode(65+q.correctOption):'',h.source||'尚无提交'])].map(row=>row.map(safeCsvCell).join(',')).join('\r\n');}
function localDate(value){if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function scoreLabel(h){return h.score?`${h.score.earned} / ${h.score.max} 分`:'待人工批改';}

export async function renderHomeworks(ctx){
  const {api,main,user,studentId,el,h,card,row,btn,notice,exportsFor}=ctx;
  if(!main.isConnected)return;ctx.onEnter?.();main.classList.add('homework-surface');const view=beginView(ctx),current=view.active;ctx={...ctx,viewIsCurrent:current};
  view.replace(ctx.heading('独立作业中心','老师发布已审核练习 → 学生实际提交 → 老师人工反馈；不自动作为复测。'));
  window.scrollTo(0,0);main.focus({preventScroll:true});
  if(user.role==='parent'){
    main.append(exportsFor('homework-summaries',{studentId},'授权作业摘要'));
    let list;try{list=await api(`/students/${studentId}/homework-summaries`);}catch(error){if(current())main.append(notice(error.message),btn('重新读取作业摘要',()=>renderHomeworks(ctx),'secondary'));return;}if(!current())return;if(!list.length)main.append(ctx.empty('尚无已发布的作业安排。'));
    for(const task of list)main.append(card(h('span',homeworkStatuses[task.status],'tag'),h('h3',task.title),h('p',`截止提示：${time(task.dueAt)}`),h('p',task.status==='graded'?scoreLabel(task):task.status==='submitted'?'学生已提交，暂无成绩。':'尚未提交，不作为成长证据。'),task.familySummary?h('p',`老师给家长的摘要：${task.familySummary}`):null,h('small','家长只读摘要，不读取题目答案、作答正文和逐题批改。')));return;
  }
  main.append(row(exportsFor('homeworks',{studentId},'作业清单'),exportsFor('homework-summaries',{studentId},'已发布摘要')));
  if(user.role==='teacher'){
    main.append(notice('本阶段一份作业发给一个绑定学生，由创建老师负责。仅选本机构已审核练习；发布后内容与分值冻结。'));
    const sub=el('select',{'aria-label':'作业科目'},el('option',{value:'math'},'数学'),el('option',{value:'english'},'英语')),holder=el('div',{});main.append(card(row(h('h3','从已审核内容创建'),sub),holder));
    let catalogSerial=0;async function form(){const sequence=++catalogSerial,subject=sub.value;holder.replaceChildren(h('p','正在加载已审核练习…','muted'));try{const catalog=await api(`/homework-catalog?subject=${subject}`);if(!current()||sequence!==catalogSerial)return;if(!catalog.length){holder.replaceChildren(ctx.empty('本科目尚无已审核练习，请先完成内容审核。'));return;}holder.replaceChildren(editor(ctx,{subject,title:'',instructions:'',questions:[],revision:0},catalog,null));}catch(error){if(current()&&sequence===catalogSerial)holder.replaceChildren(notice(error.message));}}
    sub.addEventListener('change',form);await form();
  }
  let list;try{list=await api(`/homeworks?studentId=${studentId}`);}catch(error){if(current())main.append(notice(error.message),btn('重新读取作业列表',()=>renderHomeworks(ctx),'secondary'));return;}if(!current())return;main.append(h('h2',user.role==='teacher'?'我负责的作业':'我的作业'));
  if(!list.length)main.append(ctx.empty(user.role==='teacher'?'没有已保存的作业草稿。':'暂无已发布给你的独立作业。'));
  for(const task of list)main.append(card(h('span',homeworkStatuses[task.status],'tag'),h('h3',task.title),h('p',`${subjects[task.subject]} · 截止提示 ${time(task.dueAt)}`,'muted'),btn(task.status==='draft'?'编辑并发布':task.status==='published'&&user.role==='student'?'开始作答':task.status==='submitted'&&user.role==='teacher'?'人工批改':'查看作业记录',()=>openHomework(ctx,task.id))));
}
function editor(ctx,task,catalog,sourcePackId){
  const {api,el,h,row,btn,notify,studentId}=ctx;
  const title=el('input',{required:true,maxlength:100,value:task.title,'aria-label':'作业标题',placeholder:'例如：分数与方程课后巩固'}),instructions=el('textarea',{maxlength:1000,'aria-label':'作业指引'},task.instructions||''),due=el('input',{type:'datetime-local',value:localDate(task.dueAt),'aria-label':'作业截止提示'});
  const form=el('form',{class:'stack homework-editor'},el('label',{},'标题',title),el('label',{},'教师指引（可选）',instructions),el('label',{},'截止提示（可选，迟交仍可提交）',due));
  const choices=catalog.map(q=>{const chosen=task.questions.find(i=>i.id===q.id),check=el('input',{type:'checkbox',value:q.id,checked:!!chosen}),max=el('input',{type:'number',min:'0.01',max:1000,step:'0.01',value:chosen?.maxScore??1,'aria-label':`${q.id} 满分`});form.append(el('section',{class:'question'},el('label',{class:'checkline'},check,q.prompt),h('p',q.options.map((o,i)=>`${String.fromCharCode(65+i)}. ${o}`).join('；'),'muted'),el('label',{},'本题满分',max)));return {q,check,max};});
  const requestId=crypto.randomUUID();form.append(el('button',{type:'submit'},task.id?'保存作业草稿':'创建独立作业草稿'));
  form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button[type=submit]');button.disabled=true;try{const items=choices.filter(c=>c.check.checked).map(c=>({questionId:c.q.id,maxScore:Number(c.max.value)}));const common={title:title.value,instructions:instructions.value,dueAt:due.value?new Date(due.value).toISOString():null,items,sourcePackId:sourcePackId||null};const result=await api(task.id?`/homeworks/${task.id}`:'/homeworks',{method:task.id?'PATCH':'POST',body:task.id?{...common,revision:task.revision}:{...common,studentId,subject:task.subject,requestId}});if(form.isConnected&&ctx.viewIsCurrent())await openHomework(ctx,result.id);}catch(error){notify(error.message,true);button.disabled=false;}});return form;
}
export async function homeworkFromPack(ctx,pack,requestId=crypto.randomUUID()){
  const sheet=await ctx.api(`/packs/${pack.id}/worksheet`);const result=await ctx.api('/homeworks',{method:'POST',body:{studentId:pack.studentId,subject:pack.subject,title:`${subjects[pack.subject]} · 通关包独立作业`,instructions:pack.teacherNote||'完成已学知识点的课后练习。',sourcePackId:pack.id,requestId,items:sheet.questions.map(q=>({questionId:q.id,maxScore:1}))}});if(ctx.isSourceCurrent?.()!==false&&ctx.main.isConnected)await openHomework(ctx,result.id);
}
export async function openHomework(ctx,homeworkId){
  const {api,main,user,studentId,el,h,card,row,btn,notice,exportsFor,notify}=ctx;if(!main.isConnected)return;ctx.onEnter?.();main.classList.add('homework-surface');const view=beginView(ctx),current=view.active;ctx={...ctx,viewIsCurrent:current};
  view.replace(ctx.heading('正在加载作业…','正在核对当前账号与资源权限。',btn('返回作业中心',()=>renderHomeworks(ctx),'secondary')));let task;
  try{task=await api(`/homeworks/${homeworkId}`);}catch(error){if(current())view.replace(ctx.heading('作业暂不可读取','请检查权限或重试。'),notice(error.message),btn('返回作业中心',()=>renderHomeworks(ctx),'secondary'));return;}
  if(!current())return;
  view.replace(ctx.heading(task.title,`${subjects[task.subject]} · ${homeworkStatuses[task.status]}`,btn('返回作业中心',()=>renderHomeworks(ctx),'secondary')),notice(task.notice),h('p',`截止提示：${time(task.dueAt)}${task.late?' · 已记录为迟交，不自动扣分。':''}`,'muted'));
  window.scrollTo(0,0);main.focus({preventScroll:true});
  main.append(row(exportsFor('homework-sheet',{id:task.id},'无答案作业单'),exportsFor('homework',{id:task.id},user.role==='teacher'?'教师记录（含参考答案）':'本人作业记录')));
  if(task.status==='graded')main.append(exportsFor('homework-feedback',{id:task.id},'人工批改反馈'));
  async function download(format){const current=await api(`/homeworks/${task.id}`);const url=URL.createObjectURL(new Blob([format==='csv'?homeworkCsv(current):JSON.stringify({formatVersion:'1',...current},null,2)],{type:format==='csv'?'text/csv;charset=utf-8':'application/json;charset=utf-8'}));const link=el('a',{href:url,download:`homework-${task.id}.${format}`});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  main.append(row(btn('导出作业 JSON',()=>download('json'),'secondary'),btn('导出作业 CSV',()=>download('csv'),'secondary'),btn('刷新作业记录',()=>openHomework(ctx,task.id),'quiet')));
  main.append(h('p',user.role==='teacher'?'导出使用服务器已保存版本；未保存的作答或批改不会写进文件。教师记录可能含参考答案，发给学生请使用无答案作业单。':'导出使用服务器已保存、当前账号有权查看的内容；尚未保存的输入不会写进文件。','fineprint'));
  if(task.instructions)main.append(card(h('h3','老师的指引'),h('p',task.instructions)));
  if(task.sourcePackId)main.append(card(h('p',`来源通关包版本 ${task.sourcePackRevision}；本作业保留发布时题目。链接打开当前学习包，作业提交不自动完成通关练习或复测。`),btn('回到来源通关包',async()=>{const pack=await api(`/packs/${task.sourcePackId}`);if(current())await ctx.openPack(pack);},'secondary')));
  if(task.status==='draft'){
    const all=await api(`/homework-catalog?subject=${task.subject}`),sourcePack=task.sourcePackId?await api(`/packs/${task.sourcePackId}`):null;if(!current())return;const catalog=sourcePack?all.filter(q=>sourcePack.knowledgeIds.includes(q.knowledgeId)):all,form=editor(ctx,task,catalog,task.sourcePackId),confirm=el('input',{type:'checkbox'});let dirty=false;
    const publish=btn('确认发布给当前学生',async()=>{if(dirty)throw new Error('请先保存草稿修改。');if(!confirm.checked)throw new Error('请先核对发布对象、题目与分值并勾选确认。');await api(`/homeworks/${task.id}/publish`,{method:'POST',body:{revision:task.revision,confirmed:true}});if(current())await openHomework(ctx,task.id);});
    const changed=()=>{dirty=true;confirm.checked=false;publish.disabled=true;};form.addEventListener('input',changed);form.addEventListener('change',changed);main.append(card(h('h2','调整草稿'),form),card(el('label',{class:'checkline'},confirm,'我已核对学生、已审核题目、分值与截止提示，确认发布。'),publish));return;
  }
  if(user.role==='student'&&task.status==='published'){
    if(!task.acceptingSubmissions){main.append(notice('负责老师或授课关系已失效，暂不收新作答。历史内容仍可查看。'));}
    const form=el('form',{}),fields=[];
    for(const [index,q]of task.questions.entries()){const work=el('textarea',{maxlength:2000,'aria-label':`${q.id} 作答过程`,placeholder:'可选：写出关键步骤或说明。图片不是本模块的必需提交材料。'}),section=el('fieldset',{class:'question'},h('legend',`${index+1}. ${q.prompt}（${q.maxScore}分）`));q.options.forEach((option,n)=>section.append(el('label',{class:'option'},el('input',{type:'radio',name:q.id,value:n,required:true,disabled:!task.acceptingSubmissions}),`${String.fromCharCode(65+n)}. ${option}`)));section.append(el('label',{},'作答过程（可选，随提交保存）',work));form.append(section);fields.push({q,work});}
    const requestId=crypto.randomUUID(),submit=el('button',{type:'submit',disabled:!task.acceptingSubmissions},'提交本人实际作业');form.append(submit);form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{const data=new FormData(form);await api(`/homeworks/${task.id}/submit`,{method:'POST',body:{revision:task.revision,requestId,answers:fields.map(({q,work})=>({questionId:q.id,selectedOption:Number(data.get(q.id)),workText:work.value}))}});if(current())await openHomework(ctx,task.id);}catch(error){notify(error.message,true);submit.disabled=false;}});main.append(form);return;
  }
  for(const [index,q]of task.questions.entries())main.append(card(h('h3',`${index+1}. ${q.prompt}`),h('p',q.options.map((o,i)=>`${String.fromCharCode(65+i)}. ${o}`).join('；')),h('p',`满分：${q.maxScore}`),Number.isInteger(q.selectedOption)?h('p',`学生选择：${String.fromCharCode(65+q.selectedOption)}；过程：${q.workText||'未填写额外过程'}`):h('p','学生尚未提交，不产生作答或成绩。','muted'),Number.isInteger(q.correctOption)?h('p',`参考答案：${String.fromCharCode(65+q.correctOption)}；${q.rationale}`):null,task.status==='graded'?h('p',`人工得分：${q.earnedScore}/${q.maxScore}；反馈：${q.teacherNote||'无额外逐题反馈'}`):null));
  if(task.status==='submitted'&&user.role==='student')main.append(notice('实际作业已提交，等待负责老师人工批改。当前没有成绩，标准答案在批改完成后显示。'));
  if(task.status==='submitted'&&user.role==='teacher'){
    const papers=await api(`/papers?studentId=${studentId}`);if(!current())return;
    main.append(createHomeworkGrade({...ctx,isCurrent:current,onSaved:()=>openHomework(ctx,task.id),onDenied:error=>{if(current())view.replace(ctx.heading('作业授权已变化','已关闭该记录与未保存编辑。'),notice(error.message),btn('返回作业中心',()=>renderHomeworks(ctx),'secondary'));}},task,papers).element);
  }
  if(task.status==='graded'){main.append(card(h('h2',`本次人工批改：${task.result.score.earned} / ${task.result.score.max} 分`),h('p',task.feedback),task.familySummary?h('p',`给家长的摘要：${task.familySummary}`):null,h('small','这里只记录本次作业人工分数，不计算能力提升，也不自动完成来源学习包。')));if(task.paperReference)main.append(notice(`参考阅卷记录：${task.paperReference.title}；仅作人工参考，未自动折算分数。`));}
}
