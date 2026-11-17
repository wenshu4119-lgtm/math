// Cross-tab messages contain no account, token, student or document information.
export const SESSION_SIGNAL_KEY='learning.session.invalidate.v1';
const channelName='learning-session-invalidation-v1',subscribers=new Set(),seen=new Set();
let channel=null;
const valid=m=>m&&m.v===1&&typeof m.nonce==='string'&&/^[a-zA-Z0-9_-]{8,120}$/.test(m.nonce)&&Number.isFinite(m.at)&&m.kind==='invalidate';
function receive(m){if(!valid(m)||seen.has(m.nonce))return;seen.add(m.nonce);if(seen.size>128)seen.delete(seen.values().next().value);for(const fn of subscribers){try{fn();}catch{}}}
try{if(typeof BroadcastChannel!=='undefined'){channel=new BroadcastChannel(channelName);channel.onmessage=e=>receive(e.data);}}catch{}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key!==SESSION_SIGNAL_KEY||!event.newValue)return;try{receive(JSON.parse(event.newValue));}catch{}});
export function publishSessionChange(){const nonce=typeof crypto?.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);const message={v:1,kind:'invalidate',nonce,at:Date.now()};seen.add(nonce);try{channel?.postMessage(message);}catch{}try{localStorage.setItem(SESSION_SIGNAL_KEY,JSON.stringify(message));}catch{}return nonce;}
export function onSessionChange(fn){subscribers.add(fn);return()=>subscribers.delete(fn);}

export function createSessionMonitor({onInvalidate=()=>{},onResume=()=>{},verify=null,intervalMs=15000}={}){
 let binding=null,generation=0,busy=null,disposed=false,resume=false,lastFocus=0;const controllers=new Set();
 const visible=()=>document.visibilityState==='visible';
 function unbind(){generation++;binding=null;for(const c of controllers)c.abort();controllers.clear();}
 function invalidate(message='账号或授权无法确认，旧私有内容已清除。',mayResume=false){unbind();resume=mayResume;onInvalidate(message);}
 function bind(session){unbind();const u=session?.user;if(!u?.id||!u?.role)throw Error('缺少可验证的登录身份');binding={actorId:u.id,role:u.role,expiresAt:session.expiresAt??null};resume=false;}
 async function check(){if(disposed||!binding||!visible()||busy)return;const turn=generation,identity={...binding},controller=new AbortController();controllers.add(controller);const timeout=setTimeout(()=>controller.abort(),5000);const task=(async()=>{try{
   if(identity.expiresAt&&Date.now()>=Number(identity.expiresAt))throw Error('登录已到期，请重新登录。');
   const r=await fetch('/api/v1/auth/session',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(turn!==generation)return;
   if(!r.ok||r.headers.get('X-Actor-Id')!==identity.actorId)throw Error('登录身份或授权已变化，请重新登录。');
   let data;try{data=await r.json();}catch{throw Error('服务响应无法验证，旧私有内容已清除。');}if(turn!==generation)return;
   if(data.data?.user?.id!==identity.actorId||data.data?.user?.role!==identity.role||data.data?.user?.mustChangePassword)throw Error('账号状态已变化，请重新验证。');
   if(verify)await verify({...identity,signal:controller.signal});
  }catch(error){if(turn===generation&&!disposed)invalidate(error.message||'权限无法验证，旧私有内容已清除。');}finally{clearTimeout(timeout);controllers.delete(controller);}})();busy=task;try{await task;}finally{if(busy===task)busy=null;}}
 function restore(){if(!disposed&&resume&&visible()){resume=false;onResume();}}
 const hidden=()=>{if(!visible())invalidate('页面已隐藏，旧私有内容已清除；返回时重新验证。',true);else restore();};
 const pagehide=()=>invalidate('页面已离开，旧私有内容已清除。',true);
 const pageshow=e=>{if(e.persisted){invalidate('正在重新验证返回页面的账号与权限。',true);restore();}};
 const focus=e=>{if(e.target!==window||!visible()||Date.now()-lastFocus<150)return;lastFocus=Date.now();if(resume)restore();else check();};
 const unsubscribe=onSessionChange(()=>invalidate('另一个页面更新了会话，旧私有内容已清除，请重新加载。'));
 document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);window.addEventListener('focus',focus);
 const timer=setInterval(check,Math.max(250,intervalMs));
 if(!document.getElementById('session-print-denied')){const p=document.createElement('p');p.id='session-print-denied';p.textContent='此页含受保护资料。请返回页面，使用授权的打印／PDF入口重新核验；当前打印未获许可。';document.body.append(p);}
 return {bind,unbind,invalidate,check,get actorId(){return binding?.actorId??null;},get generation(){return generation;},dispose(){disposed=true;unbind();clearInterval(timer);unsubscribe();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);window.removeEventListener('focus',focus);}};
}
