import {createPackReview} from './teacher-editors.js';
// Antigravity-inspired tabs/chips/cards, independently wired to authenticated APIs.
// Reading and flipping are transient UI actions, never mastery or completion writes.
let viewSerial=0;
const statusLabels={draft:'待老师审核',approved:'可以开始',in_progress:'学习中',completed:'本包复测已记录'};
const originLabel=a=>a.source==='student_self'?'学生自主作答':a.source==='teacher_recorded'?'教师依据实际作答录入':'来源未记录';
export async function renderPackWorkspace(ctx,packId,view={}){
  if(!ctx.isActive())return;
  const {main,user,studentId,api,el,h,card,row,btn,notice,exportsFor,heading}=ctx;
  const serial=++viewSerial,marker=el('span',{hidden:true}),current=()=>serial===viewSerial&&marker.parentNode===main&&ctx.isActive();
  const replace=(...children)=>main.replaceChildren(marker,...children);ctx.onEnter();
  replace(heading('正在读取今日通关包…','正在核对账号、学生和已保存记录。',btn('返回学习列表',ctx.back,'secondary')));
  let data,knowledge=[];
  try{
    data=await api(`/packs/${encodeURIComponent(packId)}/activity`);if(!current())return;
    if(!data?.pack||data.pack.id!==packId||data.pack.studentId!==studentId||!Array.isArray(data.pack.materials))throw new Error('通关包响应与当前学生不一致，请重新读取。');
    if(!['draft','approved','in_progress','completed'].includes(data.pack.status)||data.pack.materials.some(m=>!m||typeof m.id!=='string'||typeof m.title!=='string'||typeof m.explanation!=='string'||typeof m.memoryCard!=='string'))throw new Error('学习材料暂不完整，请联系老师核对。');
    for(const phase of ['practice','retest']){const a=data[phase];if(a&&(a.packId!==packId||a.subject!==data.pack.subject||a.phase!==phase||!['open','submitted'].includes(a.status)||(a.status==='submitted'&&(!a.result||!Number.isInteger(a.result.correct)||!Number.isInteger(a.result.total)||a.result.total<1||a.result.correct<0||a.result.correct>a.result.total))))throw new Error('作答状态不完整，请刷新后再试。');}
    if(data.pack.status==='completed'&&data.retest?.status!=='submitted')throw new Error('学习包状态正在变化，请刷新核对复测记录。');
    if(user.role==='teacher'&&['draft','approved'].includes(data.pack.status)){knowledge=await api(`/knowledge?subject=${data.pack.subject}`);if(!current())return;}
  }catch(error){if(current())replace(heading('通关包暂不可读取','没有显示替代内容。请检查权限或联网后重试。'),notice(error.message),row(btn('重新读取通关包',()=>renderPackWorkspace(ctx,packId,view)),btn('返回学习列表',ctx.back,'secondary')));return;}
  const p=data.pack,practice=data.practice,retest=data.retest;
  let activeTab=['explain','cards','practice'].includes(view.tab)?view.tab:(practice?'practice':'explain'),topicIndex=Math.min(Math.max(0,view.topicIndex||0),Math.max(0,p.materials.length-1)),flipped=false;
  const refresh=()=>renderPackWorkspace(ctx,packId,{tab:activeTab,topicIndex});
  replace(heading('今日通关包','第 2 步 · 讲解 → 记背 → 实际练习，再进入复测与成长',btn('返回学习列表',ctx.back,'secondary')),h('span',statusLabels[p.status],`tag ${p.status==='draft'?'pending':''}`));
  main.classList.add('pack-workspace');window.scrollTo(0,0);main.focus({preventScroll:true});
  main.append(h('p',user.role==='teacher'?'线下教师辅导：依据当前学生的实际作答指导；代录保留教师来源。':'线上自主学习：阅读材料后，提交本人实际练习；没有预置成绩。',`context-banner${user.role==='teacher'?' offline':''}`));
  const errorBox=el('div',{'aria-live':'polite'});main.append(row(exportsFor('pack',{id:p.id},'完整通关包与教师指导'),p.status!=='draft'?exportsFor('assignment',{id:p.id},'无答案通关练习单'):null,btn('刷新审核与作答状态',refresh,'secondary')),h('p','导出包含服务器保存的全部讲解和记背卡，不受当前标签或翻面影响。','fineprint'),errorBox);
  if(!p.materials.length){main.append(ctx.empty('这个学习包暂无可用材料，不能开始练习。请联系关联老师核对。'));return;}
  async function act(fn){if(!current())return;errorBox.replaceChildren();try{await fn();}catch(error){if(current())errorBox.replaceChildren(notice(error.message),btn('刷新已保存状态',refresh,'secondary'));}}
  async function readAttempt(attempt){await act(async()=>{const a=await api(`/attempts/${encodeURIComponent(attempt.id)}`);if(current())ctx.openAttempt(a);});}
  async function startAttempt(phase){await act(async()=>{const a=await api('/attempts',{method:'POST',body:{studentId:p.studentId,subject:p.subject,phase,packId:p.id}});if(current())ctx.openAttempt(a);});}
  const actionPanel=card(h('h2','本包下一步'));actionPanel.classList.add('pack-next-action');
  if(p.status==='draft')actionPanel.append(notice('等待关联老师审核。可以预览已保存材料，未经批准不能进入练习。'),user.role==='teacher'?h('p','请在下方核对范围与指导语，确认后批准。'):h('p','老师尚未批准本包，请稍后刷新审核状态。'));
  else if(!practice)actionPanel.append(h('p','阅读讲解与记背卡后，开始本包的实际练习。'),btn('开始通关练习 →',()=>startAttempt('practice')));
  else{
    actionPanel.append(h('p',practice.status==='submitted'?`练习已提交：答对 ${practice.result.correct} / ${practice.result.total} 题。`:'练习尚未提交，不作为完成或成长证据。'),practice.status==='submitted'?h('small',`记录来源：${originLabel(practice)}`,'origin-note'):null,btn(practice.status==='open'?'继续练习':'回看练习',()=>readAttempt(practice),'secondary'),exportsFor('attempt',{id:practice.id},practice.status==='open'?'当前练习作答单':'练习报告'));
    if(retest)actionPanel.append(h('p',retest.status==='submitted'?`复测已记录：答对 ${retest.result.correct} / ${retest.result.total} 题。不同题目计数不换算为能力提升率。`:'复测尚未提交，暂无进步对比依据。'),retest.status==='submitted'?h('small',`记录来源：${originLabel(retest)}`,'origin-note'):null,btn(retest.status==='open'?'继续复测':'回看复测',()=>readAttempt(retest)),exportsFor('attempt',{id:retest.id},retest.status==='open'?'当前复测作答单':'复测报告'),retest.status==='submitted'?btn('查看成长档案',ctx.goGrowth,'secondary'):null);
    else if(practice.status==='submitted')actionPanel.append(h('p','已具备复测条件；尚未复测，不推断进步。'),btn('开始学习复测 →',()=>startAttempt('retest')));
    else actionPanel.append(h('p','先提交本次实际练习，再进行复测。','muted'));
  }
  main.append(actionPanel);
  const chips=el('div',{class:'chip-group','aria-label':'当前通关包知识点'}),tabs=el('div',{class:'tabs pack-tabs',role:'tablist','aria-label':'通关包学习环节'}),panel=el('section',{class:'card pack-panel',role:'tabpanel',id:`pack-panel-${serial}`,tabindex:0});
  const topicButtons=p.materials.map((m,index)=>{const button=btn(m.title,()=>{if(!current())return;topicIndex=index;flipped=false;renderPanel();},'chip-btn');chips.append(button);return button;});
  const tabButtons=[['explain','① 要点讲解'],['cards','② 记背卡'],['practice','③ 练习与复测']].map(([key,label])=>{const button=el('button',{type:'button',class:'tab-btn',role:'tab',id:`pack-tab-${serial}-${key}`,'aria-controls':panel.id,onclick:()=>switchTab(key)},label);tabs.append(button);return {key,button};});
  function switchTab(key){if(!current())return;activeTab=key;flipped=false;renderPanel();}
  tabs.addEventListener('keydown',event=>{const index=tabButtons.findIndex(t=>t.key===activeTab);let next;if(event.key==='ArrowRight')next=(index+1)%3;else if(event.key==='ArrowLeft')next=(index+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;event.preventDefault();switchTab(tabButtons[next].key);tabButtons[next].button.focus();});
  function renderPanel(){
    if(!current())return;const m=p.materials[topicIndex];
    topicButtons.forEach((button,index)=>{button.classList.toggle('active',index===topicIndex);button.setAttribute('aria-pressed',String(index===topicIndex));});
    for(const t of tabButtons){const selected=t.key===activeTab;t.button.classList.toggle('active',selected);t.button.setAttribute('aria-selected',String(selected));t.button.tabIndex=selected?0:-1;}panel.setAttribute('aria-labelledby',`pack-tab-${serial}-${activeTab}`);
    panel.replaceChildren(h('span',`原创示例材料 v${m.version} · 当前查看知识点 ${topicIndex+1}/${p.materials.length}`,'tag'),h('h2',m.title));
    if(activeTab==='explain')panel.append(h('p',m.explanation,'pack-prose'),h('p',user.role==='teacher'?'请结合学生实际问题讲解；本页不会自动生成课堂反馈。':'先读懂本节要点，再用记背卡回想。','muted'),btn('进入下一步：记背卡 →',()=>switchTab('cards')));
    else if(activeTab==='cards'){
      const flip=el('button',{type:'button',class:`flashcard${flipped?' flashcard-back':''}`,'aria-label':'翻转记背卡','aria-pressed':String(flipped),onclick:()=>{flipped=!flipped;renderPanel();panel.querySelector('.flashcard')?.focus();}},h('span',flipped?'背面 · 保存的记背内容':'正面 · 回想本节要点','flashcard-face-tag'),h('span',flipped?m.memoryCard:`${m.title}：你能回想关键规则或步骤吗？`,'flashcard-main'),h('span','Enter / 空格翻面；翻卡不计掌握度或完成。','flashcard-hint'));
      const previous=btn('← 上一个知识点',()=>{topicIndex--;flipped=false;renderPanel();},'secondary'),next=btn('下一个知识点 →',()=>{topicIndex++;flipped=false;renderPanel();},'secondary');previous.disabled=topicIndex===0;next.disabled=topicIndex===p.materials.length-1;
      panel.append(el('div',{class:'flashcard-stage'},flip),row(previous,next),h('p','翻面和切换仅用于本次阅读，不保存“已掌握”，不生成学习成绩。','fineprint'),btn('进入下一步：练习与复测 →',()=>switchTab('practice')));
    }else panel.append(h('p',p.status==='draft'?'本包尚待老师批准，暂不能开始实际练习。':practice?.status==='submitted'?'本包已有真实练习记录，可在上方回看或继续复测。':'通过上方“本包下一步”进入真实作答页，提交后才能进入成长记录。'),h('p','练习覆盖本包全部已批准范围，不只当前浏览的知识点。题目、答案与评分均来自服务端。','muted'),btn('定位到本包下一步',()=>{actionPanel.scrollIntoView({block:'center'});actionPanel.querySelector('button')?.focus();},'secondary'));
  }
  main.append(chips,tabs,panel);renderPanel();
  main.append(card(h('h3','老师的指导'),h('p',p.teacherNote||'本包暂无保存的教师指导语。','pack-prose')));
  if(user.role==='teacher'&&['draft','approved'].includes(p.status)){
    main.append(createPackReview({...ctx,isCurrent:current,onSaved:refresh,onDenied:error=>{if(current())replace(heading('学习包授权已变化','已关闭材料与未保存编辑。'),notice(error.message),btn('返回学习列表',ctx.back,'secondary'));}},p,knowledge).element);
  }
  if(user.role==='teacher'&&p.status!=='draft'){const intentId=crypto.randomUUID();main.append(btn('从通关包创建独立作业草稿',()=>act(()=>ctx.fromPack(p,intentId,current)),'secondary'));}
}
