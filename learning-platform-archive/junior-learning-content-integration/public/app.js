import {renderDraftWorkspace} from './draft-workspace.js';
import { exportUrl } from './export-registry.js';
import { renderParentArchive } from './parent-archive.js';
import { renderAccount } from './profile-workspace.js';
import { learningCycle } from './learning-state.js';
import {renderPackWorkspace} from './pack-workspace.js';
import {renderTeacherWorkspace} from './teacher-workspace.js';
import {scopeDescription} from './assessment-scope.js';
import { renderPaperWorkspace } from './paper-workspace.js';
import { ocrPanel } from './ocr-workspace.js';
import { renderHomeworks,homeworkFromPack,openHomework } from './homework-workspace.js';
const $=s=>document.querySelector(s);
const roles={admin:'管理员',teacher:'老师',student:'学生',parent:'家长'};
const subjects={math:'数学',english:'英语'};
const phases={diagnostic:'能力筛查',practice:'通关练习',retest:'学习复测'};
const statuses={draft:'待老师审核',approved:'可以开始',in_progress:'学习中',completed:'已完成'};
let user,csrfToken,students=[],studentId='',tab='home',subject='math',toastTimer,identityEpoch=0,runtimeCapabilities=null;
let releaseInfo=null;
function el(tag,attrs={},...children) {
  const node=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)) {
    if(k.startsWith('on'))node.addEventListener(k.slice(2),v);
    else if(k==='class')node.className=v;
    else if(k==='checked'||k==='disabled')node[k]=Boolean(v);
    else node.setAttribute(k,String(v));
  }
  for(const child of children.flat(Infinity))if(child!==undefined&&child!==null)node.append(child instanceof Node?child:document.createTextNode(String(child)));
  return node;
}
const h=(tag,text,cls)=>el(tag,cls?{class:cls}:{},text);
const card=(...children)=>el('section',{class:'card'},...children);
const row=(...children)=>el('div',{class:'row'},...children);
const btn=(label,fn,cls='')=>el('button',{type:'button',class:cls,onclick:async e=>{e.currentTarget.disabled=true;try{await fn();}catch(err){notify(err.message,true);}finally{e.target.disabled=false;}}},label);
const empty=text=>h('div',text,'empty');
const notice=text=>h('p',text,'notice');
function activateTab(key){tab=key;document.querySelectorAll('[data-nav]').forEach(button=>button.classList.toggle('active',button.dataset.nav===key));}
function exportsFor(kind,params={},label='') {
  return el('div',{class:'export-actions'},label?h('span',label,'muted'):null,...['导出 PDF','打印'].map(name=>el('a',{href:exportUrl(kind,params),target:'_blank',rel:'noopener noreferrer'},name)));
}
const fmt=value=>new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
function notify(message,error=false){const t=$('#toast');t.textContent=message;t.className=error?'show error':'show';clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='',6000);}
function invalidateIdentity(){identityEpoch++;user=null;csrfToken=null;students=[];studentId='';renderLogin();}
async function api(path,{method='GET',body,raw=false}={}) {
  const requestEpoch=identityEpoch,expectedActor=user?.id;
  const headers={};if(body!==undefined&&!raw)headers['Content-Type']='application/json';
  if(method!=='GET'&&csrfToken)headers['X-CSRF-Token']=csrfToken;
  if(raw)headers['Content-Type']=body.type;
  let response;
  try{response=await fetch(`/api/v1${path}`,{method,headers,body:body===undefined?undefined:raw?body:JSON.stringify(body),credentials:'same-origin',cache:'no-store'});}catch{throw Object.assign(new Error('当前无法连接服务器，操作结果尚未确认。请联网后刷新记录，再决定是否重试。'),{status:0,code:'NETWORK_ERROR'});}
  if(requestEpoch!==identityEpoch)throw new Error('账号已切换，旧请求结果已忽略。');
  if(response.ok&&expectedActor&&!['/auth/login','/health'].includes(path)&&response.headers.get('X-Actor-Id')!==expectedActor){invalidateIdentity();throw new Error('登录身份已变化，请重新登录或刷新页面。');}
  const result=await response.json();
  if(requestEpoch!==identityEpoch)throw new Error('账号已切换，旧请求结果已忽略。');
  if(!response.ok){if(response.status===401&&path!=='/auth/login'&&!(['/auth/password','/auth/username'].includes(path)&&result.error.code==='LOGIN_FAILED'))invalidateIdentity();throw Object.assign(new Error(`${result.error.message}（${result.error.code}）`),{status:response.status,code:result.error.code,requestId:result.error.requestId});}
  if(path==='/auth/login'||path==='/auth/logout')identityEpoch++;
  return result.data;
}
function brand(){return el('div',{class:'brand'},h('span','学','brand-logo'),el('div',{class:'brand-text'},h('span','学习规划 · 初中学习平台','brand-title'),h('span','数学 / 英语 · 三步闭环','brand-ver')));}
function renderLogin(startupError=''){
  if(location.pathname!=='/login.html')history.replaceState(null,'','/login.html');
  const message=h('p','','inline-error'),form=el('form',{},h('p','WELCOME BACK','eyebrow'),h('h2','从今天的一小步开始'),h('p','登录你的学习工作台。','muted'));
  const username=el('input',{name:'username',autocomplete:'username',required:true,placeholder:'登录别名，例如 student'}),password=el('input',{name:'password',type:'password',autocomplete:'current-password',required:true,placeholder:'输入密码'});
  message.textContent=startupError;
  form.append(el('a',{href:'/'},'← 返回公开首页'),notice('学习规划 · 管理员邀请开通；使用别名，保护学生隐私。'),el('a',{href:'/privacy.html'},'隐私与数据处理说明'),el('a',{href:'/about.html'},'功能与来源说明'));
  form.append(el('label',{},'登录名',username),el('label',{},'密码',password),message,el('button',{type:'submit'},'进入工作台 →'),el('div',{class:'role-guides'},[['学生','自主筛查、学习与复测'],['老师','关联学生辅导、内容审核'],['家长','只读查看孩子真实记录'],['管理员','账号与关系授权管理']].map(([r,t])=>el('div',{},h('b',`${r}入口`),t))),notice('使用管理员分配的账号。登录身份由服务端确认，不能通过切换页面获得其他角色权限。'),h('p','不要求姓名、学校或手机号。示例内容须经教师审核；没有预置学生成绩。','fineprint'));
  form.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('button');submit.disabled=true;try{const s=await api('/auth/login',{method:'POST',body:{username:username.value,password:password.value}});user=s.user;csrfToken=s.csrfToken;password.value='';await loadWorkspace();}catch(err){message.textContent=err.message;}finally{submit.disabled=false;}});
  $('#app').replaceChildren(el('div',{class:'login'},el('section',{class:'login-story'},brand(),h('p','LEARN A LITTLE. GO A LITTLE FURTHER.','eyebrow'),el('h1',{},'把「还不会」，',el('br'),'变成「我会了」。'),h('p','找到薄弱点，学透一小节。\n让每一次真实作答，都留下成长的足迹。'),el('ol',{},h('li','能力筛查 · 找到今天的起点'),h('li','今日通关包 · 讲解、记背、练习'),h('li','学习复测 · 用真实记录看变化')),h('footer','初中数学 / 英语　·　自主学习与教师辅导')),el('section',{class:'login-form'},form)));
}
async function loadWorkspace(){if(user&&location.pathname!=='/platform.html')history.replaceState(null,'','/platform.html');if(user?.mustChangePassword){students=[];studentId='';runtimeCapabilities=null;tab='account';await render();return;}[students,runtimeCapabilities]=await Promise.all([api('/students'),api('/capabilities')]);if(!students.some(s=>s.id===studentId))studentId=students[0]?.id||'';tab=user.role==='admin'?'admin':'home';await render();}
async function render(){
  if(!user)return renderLogin();
  const navs=user.mustChangePassword?[['account','首次修改密码']]:[...(user.role==='admin'?[]:[['home','学习概览']]),...(user.role==='teacher'?[['teaching','方案与课后反馈'],['drafts','资料与隔离候选']]:[]),...(user.role!=='parent'&&user.role!=='admin'?[['learning','学习与通关'],['uploads','拍照核对']]:[]),...(user.role!=='admin'?[['homeworks','作业中心'],['papers',user.role==='teacher'?'线下人工阅卷':'线下辅导记录'],['growth','成长档案']]:[]),...(user.role==='teacher'?[['review','内容审核']]:[]),...(user.role==='admin'?[['admin','管理工作台']]:[]),...(user.role==='parent'?[['archive','家校摘要档案']]:[]),['account','账号与服务']];
  const navButton=([key,name])=>{const b=btn(name,async()=>{tab=key;await render();},key===tab?'active':'');b.dataset.nav=key;return b;};
  const nav=el('nav',{class:'nav','aria-label':'主要导航'},navs.map(navButton));
  const main=el('main',{id:'main',class:'main-stage',tabindex:-1},h('p','正在读取服务端记录…','loading'));
  const select=el('select',{class:'context-select','aria-label':'查看学生',onchange:async e=>{studentId=e.target.value;await render();}},students.map(s=>el('option',{value:s.id,...(s.id===studentId?{selected:true}:{})},s.displayName)));
  const drawer=el('aside',{class:'sidebar',id:'workspace-nav'},h('div',`${roles[user.role]}工作区`,'nav-section-label'),nav,el('div',{class:'sidebar-foot'},h('b','真实记录 · 按权限访问'),h('p','筛查 → 针对性学习 → 复测'),h('small','未接通的 OCR / AI 不会返回模拟结果。'),el('a',{href:'/'},'返回公开首页')));
  const backdrop=el('div',{class:'drawer-backdrop'}),menu=btn('☰ 菜单',()=>{const opened=drawer.classList.toggle('open');backdrop.classList.toggle('open',opened);menu.setAttribute('aria-expanded',String(opened));},'mobile-menu-btn');menu.setAttribute('aria-controls','workspace-nav');menu.setAttribute('aria-expanded','false');
  backdrop.addEventListener('click',()=>{drawer.classList.remove('open');backdrop.classList.remove('open');menu.setAttribute('aria-expanded','false');});
  $('#app').replaceChildren(el('a',{href:'#main',class:'skip-link'},'跳到主要内容'),el('div',{class:'integrated-app'},el('header',{class:'topbar'},row(menu,brand()),el('div',{class:'identity'},students.length?select:null,h('span',user.displayName,'username'),h('span',roles[user.role],'session-role'),btn('退出',async()=>{await api('/auth/logout',{method:'POST'});user=null;csrfToken=null;students=[];studentId='';$('#app').replaceChildren();location.replace('/');},'quiet'))),backdrop,el('div',{class:'app-shell'},drawer,main),el('nav',{class:'bottom-nav','aria-label':'手机快捷导航'},navs.filter(([key])=>(user.role==='teacher'?['home','teaching','learning','homeworks','growth']:['home','learning','homeworks','growth','admin']).includes(key)).map(navButton))));
  if(user.role!=='admin')$('.sidebar').append(exportsFor('roster',{},'学生清单'));
  window.scrollTo(0,0);main.focus({preventScroll:true});
  try {
    const viewer=user,epoch=identityEpoch,targetStudent=studentId;
    const isActive=()=>Boolean(main.isConnected&&user?.id===viewer.id&&identityEpoch===epoch&&studentId===targetStudent);
    if(tab==='account')return await renderAccount({main,api,el,h,card,notice,heading,btn,isActive,releaseInfo,onPasswordChanged:(message)=>{invalidateIdentity();notify(message||'密码已更新，所有会话已失效，请重新登录。');}});
    if(tab==='archive'&&studentId)return await renderParentArchive({main,user:viewer,studentId:targetStudent,api,h,card,notice,exportsFor,heading,empty,isActive});
    if(tab==='drafts'&&user.role==='teacher')return await renderDraftWorkspace({main,user:viewer,api,el,h,card,row,btn,notice,exportsFor,notify,heading,empty,isActive});
    if(tab==='admin')return await renderAdmin(main);
    if(tab==='review')return await renderReview(main);
    if(!studentId){main.replaceChildren(heading('等待关联学生','管理员建立绑定后，你就能查看对应学生的学习记录。'),empty('目前没有可访问的学生。'));return;}
    if(tab==='teaching'){
      const viewer=user,epoch=identityEpoch,targetStudent=studentId,active=()=>Boolean(user&&user.id===viewer.id&&identityEpoch===epoch&&studentId===targetStudent&&main.isConnected),go=async key=>{if(active()){tab=key;await render();}},common={main,user:viewer,studentId:targetStudent,api,el,h,card,row,btn,notice,exportsFor,notify,heading,empty,openPack};
      await renderTeacherWorkspace({...common,studentName:students.find(s=>s.id===targetStudent)?.displayName||'当前学生',isActive:active,onEnter:()=>activateTab('teaching'),goHomeworks:()=>go('homeworks'),goPapers:()=>go('papers'),goLearning:()=>go('learning'),reloadAccess:async()=>{await loadWorkspace();if(user?.role==='teacher'){tab='teaching';await render();}},openHomework:id=>{if(active())return openHomework({...common,onEnter:()=>activateTab('homeworks')},id);},fromPack:(pack,requestId,isCurrent)=>homeworkFromPack({...common,onEnter:()=>activateTab('homeworks'),isSourceCurrent:isCurrent},pack,requestId)});return;
    }
    if(tab==='home')await renderHome(main);else if(tab==='learning')await renderLearning(main);else if(tab==='growth')await renderGrowth(main);else if(tab==='uploads')await renderUploads(main);else if(tab==='papers')await renderPaperWorkspace({main,user,studentId,api,el,h,card,row,btn,notice,exportsFor,notify,heading,empty});else if(tab==='homeworks')await renderHomeworks({main,user,studentId,api,el,h,card,row,btn,notice,exportsFor,notify,heading,empty,openPack,onEnter:()=>activateTab('homeworks')});
  } catch(err){if(user)main.replaceChildren(notice(err.message),btn('重新加载',render,'secondary'));}
}
function heading(title,subtitle,actions){return el('div',{class:'intro'},el('div',{},h('p','学习规划 / 三步闭环进步','eyebrow'),h('h1',title),h('p',subtitle)),actions);}
function loopView(cycle){
  const nodes=[];['能力筛查','针对性学习','复测与成长档案'].forEach((title,i)=>{if(i)nodes.push(h('span','→','loop-arrow'));const s=cycle.steps[i];nodes.push(el('section',{class:`loop-step${s.done?' done':''}`},el('div',{class:'loop-step-top'},h('span',String(i+1).padStart(2,'0'),'loop-num'),h('b',title)),h('small',s.text)));});return el('div',{class:'loop-stepper','aria-label':'本轮三步学习闭环'},nodes);
}
async function renderHome(main){
  const g=await api(`/students/${studentId}/growth`),count=g.evidence.length,answered=g.evidence.reduce((n,a)=>n+a.total,0),retests=g.evidence.filter(a=>a.phase==='retest').length;
  const savedCycle=user.role==='parent'?null:await api(`/students/${studentId}/learning-cycle?subject=${subject}`);
  const cycle=user.role==='parent'?{steps:[{done:false,text:'只查看孩子已提交的筛查记录'},{done:false,text:'由关联老师审核与辅导'},{done:retests>0,text:retests?`已有 ${retests} 次复测记录`:'尚未复测，不推断进步'}]}:learningCycle([savedCycle.diagnostic,savedCycle.practice,savedCycle.retest].filter(Boolean),savedCycle.pack?[savedCycle.pack]:[],subject);
  main.replaceChildren(heading(user.role==='teacher'?'把辅导落到每一步。':user.role==='parent'?'陪伴成长，看真实记录。':'今天，也向前一点。','能力筛查 → 针对性学习（讲解、记背、练习）→ 复测与成长档案'),loopView(cycle),el('section',{class:'portal-hero'},el('div',{},h('span','数学 + 英语 · 学习工作台','badge badge-math'),h('h2',count?'把薄弱点变成今天的学习任务。':'从一次筛查，找到学习起点。','hero-headline'),h('p','学习包来自实际作答，经过老师审核。每次练习和复测都留下来源与时间，不预置成绩。','hero-sub'),btn(user.role==='parent'?'查看孩子成长档案 →':user.role==='teacher'?'进入学生辅导工作台 →':'开始自主学习 →',async()=>{tab=user.role==='parent'?'growth':'learning';await render();})),el('div',{class:'hero-stack'},[['1','先看哪里还不熟'],['2','讲解、记背、练习'],['3','复测后再观察变化']].map(([n,t])=>el('div',{class:'floating-mini-card'},h('strong',t),h('span',`STEP ${n}`))))),el('div',{class:'scenario-grid'},el('section',{class:'scenario-card online'},h('span','ONLINE · 学生自主','badge badge-math'),h('h2','线上自主学习'),h('p','学生本人完成筛查和作答；老师审核学习包，家长只读查看真实记录。'),el('div',{class:'scenario-steps-mini'},h('div','筛查定位'),h('div','针对学习'),h('div','复测记录')),user.role==='student'?btn('进入线上自主学习',async()=>{tab='learning';await render();}):h('p','以学生本人账号提交时标记「自主作答」。','origin-note')),el('section',{class:'scenario-card offline'},h('span','OFFLINE · 老师陪伴','badge badge-offline'),h('h2','线下教师辅导'),h('p','老师选择已绑定学生，审核材料、记录实际作答。人工能力观察与卷面成绩分别保存。'),el('div',{class:'scenario-steps-mini'},h('div','教师核对'),h('div','现场辅导'),h('div','复测反馈')),user.role==='teacher'?btn('进入线下辅导',async()=>{tab='learning';await render();}):h('p',user.role==='parent'?'关联孩子的记录可在成长档案查看。':'线下代录由关联老师操作，不切换成学生身份。','origin-note'))),el('div',{class:'stats'},[[count,'已提交测评记录'],[answered,'实际作答题次'],[retests,'已完成复测']].map(([n,label])=>el('div',{class:'kpi-tile'},h('div',n,'number'),h('small',label)))),notice(runtimeCapabilities?.ocr.available?'当前为数学与英语各2个示例知识点，须教师审核。本机OCR可提取待核对文字；DeepTutor RAG和AI出题未接通。':'当前为数学与英语各2个示例知识点，须教师审核。当前服务OCR、DeepTutor RAG、AI出题未接通。'));
  main.querySelector('.intro').append(exportsFor('growth',{studentId},'学习记录'));
  if(savedCycle){
    const viewerId=user.id,targetStudent=studentId,active=()=>main.isConnected&&user?.id===viewerId&&studentId===targetStudent;
    let label,description,action;
    if(!savedCycle.diagnostic){label='选择筛查范围 →';description='从已审核示例内容选择本轮起点。';action=async()=>{if(active()){tab='learning';await render();}};}
    else if(savedCycle.diagnostic.status==='open'){label='继续本轮筛查 →';description='本轮筛查尚未提交，不生成成绩。';action=async()=>{const a=await api(`/attempts/${savedCycle.diagnostic.id}`);if(active())openAttempt(a);};}
    else if(!savedCycle.pack){label='匹配本轮今日通关包 →';description='筛查已提交，按本轮实际作答匹配材料。';action=async()=>{const p=await api('/packs',{method:'POST',body:{diagnosticId:savedCycle.diagnostic.id}});if(active())await openPack(p);};}
    else if(savedCycle.retest?.status==='submitted'){label='查看本轮成长记录 →';description='本包复测已提交；只查看实际记录，不换算能力提升率。';action=async()=>{if(active()){tab='growth';await render();}};}
    else{label=savedCycle.pack.status==='draft'?(user.role==='teacher'?'审核本轮通关包 →':'查看待审核通关包 →'):'继续今日通关包 →';description=savedCycle.pack.status==='draft'?'等待关联老师核对范围并批准。':'从保存的材料、练习和复测状态继续。';action=()=>active()?openPack(savedCycle.pack):undefined;}
    const next=card(h('h2',`${subjects[subject]} · 本轮下一步`),h('p',description),btn(label,async()=>{if(active())await action();}));next.classList.add('current-cycle-action');main.insertBefore(next,main.querySelector('.portal-hero'));
  }
  if(g.homeworkEvidence?.length)main.append(card(h('h3','独立作业的实际记录'),h('p',`已提交 ${g.homeworkEvidence.length} 份；其中已人工批改 ${g.homeworkEvidence.filter(x=>x.status==='graded').length} 份。`),btn('查看作业中心',async()=>{tab='homeworks';await render();},'secondary')));
  if(user.role==='teacher')main.querySelector('.scenario-card.offline').append(btn('人工阅卷与部分分',async()=>{tab='papers';await render();},'secondary'));
}
async function renderLearning(main){
  const [knowledge,attempts,packs,savedCycle]=await Promise.all([api(`/knowledge?subject=${subject}`),api(`/attempts?studentId=${studentId}`),api(`/packs?studentId=${studentId}`),api(`/students/${studentId}/learning-cycle?subject=${subject}`)]);
  const actions=row(...Object.entries(subjects).map(([key,label])=>btn(label,async()=>{subject=key;await render();},subject===key?'':'secondary')));
  main.replaceChildren(heading('把一个知识点，学明白。','先筛查，再学习；老师审核后即可开始通关。',actions));
  main.append(h('div',user.role==='teacher'?'线下教师辅导：当前学生的筛查、练习和复测均可依据实际作答代录，来源会保留。':'线上自主学习：以下操作写入你本人的实际学习记录。',`context-banner${user.role==='teacher'?' offline':''}`),loopView(learningCycle([savedCycle.diagnostic,savedCycle.practice,savedCycle.retest].filter(Boolean),savedCycle.pack?[savedCycle.pack]:[],subject)));
  main.append(card(h('h3','保存与打印'),exportsFor('knowledge',{subject},'知识点目录'),exportsFor('attempts',{studentId},'作答记录清单'),exportsFor('packs',{studentId},'学习包清单')));
  if(user.role==='teacher')main.append(notice('老师辅导模式：代录作答会标为「教师录入」，不会冒充学生自主作答。'));
  main.append(card(h('span',`${subjects[subject]} · 示例课程`,'tag'),h('h2','从一次小筛查开始'),h('p',knowledge.map(k=>`${k.title}（${k.reviewStatus==='human_reviewed'?'已审核':'待教师审核'}）`).join('；'),'muted'),screeningAction(knowledge)));
  function screeningAction(knowledge){const button=btn('开始能力筛查',async()=>openAttempt(await api('/attempts',{method:'POST',body:{studentId,subject,phase:'diagnostic'}})));button.disabled=!knowledge.length||knowledge.some(k=>k.reviewStatus!=='human_reviewed');return row(button,button.disabled?notice('本科目示例尚未全部审核。请等待老师核对，或选择已审核知识点专项筛查。'):null,button.disabled&&user.role==='teacher'?btn('去内容审核',async()=>{tab='review';await render();},'secondary'):null);}
  const scopeSubject=subject,scopeStudent=studentId;
  const choices=knowledge.map(k=>({k,input:el('input',{type:'checkbox',value:k.id,disabled:k.reviewStatus!=='human_reviewed'})}));
  const scopeForm=el('form',{class:'card scope-selection'},h('h2','按知识点做专项筛查'),h('p','只筛查你选择的示例知识点。所选材料须先经本机构老师审核；其他知识点不作诊断，也不会被补成0分。'),...choices.map(({k,input})=>el('label',{class:'checkline'},input,`${k.title}（${k.reviewStatus==='human_reviewed'?'已审核，可选择':'待教师审核'}）`)),el('button',{type:'submit',disabled:!choices.some(c=>!c.input.disabled)},'开始所选知识点筛查'));
  scopeForm.addEventListener('submit',async event=>{event.preventDefault();const ids=choices.filter(c=>c.input.checked&&!c.input.disabled).map(c=>c.k.id);if(!ids.length){notify('请至少选择一个已审核知识点。',true);return;}const button=scopeForm.querySelector('button');button.disabled=true;try{const attempt=await api('/attempts',{method:'POST',body:{studentId:scopeStudent,subject:scopeSubject,phase:'diagnostic',knowledgeIds:ids}});if(main.isConnected&&scopeForm.isConnected)openAttempt(attempt);}catch(error){notify(error.message,true);}finally{if(scopeForm.isConnected)button.disabled=false;}});main.append(scopeForm);
  const pending=attempts.filter(a=>a.subject===subject&&a.status==='open');
  if(pending.length)main.append(card(h('h3','继续未完成的作答'),pending.map(a=>row(h('p',scopeDescription(a.scope),'scope-label'),btn(`继续${phases[a.phase]}`,async()=>openAttempt(await api(`/attempts/${a.id}`)),'secondary')))));
  const submitted=attempts.filter(a=>a.subject===subject&&a.phase==='diagnostic'&&a.status==='submitted'&&!packs.some(p=>p.diagnosticId===a.id));
  if(submitted.length)main.append(card(h('h3','筛查已完成'),h('p','依据已提交答案匹配学习包。'),submitted.map(a=>row(h('p',scopeDescription(a.scope),'scope-label'),btn('匹配学习包',async()=>{await api('/packs',{method:'POST',body:{diagnosticId:a.id}});await render();})))));
  main.append(h('h2','我的通关包'));
  const scoped=packs.filter(p=>p.subject===subject);
  if(!scoped.length)main.append(empty('完成筛查后，这里会出现适合你的通关包。'));
  for(const p of scoped)main.append(card(h('span',statuses[p.status],`tag ${p.status==='draft'?'pending':''}`),h('h3',p.materials.map(m=>m.title).join(' + ')),h('p',p.weakKnowledgeIds.length?'按本次错题对应知识点匹配':'本次筛查全部答对，安排巩固学习','muted'),btn(user.role==='teacher'?'查看 / 调整通关包':'打开通关包',async()=>openPack(p))));
}
function openAttempt(a){
  if(!user||a.studentId!==studentId)return;
  const main=$('#main'),form=el('form',{}),submitted=a.status==='submitted';
  main.replaceChildren(heading(phases[a.phase],`${subjects[a.subject]} · ${a.questions.length} 道原创示例题`,btn('返回学习列表',render,'secondary')));
  window.scrollTo(0,0);main.focus({preventScroll:true});
  main.append(exportsFor('attempt',{id:a.id},submitted?'报告与题目解析':'题目作答单（不含答案）'));
  main.append(notice(scopeDescription(a.scope)));
  if(user.role==='teacher')main.append(notice('请依据学生实际作答录入，提交后将标记为教师录入。'));
  for(const [i,q] of a.questions.entries()){
    const field=el('fieldset',{class:'question'},h('legend',`${i+1}. ${q.prompt}`));
    q.options.forEach((option,n)=>field.append(el('label',{class:'option'},el('input',{type:'radio',name:q.id,value:n,required:true,disabled:submitted,checked:submitted&&q.selectedOption===n}),`${String.fromCharCode(65+n)}. ${option}`)));
    if(submitted)field.append(el('div',{class:`result ${q.isCorrect?'correct':'incorrect'}`},h('b',q.isCorrect?'回答正确':'再练一练'),h('p',`正确答案：${String.fromCharCode(65+q.correctOption)}。${q.rationale}`)));
    form.append(field);
  }
  if(!submitted){form.append(el('button',{type:'submit'},'提交本次实际作答'));form.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('button');submit.disabled=true;try{const data=new FormData(form);openAttempt(await api(`/attempts/${a.id}/submit`,{method:'POST',body:{answers:a.questions.map(q=>({questionId:q.id,selectedOption:Number(data.get(q.id))}))}}));}catch(err){notify(err.message,true);submit.disabled=false;}});}
  else {main.append(card(h('h2',`本次答对 ${a.result.correct} / ${a.result.total} 题`),h('p',`记录来源：${a.source==='student_self'?'学生自主作答':'教师依据实际作答录入'}。已保存，不能覆盖。`)));if(a.phase==='diagnostic')form.append(btn('匹配今日通关包 →',async()=>{const pack=await api('/packs',{method:'POST',body:{diagnosticId:a.id}});if(main.isConnected&&form.isConnected)await openPack(pack);}));else form.append(btn(a.phase==='practice'?'回到学习包，继续复测':'查看成长档案',async()=>{if(a.phase==='practice'){const pack=await api(`/packs/${a.packId}`);if(main.isConnected&&form.isConnected)await openPack(pack);}else{tab='growth';await render();}}));}
  main.append(form);
}
async function openPack(p){
  if(!user||!p||p.studentId!==studentId)return;
  subject=p.subject;
  const viewer=user,epoch=identityEpoch,targetStudent=studentId,main=$('#main');
  const active=()=>Boolean(user&&user.id===viewer.id&&identityEpoch===epoch&&studentId===targetStudent&&main.isConnected);
  await renderPackWorkspace({main,user:viewer,studentId:targetStudent,api,el,h,card,row,btn,notice,exportsFor,notify,heading,empty,
    isActive:active,onEnter:()=>activateTab('learning'),openAttempt,
    back:async()=>{if(active()){tab='learning';await render();}},goGrowth:async()=>{if(active()){tab='growth';await render();}},
    fromPack:(pack,requestId,isCurrent)=>homeworkFromPack({main,user:viewer,studentId:targetStudent,api,el,h,card,row,btn,notice,exportsFor,notify,heading,empty,openPack,onEnter:()=>activateTab('homeworks'),isSourceCurrent:isCurrent},pack,requestId)
  },p.id);
}

