import {createSessionMonitor} from './session-guard.js';
const workspace=document.querySelector('#workspace');
let epoch=0,controller=null,user=null,csrf=null,timer=null,jobId=null,monitor=null;
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function clear(){monitor?.unbind();epoch++;controller?.abort();controller=new AbortController();clearTimeout(timer);workspace.replaceChildren(el('p','正在重新核对教师身份…'));csrf=null;}
function invalidate(message='账号或授权无法确认，旧内容已清除。'){
 user=null;jobId=null;clear();failure(Object.assign(new Error(message),{status:401}));
}
function identityError(message,status=401){invalidate(message);return Object.assign(new Error(message),{status});}
async function api(path,{method='GET',body}={},current=epoch){
 const expectedActor=user?.id;
 const response=await fetch('/api/v1'+path,{method,cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{...(method!=='GET'?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(current!==epoch)throw new DOMException('Stale view','AbortError');
 if([401,403,404].includes(response.status))throw identityError('账号或资源权限无法确认，旧内容已清除。',response.status);
 const actor=response.headers.get('X-Actor-Id');
 if(response.ok&&(!actor||(expectedActor&&actor!==expectedActor)||(path!=='/auth/session'&&!expectedActor)))throw identityError('登录身份已变化或响应身份缺失，旧内容已清除。');
 let payload;try{payload=await response.json();}catch{if(current!==epoch)throw new DOMException('Stale view','AbortError');throw identityError('服务响应无法验证，旧内容已清除。');}
 if(current!==epoch)throw new DOMException('Stale view','AbortError');
 if(!payload||typeof payload!=='object'||(response.ok&&!Object.hasOwn(payload,'data')))throw identityError('服务数据格式无法验证，旧内容已清除。');
 if(['ACCESS_OR_VERSION_CHANGED','ACCOUNT_STATE_CHANGED'].includes(payload.error?.code))throw identityError('账号或授权已变化，旧内容已清除。');
 if(!response.ok){const e=new Error(payload.error?.message||'服务暂不可用，没有替代结果。');e.status=response.status;e.code=payload.error?.code;throw e;}
 if(path==='/auth/session'&&actor!==payload.data?.user?.id)throw identityError('登录身份响应不匹配，旧内容已清除。');
 return payload.data;
}
function failure(error){if(error.name==='AbortError')return;const card=el('div',undefined,'card');card.append(el('h2','当前无法继续'),el('p',error.message,'error'));const link=el('a','返回登录 / 工作台');link.href='/login.html';card.append(link);workspace.replaceChildren(card);}
function renderResult(job,host){
 host.replaceChildren(el('h2',job.state==='completed'?'真实实验结果':job.state==='failed'?'实验未完成':'正在执行真实检索与模型调用…'));
 if(!job.result){host.append(el('p','CPU 模型按单任务运行，可能需要数十秒。切换页面不会伪造完成状态。'));return;}
 const result=job.result;host.append(el('p',result.message||job.notice));
 if(result.outcome==='answered'){host.append(el('h3','模型返回（未经过老师审核）'),el('p',String(result.answer)),el('p',result.explanation),el('p','固定样例答案自动检查通过；这不是对其他题目准确率的认证。','muted'));}
 if(result.outcome==='quarantined')host.append(el('p','结果已隔离，不提供可用于评分的答案。','error'));
 if(result.outcome==='no_match')host.append(el('p','范围检查拒答：模型调用 0 次。','muted'));
 for(const citation of result.citations||[]){host.append(el('h3','引用来源：'+citation.source),el('blockquote',citation.quote),el('p','原创 TXT 摘录；已核对来源摘要，不冒充原生页码引用。','muted'));}
}
async function poll(host,current){
 try{const job=await api('/ai-lab/jobs/'+jobId,{},current);if(current!==epoch)return;renderResult(job,host);if(['created','running'].includes(job.state))timer=setTimeout(()=>poll(host,current),3000);else workspace.querySelectorAll('button').forEach(b=>b.disabled=false);}
 catch(error){if(current===epoch)failure(error);}
}
async function initialize(){
 const previous=user?.id;clear();const current=epoch;
 try{
  const session=await api('/auth/session',{},current);if(current!==epoch)return;user=session.user;csrf=session.csrfToken;
  if(previous&&previous!==user.id)jobId=null;
  if(user.role!=='teacher')throw new Error('本页只供真实教师账号使用。管理员请通过账号与角色管理分配教师身份。');
  if(user.mustChangePassword)throw new Error('请先在工作台修改初始密码，然后重新登录。');
  monitor.bind(session);
  const state=await api('/ai-lab/status',{},current);if(current!==epoch)return;
  const status=el('div',undefined,'card');status.append(el('h2',state.label),el('p',state.message),el('p',state.notice,'muted'));
  const choices=el('div',undefined,'choices'),result=el('div',undefined,'card');result.append(el('p','选择一个原创样例，查看真实模型结果及来源。'));
  for(const preset of state.presets){const button=el('button',preset.title);button.type='button';button.disabled=state.status!=='limited';button.onclick=async()=>{
   workspace.querySelectorAll('button').forEach(b=>b.disabled=true);result.replaceChildren(el('p','正在提交受保护实验…'));
   try{const job=await api('/ai-lab/jobs',{method:'POST',body:{requestId:crypto.randomUUID(),preset:preset.id}},current);if(current!==epoch)return;jobId=job.id;renderResult(job,result);if(job.state==='running'||job.state==='created')timer=setTimeout(()=>poll(result,current),2000);else workspace.querySelectorAll('button').forEach(b=>b.disabled=false);}
   catch(error){if(current===epoch)failure(error);}
  };choices.append(button);}
  workspace.replaceChildren(status,choices,result);if(jobId&&state.status==='limited')await poll(result,current);
 }catch(error){if(current===epoch)failure(error);}
}
monitor=createSessionMonitor({onInvalidate:message=>invalidate(message),onResume:()=>location.reload()});
if(document.visibilityState==='visible')initialize();else monitor.invalidate('页面已隐藏，返回后重新核对登录。',true);
