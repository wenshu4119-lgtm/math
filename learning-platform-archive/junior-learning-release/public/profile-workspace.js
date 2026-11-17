export async function renderAccount(ctx) {
  const {main,api,el,h,card,notice,heading,btn,isActive,onPasswordChanged,releaseInfo}=ctx;
  const session=await api('/auth/session');if(!isActive())return;
  const current=el('input',{type:'password',autocomplete:'current-password',required:true}),
    next=el('input',{type:'password',autocomplete:'new-password',minlength:12,maxlength:128,required:true}),
    repeat=el('input',{type:'password',autocomplete:'new-password',minlength:12,maxlength:128,required:true}),
    result=h('p','','inline-error'),submit=el('button',{type:'submit'},'保存新密码并重新登录'),
    form=el('form',{class:'card stack'},h('h2','修改登录密码'),el('label',{},'当前密码',current),el('label',{},'新密码（12–128 位）',next),el('label',{},'再次输入新密码',repeat),result,submit);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!isActive())return;
    if(next.value!==repeat.value){result.textContent='两次新密码不一致。';return;}
    submit.disabled=current.disabled=next.disabled=repeat.disabled=true;result.textContent='正在保存…';
    try{await api('/auth/password',{method:'POST',body:{currentPassword:current.value,newPassword:next.value}});current.value=next.value=repeat.value='';if(isActive())onPasswordChanged();}
    catch(error){if(isActive()){result.textContent=error.message;submit.disabled=current.disabled=next.disabled=repeat.disabled=false;}}
  });
  const loginName=el('input',{value:session.user.username,autocomplete:'username',minlength:3,maxlength:32,pattern:'[A-Za-z0-9_-]+',required:true}),
    renamePassword=el('input',{type:'password',autocomplete:'current-password',required:true}),renameMessage=h('p','','inline-error'),renameSubmit=el('button',{type:'submit'},'保存新登录名并重新登录'),
    renameForm=el('form',{class:'card stack'},h('h2','修改登录名'),h('p',`当前登录名：${session.user.username}`),notice('仅修改当前账号的登录名，角色、绑定关系和学习记录不变。保存后所有设备需要重新登录。'),el('label',{},'新登录名（3–32 位）',loginName),el('label',{},'修改登录名的当前密码',renamePassword),renameMessage,renameSubmit);
  renameForm.addEventListener('submit',async event=>{
    event.preventDefault();if(!isActive())return;
    renameSubmit.disabled=loginName.disabled=renamePassword.disabled=true;renameMessage.textContent='正在保存…';
    try{const changed=await api('/auth/username',{method:'POST',body:{currentPassword:renamePassword.value,newUsername:loginName.value}});renamePassword.value='';if(isActive())onPasswordChanged(`登录名已更新为 ${changed.username}，所有会话已失效，请重新登录。`);}
    catch(error){if(isActive()){renameMessage.textContent=error.message;renameSubmit.disabled=loginName.disabled=renamePassword.disabled=false;}}
  });
  const health=card(h('h2','服务状态'),notice('正在检查真实服务…'));
  main.replaceChildren(heading(session.user.mustChangePassword?'首次登录，请先修改密码':'账号与服务','密码只用于认证，不进入报表、打印或下载。'),...(session.user.mustChangePassword?[notice('当前使用初始密码。完成修改并重新登录后，才能访问业务页面或修改登录名。')]:[]),form,...(session.user.mustChangePassword?[]:[renameForm]),health,
    card(h('h2','服务范围'),notice('班级薄弱点汇总、排课签到尚无接口；OCR、DeepTutor 和 AI 出题未接通。'),notice(releaseInfo?.uploadsAvailable===false?'图片上传正在完成授权安全验收，暂未开放。线下分数和能力观察仍可人工录入。':'图片在本服务专用服务器的私密目录保存，24小时后停止访问并清理；OCR仍不可用，可人工核对。'),h('p','真机与物理打印尚未验证；移动端已按浏览器视口测试。'),el('a',{href:'/about.html',target:'_blank',rel:'noopener'},'来源与服务说明')));
  try{const status=await api('/health');if(isActive())health.replaceChildren(h('h2','服务状态'),h('p',`服务 ${status.status} · API ${status.apiVersion}`),h('p',`OCR：${status.ocr}；AI：${status.ai}`));}
  catch(error){if(isActive())health.replaceChildren(h('h2','服务暂不可用'),notice(error.message),btn('重新检查',()=>renderAccount(ctx)));}
}