async function renderGrowth(main){
  const g=await api(`/students/${studentId}/growth`);
  main.replaceChildren(heading('每一步，都有迹可循。','记录真实作答，观察具体知识点。'),notice(g.notice));
  main.querySelector('.intro').append(exportsFor('growth',{studentId}));
  if(!g.comparisons.length)main.append(notice('尚无进步对比依据：还没有与筛查对应的已提交复测。请完成「筛查 → 今日通关包 → 复测」后再查看对比；独立作业和人工阅卷不替代复测。'));
  if(g.homeworkEvidence?.length)main.append(card(h('h2','独立作业（只含实际提交）'),exportsFor('homework-summaries',{studentId},'作业摘要'),...g.homeworkEvidence.map(task=>h('p',`${task.title}：${task.score?`教师人工分数 ${task.score.earned}/${task.score.max}`:'已提交，待人工批改'} · ${fmt(task.submittedAt)}`)),h('small','未发布、未提交作业不进入此区；不与测评/人工阅卷相加为进步率。')));
  if(g.paperEvidence?.length)main.append(card(h('h2','线下人工记录（独立口径）'),exportsFor('paper-summaries',{studentId},'已确认的辅导摘要'),...g.paperEvidence.map(p=>h('p',`${p.title}：${p.score?`实际卷面分 ${p.score.earned}/${p.score.max}`:`0–3人工观察 ${p.itemCount} 条，不折算分数`} · ${fmt(p.confirmedAt)}`)),h('small','不与在线选择题计数合并，不使用AI推断，不将观察档位换算成正确率。')));
  if(!g.evidence.length){main.append(empty('还没有已提交的测评作答；独立作业和人工阅卷在各自区域列示。'));return;}
  const table=el('table',{},el('thead',{},el('tr',{},['知识点','阶段','答对 / 作答'].map(s=>h('th',s)))),el('tbody',{},g.topicEvidence.map(t=>el('tr',{},h('td',t.title),h('td',phases[t.phase]),h('td',`${t.correct} / ${t.answered}`)))));
  main.append(card(h('h2','按知识点回看'),el('div',{class:'table-wrap'},table)),card(h('h2','学习时间线'),el('div',{class:'timeline'},g.evidence.slice().reverse().map(a=>el('div',{class:'event'},el('div',{},h('strong',`${subjects[a.subject]} · ${phases[a.phase]}`),h('small',`${fmt(a.submittedAt)} · ${a.source==='student_self'?'自主作答':'教师录入'}`),h('small',scopeDescription(a.scope),'scope-label')),h('span',`${a.correct} / ${a.total}`,'score'))))));
  if(g.comparisons.length)main.append(card(h('h2','筛查与复测记录'),g.comparisons.map(c=>h('p',`筛查 ${c.diagnosticCorrect}/${c.diagnosticTotal} 题；该学习包复测 ${c.retestCorrect}/${c.retestTotal} 题。`)),h('small','范围和题目不同，以上计数不直接换算成能力提升率。')));
}
async function renderReview(main){
  const topics=await api('/content/review-queue');
  main.replaceChildren(heading('好内容，从认真核对开始。','逐点核验讲解、记背卡，以及筛查、练习、复测题。'),notice('这些题目为原创微型示例。答案推导与自动测试不替代教师审核；请实际核对后再确认。'));
  main.querySelector('.intro').append(exportsFor('content',{},'全部讲义'));
  for(const t of topics){
    const section=card(h('span',t.reviewStatus==='human_reviewed'?'本机构已人工审核':'待人工审核',`tag ${t.reviewStatus==='human_reviewed'?'':'pending'}`),h('h2',t.title),h('p',t.explanation),h('p',t.memory_card,'memory'));
    section.append(exportsFor('content',{id:t.id},'本知识点讲义与审核记录'));
    section.append(el('details',{},h('summary',`展开 ${t.questions.length} 道样题及答案推导`),t.questions.map(q=>el('div',{class:'review-question'},h('b',`${phases[q.phase]}：${q.prompt}`),h('p',q.options.map((o,i)=>`${String.fromCharCode(65+i)}. ${o}`).join('　')),h('p',`答案 ${String.fromCharCode(65+q.correctOption)}：${q.rationale}`),h('small',`自动核验说明：${q.automatedCheck}`)))));
    if(t.reviewStatus!=='human_reviewed'){
      const checked=el('input',{type:'checkbox'});
      section.append(el('label',{class:'checkline'},checked,'我已逐项核对内容、选项、答案与推导，确认可用于示例学习。'),btn('确认人工审核',async()=>{if(!checked.checked)throw new Error('请先实际核对并勾选确认。');await api(`/content/${t.id}/review`,{method:'POST',body:{version:t.version,confirmed:true}});await render();}));
    }main.append(section);
  }
}
async function renderUploads(main){
  if(releaseInfo?.uploadsAvailable===false){main.replaceChildren(heading('图片上传暂不可用',releaseInfo.uploadsUnavailableReason||'当前环境未配置图片存储。'),notice('不会用模拟图片或 OCR 结果代替。可在「线下人工阅卷」录入实际卷面分和独立能力观察。'),exportsFor('uploads',{studentId},'已有核对记录'));return;}
  main.replaceChildren(heading('拍照之后，认真核对。','图片仅供本人和关联老师访问，24 小时后停止访问。'),notice(runtimeCapabilities?.ocr.available?'可使用本机OCR提取文字，仍需老师核对。不会自动生成答案或成绩。上传前请遮挡姓名、学校等信息。':'OCR 服务尚未接通。不会生成模拟识别结果；可人工录入核对。原图请先遮挡姓名、学校等信息。'));
  main.querySelector('.intro').append(exportsFor('uploads',{studentId},'核对记录清单'));
  const file=el('input',{type:'file',accept:'image/png,image/jpeg','aria-label':'选择试卷图片',required:true}),form=el('form',{class:'card'},h('h3','选择试卷图片'),h('p','PNG / JPEG，最大 2 MiB，最大 1200 万像素。','muted'),file,el('button',{type:'submit'},'上传并人工核对'));
  form.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('button');submit.disabled=true;try{const image=file.files[0];if(!image)throw new Error('请先选择图片');if(image.size>2*1024*1024)throw new Error('图片不能超过 2 MiB');const upload=await api(`/uploads?studentId=${studentId}`,{method:'POST',body:image,raw:true});await showUpload(upload,main);}catch(err){notify(err.message,true);}finally{submit.disabled=false;}});main.append(form);
  const list=await api(`/uploads?studentId=${studentId}`);
  if(list.length)main.append(card(h('h3','未过期的图片'),row(list.map(u=>btn(`${u.status==='confirmed'?'已核对':'待核对'} · ${fmt(u.expiresAt-86400000)}`,async()=>showUpload(u,main),'secondary')))));
}
async function showUpload(u,main){
  const old=$('#upload-review');if(old)old.remove();$('#ocr-panel')?.remove();
  const text=el('textarea',{maxlength:10000,required:true,'aria-label':'人工核对文本',placeholder:'对照图片，人工录入题干、选项或需要老师协助核对的内容。'},u.correctedText||''),confirmed=el('input',{type:'checkbox',required:true});
  const form=el('form',{id:'upload-review',class:'card'},h('h2','原图与人工核对'),notice(u.notice),el('img',{class:'paper-preview',src:`/api/v1/uploads/${u.id}/image`,alt:'已上传的私有试卷图片'}),el('label',{},'核对文本',text),el('label',{class:'checkline'},confirmed,'我已对照原图检查文本。此操作不会生成学习分数。'),row(el('button',{type:'submit'},'保存人工核对'),btn('删除图片与核对文本',async()=>{await api(`/uploads/${u.id}`,{method:'DELETE'});await render();},'danger')));
  form.prepend(exportsFor('upload',{id:u.id},'图片与已保存的核对文本'));
  form.addEventListener('submit',async e=>{e.preventDefault();try{u=await api(`/uploads/${u.id}/review`,{method:'PATCH',body:{text:text.value,confirmed:confirmed.checked,revision:u.revision}});notify('人工核对已保存，未生成分数。');await showUpload(u,main);}catch(err){notify(err.message,true);}});main.append(form);
  main.append(await ocrPanel({main,user,studentId,api,el,h,card,row,btn,notice,exportsFor,notify,heading,empty},u));
}
async function renderAdmin(main){
  const [users,links]=await Promise.all([api('/admin/users'),api('/admin/relationships')]);
  main.replaceChildren(heading('让合适的人，看见合适的内容。','管理员负责账号与授权，不默认读取学生学习内容。'));
  main.append(card(h('h3','后台可导出业务报表'),exportsFor('admin-users',{},'账号清单'),exportsFor('admin-relationships',{},'授权关系'),exportsFor('admin-audit',{},'操作审计')));
  const username=el('input',{required:true,minlength:3,maxlength:32,placeholder:'3–32 位字母、数字、_ 或 -','aria-label':'新账号登录名'}),displayName=el('input',{required:true,maxlength:32,placeholder:'显示别名，不要填写真实姓名','aria-label':'新账号显示别名'}),role=el('select',{'aria-label':'新账号角色'},['student','teacher','parent'].map(r=>el('option',{value:r},roles[r]))),output=el('div',{});
  const create=el('form',{class:'card stack'},h('h3','创建账号'),username,displayName,role,el('button',{type:'submit'},'创建并生成随机初始密码'),output);
  create.addEventListener('submit',async e=>{e.preventDefault();try{const result=await api('/admin/users',{method:'POST',body:{username:username.value,displayName:displayName.value,role:role.value}});output.replaceChildren(h('p',`${result.username} 的初始密码：${result.initialPassword}`,'password-output'),h('small',result.notice),btn('已保存初始密码，刷新账号与绑定列表',render,'secondary'));create.querySelector('button').disabled=true;}catch(err){notify(err.message,true);}});
  const adult=el('select',{'aria-label':'选择老师或家长'},users.filter(u=>['teacher','parent'].includes(u.role)&&u.active).map(u=>el('option',{value:u.id},`${u.displayName} · ${roles[u.role]}`))),student=el('select',{'aria-label':'选择被绑定学生'},users.filter(u=>u.role==='student'&&u.active).map(u=>el('option',{value:u.id},u.displayName)));
  const bind=el('form',{class:'card stack'},h('h3','建立授权关系'),adult,student,el('button',{type:'submit'},'确认绑定'));
  bind.addEventListener('submit',async e=>{e.preventDefault();try{await api('/admin/relationships',{method:'POST',body:{adultId:adult.value,studentId:student.value}});await render();}catch(err){notify(err.message,true);}});
  const names=new Map(users.map(u=>[u.id,u.displayName]));
  main.append(el('div',{class:'grid'},create,bind),card(h('h3','当前关系'),links.length?el('div',{class:'stack'},links.map(l=>row(h('span',`${names.get(l.adultId)} → ${names.get(l.studentId)}（${roles[l.kind]}）`),btn('撤销访问',async()=>{await api(`/admin/relationships/${l.id}`,{method:'DELETE'});await render();},'danger')))):empty('尚未建立关系')),card(h('h3','账号列表'),el('div',{class:'table-wrap'},el('table',{},el('thead',{},el('tr',{},['登录名','别名','角色','状态'].map(s=>h('th',s)))),el('tbody',{},users.map(u=>el('tr',{},h('td',u.username),h('td',u.displayName),h('td',roles[u.role]),el('td',{},u.role==='admin'?'管理账号':btn(u.active?'停用账号':'启用账号',async()=>{await api(`/admin/users/${u.id}`,{method:'PATCH',body:{active:!u.active}});await render();},u.active?'danger':'secondary')))))))));
  const audit=card(h('h3','最近管理操作'),notice('正在读取审计记录…'));main.append(audit);
  async function loadAudit(){try{const records=await api('/admin/audit');if(!main.isConnected)return;audit.replaceChildren(h('h3','最近管理操作'),exportsFor('admin-audit',{},'操作审计'),records.length?el('div',{class:'table-wrap'},el('table',{},el('thead',{},el('tr',{},['时间','动作','操作账号'].map(x=>h('th',x)))),el('tbody',{},records.map(x=>el('tr',{},h('td',fmt(x.createdAt)),h('td',x.action),h('td',names.get(x.actorId)||'已移除账号')))))):empty('暂无操作记录。'));}catch(e){if(main.isConnected)audit.replaceChildren(h('h3','审计暂时不可用'),notice(e.message),btn('重试读取审计',loadAudit));}}
  await loadAudit();
}
window.addEventListener('offline',()=>notify('已离线。学习记录不会离线提交或自动补交。',true));
try{const config=await fetch('/release.json',{cache:'no-store'});if(config.ok)releaseInfo=await config.json();}catch{}
try{const session=await api('/auth/session');user=session.user;csrfToken=session.csrfToken;await loadWorkspace();}catch(error){renderLogin(error.status===401?'':error.message);}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});

window.addEventListener('pageshow',event=>{if(event.persisted){$('#app').replaceChildren();location.reload();}});
