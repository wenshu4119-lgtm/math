// Anonymous aggregate endpoints only. No sessions, student records, answers or storage.
const state = document.querySelector('#coverage-state');
const totals = document.querySelector('#coverage-totals');
const detail = document.querySelector('#coverage-detail');
const subjects = document.querySelector('#coverage-subjects');
const refresh = document.querySelector('#coverage-refresh');
const aiStatus = document.querySelector('#ai-public-status');
const names = {chinese:'语文',math:'数学',english:'英语',physics:'物理',chemistry:'化学',biology:'生物',history:'历史',geography:'地理',civics:'道德与法治',politics:'道德与法治',morality:'道德与法治'};
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = String(text); if(className) node.className = className; return node; };
const count = (record, key) => {const value=record[key]; if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid aggregate count'); return value;};
const gradeName = grade => ({7:'初一',8:'初二',9:'初三',grade7:'初一',grade8:'初二',grade9:'初三'}[grade] || String(grade));
async function aggregate(path) {
  const response = await fetch(path,{credentials:'omit',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Aggregate unavailable');
  const result=await response.json();
  if(!result.data||typeof result.data!=='object')throw Error('Invalid response');
  return result.data;
}
function metric(label, value, hint) {
  const wrapper=element('div',undefined,'coverage-total'),dl=element('dl');
  dl.append(element('dt',label),element('dd',value.toLocaleString('zh-CN')));wrapper.append(dl,element('p',hint));return wrapper;
}
function field(label,value){const node=element('div');node.append(element('dt',label),element('dd',value));return node;}
function renderCoverage(data) {
  // Reject incomplete data instead of turning absent statistics into zero.
  const source=data.totals||data;
  const counts=Object.fromEntries(['questionCount','catalogCount','publishedCount','reviewedCount','unreviewedCount','quarantinedCount','studentPracticeCount','studentScoredCount','legacyExampleCount'].map(key=>[key,count(source,key)]));
  if(!Array.isArray(data.subjects))throw Error('Invalid subjects');
  const cards=data.subjects.map(subject=>{
    const catalog=count(subject,'questionCount'),available=count(subject,'studentPracticeCount');
    const reviewed=count(subject,'reviewedCount');
    const card=element('article',undefined,'subject-card'),heading=element('div',undefined,'subject-head');
    heading.append(element('h3',subject.name||names[subject.id]||names[subject.subject]||subject.id||subject.subject||'学科'),element('span',catalog>0?'分批建设中':'待建设','subject-progress'));
    const stats=element('dl');stats.append(field('目录题量',catalog.toLocaleString('zh-CN')),field('自主练习可用',available.toLocaleString('zh-CN')),field('老师已审核',reviewed.toLocaleString('zh-CN')));
    if(Number.isSafeInteger(subject.knowledgeCount)&&subject.knowledgeCount>=0)stats.append(field('知识点',subject.knowledgeCount.toLocaleString('zh-CN')));
    const grades=Array.isArray(subject.grades)?subject.grades:[];
    card.append(heading,stats,element('p',grades.length?`当前标注年级：${grades.map(gradeName).join('、')}`:'当前没有已入库年级内容','subject-grade'));
    if(subject.note||subject.scope)card.append(element('p',subject.note||subject.scope,'subject-scope'));
    return card;
  });
  totals.replaceChildren(metric('目录中题目',counts.questionCount,'含原有示例、待审与隔离内容'),metric('自主练习可用',counts.studentPracticeCount,'不计入正式成绩'),metric('老师已审核',counts.reviewedCount,'具体版本的真人审核'),metric('未完成教师审核',counts.unreviewedCount,'含隔离题；自动检查不等于审核'));
  const timestamp=data.generatedAt||data.observedAt;
  const date=timestamp?new Date(timestamp):null;
  detail.textContent=`初中题库目录 ${counts.catalogCount.toLocaleString('zh-CN')} 题，另有原有示例 ${counts.legacyExampleCount.toLocaleString('zh-CN')} 题。本轮经教师审核后发布 ${counts.publishedCount.toLocaleString('zh-CN')} 题 · 严重疑点隔离 ${counts.quarantinedCount.toLocaleString('zh-CN')} 题 · 当前可用于正式测评 ${counts.studentScoredCount.toLocaleString('zh-CN')} 题。${date&&!Number.isNaN(date.valueOf())?`统计读取时间：${date.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）。`:''}审核数、可用数按当前版本统计，不同统计口径不能相加。`;
  subjects.replaceChildren(...cards);totals.hidden=false;detail.hidden=false;subjects.hidden=false;
  state.dataset.state='ready';state.textContent='以下数字来自初中题库聚合统计，不包含学生身份、作答或题目答案。';
}
async function loadCoverage(){
  refresh.disabled=true;state.dataset.state='loading';state.textContent='正在读取正式题库统计…';
  // Never keep stale counts on screen after a failed refresh.
  totals.hidden=true;detail.hidden=true;subjects.hidden=true;
  try{renderCoverage(await aggregate('/api/v1/public/coverage'));}
  catch{state.dataset.state='error';state.textContent='暂时无法读取当前题库统计，请稍后刷新。本页不提供估算题量，也不据此判断学科已完成。';}
  finally{refresh.disabled=false;}
}
async function loadAI(){
  try{
    const data=await aggregate('/api/v1/public/ai-status');
    if(!['limited','unavailable'].includes(data.status)||typeof data.message!=='string')throw Error('Invalid AI status');
    aiStatus.textContent=`${data.label|| (data.status==='limited'?'有限范围可用':'当前不可用')}：${data.message}`;
  }catch{aiStatus.textContent='暂时无法核实 DeepTutor 服务状态。请稍后重试，或登录查看实际入口；本页不显示接入成功。';}
}
refresh.addEventListener('click',()=>{void loadCoverage();void loadAI();});
void loadCoverage();void loadAI();
