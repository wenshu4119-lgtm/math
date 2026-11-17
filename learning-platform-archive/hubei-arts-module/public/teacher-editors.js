// Shared teacher forms: local inputs never become records until the real API saves them.
const lostAccess=error=>[401,403,404].includes(error.status);
export function createPackReview(ctx,pack,knowledge,{allowDraftSave=false}={}){
  const {el,h,api}=ctx;let revision=pack.revision,status=pack.status,dirty=false,busy=false,compareRequired=false;
  const editable=()=>['draft','approved'].includes(status),current=()=>ctx.isCurrent()&&form.isConnected;
  const form=el('form',{class:'card pack-review teacher-editor'},h('h3','审核与调整'));
  const choices=knowledge.filter(k=>k.reviewStatus==='human_reviewed').map(k=>({k,input:el('input',{type:'checkbox',checked:pack.knowledgeIds.includes(k.id)})}));
  choices.forEach(({k,input})=>form.append(el('label',{class:'checkline'},input,k.title)));
  const note=el('textarea',{maxlength:500,'aria-label':'教师指导'},pack.teacherNote),confirm=el('input',{type:'checkbox'}),ack=el('input',{type:'checkbox'}),messages=el('div',{'aria-live':'polite'}),comparison=el('div',{class:'saved-comparison',hidden:true});
  const approve=el('button',{type:'submit'},'保存调整并批准'),draft=el('button',{type:'button',onclick:()=>save(false)},'保存方案草稿'),latest=el('button',{type:'button',class:'secondary',onclick:readLatest},'读取最新保存版本（保留输入）');
  form.append(el('label',{},'教师指导（可选，最多 500 字）',note),el('label',{class:'checkline'},confirm,'我已核对本次学习范围与材料，批准学生开始学习。'),messages,comparison,el('div',{class:'row'},allowDraftSave?draft:null,approve,latest),h('p','导出只使用服务器保存版本。失败时输入留在本页；离开本页或切换学生会清除未保存输入。','fineprint'));
  function controls(){const disabled=busy||!editable()||!choices.length;for(const c of choices)c.input.disabled=disabled;note.disabled=busy||!editable();confirm.disabled=disabled;approve.disabled=disabled;draft.disabled=disabled;draft.hidden=!allowDraftSave||status!=='draft';latest.disabled=busy;ack.disabled=busy||!compareRequired||!editable();}
  function showError(error){if(!current())return;if(lostAccess(error)){ctx.onDenied?.(error);return;}messages.replaceChildren(ctx.notice(error.message));}
  form.addEventListener('input',event=>{if(event.target!==confirm&&event.target!==ack){dirty=true;confirm.checked=false;ack.checked=false;}});
  form.addEventListener('change',event=>{if(event.target!==confirm&&event.target!==ack){dirty=true;confirm.checked=false;ack.checked=false;}});
  async function save(approveFlag){
    if(!current()||busy||!editable())return;
    const ids=choices.filter(c=>c.input.checked).map(c=>c.k.id);
    if(!ids.length){messages.replaceChildren(ctx.notice('请至少选择一个已审核知识点。'));return;}
    if(compareRequired&&!ack.checked){messages.replaceChildren(ctx.notice('请先比较最新保存内容，并明确确认使用当前输入更新。'));return;}
    if(approveFlag&&!confirm.checked){messages.replaceChildren(ctx.notice('请先核对材料并勾选批准确认。'));return;}
    busy=true;controls();messages.replaceChildren();
    try{const saved=await api(`/packs/${pack.id}`,{method:'PATCH',body:{revision,knowledgeIds:ids,teacherNote:note.value,approve:approveFlag}});if(!current())return;dirty=false;await ctx.onSaved(saved);}
    catch(error){showError(error);}finally{busy=false;if(current())controls();}
  }
  async function readLatest(){
    if(!current()||busy)return;busy=true;controls();
    try{const saved=await api(`/packs/${pack.id}`);if(!current())return;if(saved.id!==pack.id||saved.studentId!==pack.studentId)throw new Error('保存对象不一致，未更改当前输入。');revision=saved.revision;status=saved.status;compareRequired=true;confirm.checked=false;ack.checked=false;comparison.hidden=false;
      comparison.replaceChildren(h('h4',`最新保存版本 ${revision}`),h('p',`已保存范围：${saved.materials.map(m=>m.title).join('；')}`),h('p',saved.teacherNote||'尚无保存的指导语。','prose-pre'),editable()?el('label',{class:'checkline'},ack,'我已比较最新保存内容，确认用当前输入更新。'):ctx.notice('学习已经开始，方案只读。当前输入保留供核对，不会覆盖已保存记录。'));
      messages.replaceChildren(ctx.notice('已读取服务端最新状态；当前输入保持不变。'));
    }catch(error){showError(error);}finally{busy=false;if(current())controls();}
  }
  form.addEventListener('submit',event=>{event.preventDefault();void save(true);});controls();
  return {element:form,isDirty:()=>dirty||busy,isBusy:()=>busy};
}

