const workspace=document.querySelector('#workspace');
let epoch=0,controller=null,user=null,csrf=null,timer=null,jobId=null,intent=null;
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function clear(){epoch++;controller?.abort();controller=new AbortController();clearTimeout(timer);workspace.replaceChildren(el('p','正在重新核对账号权限…'));csrf=null;intent=null;}
async function api(path,{method='GET',body}={},current=epoch){
 const response=await fetch('/api/v1'+path,{method,cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{...(method!=='GET'?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(current!==epoch)throw new DOMException('Stale view','AbortError');const payload=await response.json();
 if(!response.ok){const e=new Error(payload.error?.message||'服务暂不可用，没有替代答案。');e.status=response.status;e.code=payload.error?.code;throw e;}
 const actor=response.headers.get('X-Actor-Id');
 if(path==='/auth/session'){if(actor!==payload.data?.user?.id)throw new Error('登录身份响应不匹配，请重新登录。');}
 else if(!user||actor!==user.id){user=null;csrf=null;jobId=null;intent=null;clearTimeout(timer);controller.abort();workspace.replaceChildren();throw new Error('登录账号已改变，已清除当前问答视图。');}
 return payload.data;
}
function failure(error){if(error.name==='AbortError')return;const box=el('div',undefined,'card');box.append(el('h2','当前无法继续'),el('p',error.message,'error'));const link=el('a','返回登录 / 工作台');link.href='/login.html';box.append(link);workspace.replaceChildren(box);}
function showResult(job,host){
 const titles={created:'正在提交',running:'正在检索原创讲解并调用真实模型…',completed:'问答结果',failed:'无法完成本次问答',expired:'临时结果已过期'};host.replaceChildren(el('h2',titles[job.state]||'问答状态'));
 if(['created','running'].includes(job.state)){host.append(el('p','模型按单任务运行，可能需要几十秒。服务不会用预设答案代替失败结果。'));return;}
 if(!job.result){host.append(el('p',job.state==='expired'?'结果已超过30分钟或服务已重启，没有保留问题与回答原文。':'没有可确认的模型答案；可在服务恢复后主动重新提问。','error'));return;}
 const result=job.result;host.append(el('p',result.message));
 if(result.outcome==='needs_verification'){host.append(el('h3','模型解释 · 待核对'),el('p',result.answer,'answer'),el('p','来源可核对不代表回答全部正确。遇到矛盾时请向老师求证。','muted'));}
 else host.append(el('p',result.outcome==='refused'?'本次未调用模型。':'本次模型输出未通过检查，未展示为可靠答案。','muted'));
 for(const source of result.citations||[]){host.append(el('h3','原创讲解：'+source.title),el('blockquote',source.quote),el('p','已核对原文与来源摘要；TXT引用不冒充原生页码。','muted'));}
}
async function initialize(){
 const previous=user?.id;clear();const current=epoch;
 try{
  const session=await api('/auth/session',{},current);if(current!==epoch)return;user=session.user;csrf=session.csrfToken;if(previous&&previous!==user.id)jobId=null;
  if(!['teacher','student'].includes(user.role))throw new Error('学习问答仅供学生或教师账号使用。');
  if(user.mustChangePassword)throw new Error('请先在工作台修改初始密码，并重新登录。');
  const status=await api('/learning-qa/status',{},current);if(current!==epoch)return;
  const state=el('div',undefined,'card');state.append(el('h2',status.label),el('p',status.scope.join('；')),el('p',status.retention,'muted'));
  const form=el('form',undefined,'card form-grid'),subject=el('select'),question=el('textarea'),confirm=document.createElement('input'),message=el('p','','error'),submit=el('button','提交学习问题');
  subject.name='subject';for(const [value,label]of [['math','数学'],['english','英语']]){const option=el('option',label);option.value=value;subject.append(option);}
  question.name='question';question.minLength=5;question.maxLength=300;question.required=true;question.placeholder='例如：为什么等式两边同时除以一个数时，除数不能为零？';
  confirm.type='checkbox';confirm.required=true;submit.type='submit';const subjectLabel=el('label','选择学科'),questionLabel=el('label','你的学习问题（5–300字）'),confirmLabel=el('label',undefined,'confirm');subjectLabel.append(subject);questionLabel.append(question);confirmLabel.append(confirm,el('span','我只提交普通学习问题，不含姓名、联系方式、学生档案或试卷。'));
  form.append(subjectLabel,questionLabel,confirmLabel,el('p','范围外问题会拒答。问题文本仅发送到本服务的本地模型，不发送给外部模型。','muted'),message,submit);
  const result=el('div',undefined,'card');result.append(el('p','提交后会显示真实执行状态、模型解释与原创来源。'));
  function enabled(value){for(const input of [subject,question,confirm,submit])input.disabled=!value;}
  enabled(status.status==='limited');
  async function poll(){try{const job=await api('/learning-qa/jobs/'+jobId,{},current);if(current!==epoch)return;showResult(job,result);if(['created','running'].includes(job.state))timer=setTimeout(poll,3000);else{intent=null;enabled(status.status==='limited');}}catch(e){if(current!==epoch)return;if([401,403,404].includes(e.status)||!user)failure(e);else{result.replaceChildren(el('h2',e.status===410?'临时结果已过期':'无法读取问答结果'),el('p',e.message,'error'));enabled(status.status==='limited');intent=null;}}}
  form.onsubmit=async event=>{event.preventDefault();message.textContent='';const value=question.value.trim();if(!intent||intent.question!==value||intent.subject!==subject.value)intent={requestId:crypto.randomUUID(),question:value,subject:subject.value};enabled(false);result.replaceChildren(el('p','正在提交受保护的学习问题…'));
   try{const job=await api('/learning-qa/jobs',{method:'POST',body:{...intent,noPersonalDataConfirmed:confirm.checked}},current);if(current!==epoch)return;jobId=job.id;question.value='';showResult(job,result);if(job.state==='completed'&&!job.result)await poll();else if(['created','running'].includes(job.state))timer=setTimeout(poll,2000);else{intent=null;enabled(status.status==='limited');}}
   catch(e){if(current!==epoch)return;if([401,403,404].includes(e.status)||!user)failure(e);else{message.textContent=e.message;enabled(status.status==='limited');}}
  };
  workspace.replaceChildren(state,form,result);if(jobId&&status.status==='limited'){enabled(false);await poll();}
 }catch(e){if(current===epoch)failure(e);}
}
addEventListener('pagehide',()=>{clear();user=null;jobId=null;});
addEventListener('pageshow',()=>initialize());
document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else initialize();});