export function createHomeworkGrade(ctx,task,papers){
  const {el,h,api}=ctx;let revision=task.revision,dirty=false,busy=false,locked=false;const requestId=crypto.randomUUID();
  const form=el('form',{class:'card stack teacher-editor homework-grader'},h('h2','逐题人工批改')),current=()=>ctx.isCurrent()&&form.isConnected;
  const marks=task.questions.map(q=>{const earned=el('input',{type:'number',min:0,max:q.maxScore,step:'0.01',required:true,'aria-label':`${q.id} 人工得分`}),note=el('textarea',{maxlength:500,'aria-label':`${q.id} 逐题反馈`});form.append(el('div',{class:'question'},h('h3',q.prompt),el('label',{},`实际得分 / ${q.maxScore}`,earned),el('label',{},'给学生的逐题反馈（可选）',note)));return {q,earned,note};});
  const feedback=el('textarea',{required:true,maxlength:2000,'aria-label':'给学生的作业反馈'}),family=el('textarea',{maxlength:300,'aria-label':'公开给家长的摘要'}),confirm=el('input',{type:'checkbox',required:true}),reference=el('select',{'aria-label':'人工阅卷参考'},el('option',{value:''},'不关联人工阅卷报告'),...papers.filter(p=>p.status==='confirmed'&&p.subject===task.subject&&p.kind==='scored_paper').map(p=>el('option',{value:p.id},p.title)));
  const messages=el('div',{'aria-live':'polite'}),savedBox=el('div',{class:'saved-comparison',hidden:true}),save=el('button',{type:'submit'},'保存并发布人工批改'),latest=el('button',{type:'button',class:'secondary',onclick:readLatest},'读取已保存批改（保留输入）');
  form.append(el('label',{},'给学生的反馈（必填）',feedback),el('label',{},'明确公开给家长的摘要（可选）',family),h('p','家长只能看到公开摘要和总分，不会收到学生作答正文、逐题反馈或上面的私密反馈。','fineprint'),el('label',{},'人工阅卷参考（只建立引用，不自动换算分数）',reference),el('label',{class:'checkline'},confirm,'我已逐题核对学生实际作答，所有分数由我人工评定；OCR/RAG未参与判分。'),messages,savedBox,el('div',{class:'row'},save,latest),h('p','此反馈依附本次实际提交的作业；不会自动生成课次、复测或进步记录。失败时保留本页输入，离开本页会清除。','fineprint'));
  const inputs=[...marks.flatMap(m=>[m.earned,m.note]),feedback,family,reference,confirm];
  function controls(){inputs.forEach(input=>input.disabled=busy||locked);save.disabled=busy||locked;latest.disabled=busy;}
  function error(error){if(!current())return;if(lostAccess(error)){ctx.onDenied?.(error);return;}messages.replaceChildren(ctx.notice(error.message));}
  form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
  async function readLatest(){if(!current()||busy)return;busy=true;controls();try{const saved=await api(`/homeworks/${task.id}`);if(!current())return;if(saved.id!==task.id||saved.studentId!==task.studentId||saved.teacherId!==task.teacherId)throw new Error('作业对象不一致，未替换当前输入。');
    if(saved.status==='graded'){locked=true;savedBox.hidden=false;savedBox.replaceChildren(h('h3','服务端已有已批改记录'),h('p',`已保存人工分数：${saved.result.score.earned} / ${saved.result.score.max}`),h('p',saved.feedback,'prose-pre'),h('p',`已保存公开摘要：${saved.familySummary||'未填写'}`),el('button',{type:'button',class:'secondary',onclick:()=>{if(current())ctx.onSaved(saved);}},'查看已保存反馈'));messages.replaceChildren(ctx.notice('当前输入仍保留供核对；已完成批改的记录不能再次覆盖。'));}
    else if(saved.status==='submitted'){revision=saved.revision;messages.replaceChildren(ctx.notice('服务端仍待批改，当前输入及重试标识保持不变，可核对后重试。'));}
    else{locked=true;messages.replaceChildren(ctx.notice('当前作业没有可批改的提交，已停止保存。'));}
  }catch(e){error(e);}finally{busy=false;if(current())controls();}}
  form.addEventListener('submit',async event=>{event.preventDefault();if(!current()||busy||locked)return;if(marks.some(m=>m.earned.value.trim()==='')||!feedback.value.trim()||!confirm.checked){messages.replaceChildren(ctx.notice('请填写每题实际分值与反馈，并确认人工核对；空白不等于0分。'));return;}busy=true;controls();messages.replaceChildren();
    try{const saved=await api(`/homeworks/${task.id}/grade`,{method:'POST',body:{revision,requestId,marks:marks.map(({q,earned,note})=>({questionId:q.id,earnedScore:Number(earned.value),note:note.value})),feedback:feedback.value,familySummary:family.value,paperId:reference.value||null,confirmed:confirm.checked}});if(!current())return;dirty=false;await ctx.onSaved(saved);}catch(e){error(e);}finally{busy=false;if(current())controls();}});
  return {element:form,isDirty:()=>dirty||busy,isBusy:()=>busy};
}
