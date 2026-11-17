// Shared by the authenticated API and the original anonymous arts planner.
export const NAMES={chinese:'语文',math:'数学',english:'英语',physics:'物理',chemistry:'化学',biology:'生物',history:'历史',geography:'地理',politics:'思想政治',civics:'道德与法治'};
export const TYPES={foundation:'补基础',learn:'学习讲义',practice:'针对练习',review:'间隔复习',retest:'同范围复测',reflection:'阶段复盘'};
export const ARTS=['chinese','math','english','history','geography','politics'];
export const TIERS={400:[85,70,75,60,55,55],450:[95,80,85,65,62,63],500:[105,90,95,70,70,70],550:[115,100,105,80,75,75]};
const DAY=86400000;
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function dateNumber(s){check(typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s),'日期格式不正确');const n=Date.parse(s+'T00:00:00Z');check(Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s,'日期不存在');return n/DAY;}
export const addDays=(s,n)=>new Date((dateNumber(s)+n)*DAY).toISOString().slice(0,10);
export const weekday=s=>(new Date(dateNumber(s)*DAY).getUTCDay()+6)%7;
export const weekStart=s=>addDays(s,-weekday(s));
export function localToday(zone='Asia/Shanghai',instant=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
const int=(n,a,b,label)=>{check(Number.isInteger(n)&&n>=a&&n<=b,`${label}须为 ${a}—${b} 的整数`);return n;};
export function validateConfig(raw){
 check(raw&&typeof raw==='object','缺少计划设置');const c=structuredClone(raw);
 check(['junior','senior_arts'].includes(c.stage),'不支持此学段');int(c.examYear,2026,2100,'考试年度');
 c.grade=c.stage==='junior'?int(c.grade,7,9,'年级'):null;
 check(c.stage!=='senior_arts'||c.combination==='history_geography_politics','当前艺考仅支持史地政组合');
 const days=dateNumber(c.targetDate)-dateNumber(c.startDate);check(days>=0&&days<=730,'目标日期不可早于开始日期，且须在两年内');
 check(Number(c.targetDate.slice(0,4))===c.examYear,'目标日期与考试年度不一致');
 try{new Intl.DateTimeFormat('zh-CN',{timeZone:c.timezone}).format();}catch{throw Error('请选择有效的 IANA 时区');}
 check(typeof c.timezone==='string'&&c.timezone.length<80,'缺少时区');
 check(['gross','net'].includes(c.timeBasis),'须选择时间是否已扣除占用');
 int(c.dailyMinutes,0,720,'每日可用分钟');int(c.offlineMinutes,0,5040,'每周线下分钟');int(c.reservedMinutes,0,5040,'每周其他占用');int(c.sessionMinutes,5,120,'单次任务偏好');
 check(Array.isArray(c.restDays)&&c.restDays.length<=7&&new Set(c.restDays).size===c.restDays.length&&c.restDays.every(n=>Number.isInteger(n)&&n>=0&&n<7),'休息日不正确');
 c.weekdays=c.weekdays??Array(7).fill(c.dailyMinutes);check(Array.isArray(c.weekdays)&&c.weekdays.length===7,'需要周一至周日时间');c.weekdays.forEach(n=>int(n,0,720,'星期可用分钟'));
 c.window=c.window??[480,1320];check(Array.isArray(c.window)&&c.window.length===2,'可安排时段不正确');int(c.window[0],0,1439,'时段起点');int(c.window[1],1,1440,'时段终点');check(c.window[0]<c.window[1],'单日时段必须正向；跨午夜请分为两天');
 c.events=c.events??[];check(Array.isArray(c.events)&&c.events.length<=80,'特殊安排最多 80 条');
 for(const e of c.events){check(dateNumber(e.to)>=dateNumber(e.from),'特殊安排日期逆序');check(['pause','unavailable','offline'].includes(e.kind),'特殊安排类型不正确');check(typeof e.label==='string'&&e.label.length<=120,'安排说明过长');check(Array.isArray(e.weekdays)&&e.weekdays.length>0&&e.weekdays.every(n=>Number.isInteger(n)&&n>=0&&n<7),'特殊安排星期错误');if(e.kind!=='pause'){int(e.start,0,1439,'时段开始');int(e.end,1,1440,'时段结束');check(e.start<e.end,'不可用时段不能跨午夜');}}
 check(c.goal&&typeof c.goal.name==='string'&&c.goal.name.trim().length>0&&c.goal.name.length<=120,'请填写目标考试名称');
 check(Array.isArray(c.goal.subjects)&&c.goal.subjects.length>0&&c.goal.subjects.length<=10,'请选择目标科目');
 check(new Set(c.goal.subjects.map(s=>s.id)).size===c.goal.subjects.length,'目标科目不可重复');
 c.goal.mode=c.goal.mode??'exam';check(['exam','routine'].includes(c.goal.mode),'请选择考试目标或日常学习');
 for(const s of c.goal.subjects){check(Object.hasOwn(NAMES,s.id),'不支持的科目');if(c.goal.mode==='exam'){int(s.max,1,1000,'单科上限');if(s.target!==null)int(s.target,0,s.max,'单科目标');}else check(s.max===null&&s.target===null,'日常学习不设置分值上限或分数目标');}
 if(c.goal.mode==='exam'){
  int(c.goal.max,1,10000,'总分上限');if(c.goal.total!==null)int(c.goal.total,0,c.goal.max,'总分目标');
  check(c.goal.subjects.reduce((n,s)=>n+s.max,0)===c.goal.max,'各科上限之和须等于总分上限');
  if(c.goal.subjects.every(s=>s.target!==null)&&c.goal.total!==null)check(c.goal.subjects.reduce((n,s)=>n+s.target,0)===c.goal.total,'各科目标之和与总目标不一致');
  if(c.stage==='senior_arts'){check(c.goal.max===750&&JSON.stringify(c.goal.subjects.map(s=>s.id).sort())===JSON.stringify([...ARTS].sort()),'艺考史地政方案须六科合计 750');for(const s of c.goal.subjects)check(s.max===(ARTS.indexOf(s.id)<3?150:100),'艺考单科上限不符');}
  else check(typeof c.goal.source==='string'&&c.goal.source.trim().length>=3&&c.goal.source.length<500,'中考/校内考试请填写分值配置来源或注明用户自定义');
 }else{check(c.goal.max===null&&c.goal.total===null,'日常学习不填写总分目标');if(c.stage==='senior_arts')check(c.goal.subjects.every(s=>ARTS.includes(s.id)),'艺考日常安排仅支持已列出的史地政六科');}
 c.manualScores=c.manualScores??[];check(Array.isArray(c.manualScores)&&c.manualScores.length<=12,'自填成绩最多 12 条');
 for(const s of c.manualScores){check(c.goal.subjects.some(x=>x.id===s.subject),'自填成绩科目不属于当前考试');dateNumber(s.date);int(s.max,1,1000,'自填试卷满分');check(Number.isFinite(s.score)&&s.score>=0&&s.score<=s.max,'自填分数超出该试卷满分');check(typeof s.source==='string'&&s.source.trim().length>0&&s.source.length<=300,'须注明自填成绩来源');s.kind='user_entered_mock_raw_not_platform_report';}
 c.reportIds=c.reportIds??[];check(Array.isArray(c.reportIds)&&c.reportIds.length<=40&&new Set(c.reportIds).size===c.reportIds.length&&c.reportIds.every(x=>typeof x==='string'&&x.length<100),'检测报告选择不正确');
 c.reason=String(c.reason??'').trim();check(c.reason.length>=3&&c.reason.length<=1000,'请填写至少 3 字的规划/调整原因');
 return c;
}
const sum=(xs,key)=>xs.reduce((n,x)=>n+(x[key]??0),0);
const total=slots=>slots.reduce((n,[a,b])=>n+b-a,0);
function subtract(slots,[a,b]){return slots.flatMap(([s,e])=>e<=a||s>=b?[[s,e]]:[[s,Math.min(a,e)],[Math.max(s,b),e]].filter(([x,y])=>y>x));}
function take(day,minutes,kind){let left=minutes;const out=[];for(const [a,b] of [...day.free]){if(!left)break;const n=Math.min(b-a,left);out.push([a,a+n]);day.free=subtract(day.free,[a,a+n]);left-=n;}if(kind)day[kind].push(...out);return minutes-left;}
export function calendar(c){
 const days=[],warnings=[];
 for(let d=c.startDate;d<c.targetDate;d=addDays(d,1)){
  const wd=weekday(d),events=c.events.filter(e=>e.from<=d&&e.to>=d&&e.weekdays.includes(wd)),rest=c.restDays.includes(wd),paused=events.some(e=>e.kind==='pause');
  const day={date:d,week:weekStart(d),rest,paused,budget:rest||paused?0:c.weekdays[wd],free:rest||paused?[]:[[...c.window]],offline:[],reserved:[],self:0,items:[]};
  const timed=events.filter(e=>e.kind!=='pause').sort((a,b)=>a.start-b.start);
  for(let i=1;i<timed.length;i++)check(timed[i-1].end<=timed[i].start,`${d} 的固定安排重叠，请合并或修改`);
  for(const e of timed){if(rest||paused){if(e.kind==='offline')warnings.push(`${d} 固定线下安排与休息/暂停冲突，未安排`);continue;}const a=Math.max(c.window[0],e.start),b=Math.min(c.window[1],e.end);if(b>a){day.free=subtract(day.free,[a,b]);day[e.kind==='offline'?'offline':'reserved'].push([a,b]);}else warnings.push(`${d} 固定安排“${e.label}”不在所设可安排窗口内，未计入`);}
  check(c.timeBasis!=='gross'||total(day.offline)+total(day.reserved)<=day.budget,`${d} 固定占用超过当天总预算，请调整预算或固定安排`);
  days.push(day);
 }
 const weeks=[...new Set(days.map(d=>d.week))].map(week=>{
  const ds=days.filter(d=>d.week===week),fraction=ds.length/7,offlineTarget=Math.round(c.offlineMinutes*fraction),reserveTarget=Math.round(c.reservedMinutes*fraction);
  let offLeft=Math.max(0,offlineTarget-ds.reduce((n,d)=>n+total(d.offline),0)),resLeft=Math.max(0,reserveTarget-ds.reduce((n,d)=>n+total(d.reserved),0));
  // Additional weekly totals include fixed events: only the remainder is allocated.
  for(const d of ds){const cap=c.timeBasis==='gross'?Math.max(0,d.budget-total(d.offline)-total(d.reserved)):total(d.free);const n=take(d,Math.min(offLeft,cap),'offline');offLeft-=n;const cap2=c.timeBasis==='gross'?Math.max(0,d.budget-total(d.offline)-total(d.reserved)):total(d.free);resLeft-=take(d,Math.min(resLeft,cap2),'reserved');}
  for(const d of ds){d.self=Math.min(total(d.free),c.timeBasis==='net'?d.budget:Math.max(0,d.budget-total(d.offline)-total(d.reserved)));d.capacity=d.self;d.offlineMinutes=total(d.offline);d.reservedMinutes=total(d.reserved);}
  if(offLeft||resLeft)warnings.push(`${week} 周另有线下 ${offLeft} / 其他占用 ${resLeft} 分钟无法排入；未挤占休息`);
  return {week,days:ds.length,budget:sum(ds,'budget'),self:sum(ds,'self'),offline:sum(ds,'offlineMinutes'),reserved:sum(ds,'reservedMinutes'),restDays:ds.filter(d=>d.rest).length,pauseDays:ds.filter(d=>d.paused).length,unplacedOffline:offLeft,unplacedReserved:resLeft};
 });return {days,weeks,warnings};
}
export function tasksFromReports(reports,config=null){
 const latest=new Map();for(const r of [...reports].sort((a,b)=>a.date.localeCompare(b.date)))for(const p of r.points)latest.set(p.id,{p,r});
 const tasks=[],gaps=[];
 for(const {p,r} of [...latest.values()].sort((a,b)=>(b.p.wrong>0)-(a.p.wrong>0)||a.p.title.localeCompare(b.p.title))){
  const reason=`${localToday(config?.timezone??'Asia/Shanghai',new Date(r.date))} ${r.phase==='retest'?'复测':'检测'}：本点 ${p.sample} 题，${p.wrong} 题答错；${p.wrong?'优先核对必要基础及本次错题':'本次题目答对，仍需间隔复现，不认定完整掌握'}`;
  const sequence=p.wrong?['foundation','learn','practice','review','retest']:['review','practice','retest'];let previous=null;
  for(const [order,type] of sequence.entries()){
   const need=type==='practice'||type==='retest'?type:'learn',available=p.available?.[need];
   const t={id:`${p.id}:${type}`,pointId:p.id,subject:r.subject,title:p.title,type,minutes:type==='learn'?(p.minutes??15):type==='foundation'?10:type==='review'?10:15,estimated:true,reason,evidenceId:r.id,contentVersion:p.version,dependsOn:previous,lagDays:type==='review'?2:type==='retest'?2:0,order:tasks.length,mode:'self',locked:false,status:'planned',notBefore:null,fixedDate:null,available:Boolean(available),gap:available?null:(p.gap||'对应内容建设中或等待本机构审核'),completion:type==='retest'?'提交同范围真实复测；单独查看结果，不以勾选代替':type==='practice'?'实际完成题组并核对；计划勾选不等于掌握':'阅读对应内容，复述关键步骤并记录执行',source:p.source,coverage:p.coverage,uncovered:p.uncovered};
   tasks.push(t);if(!available)gaps.push({taskId:t.id,pointId:p.id,type,reason:t.gap});previous=t.id;
  }
 }
 if(config&&tasks.some(t=>t.available)){
  const source=tasks.find(t=>t.available),today=localToday(config.timezone);
  for(let date=config.startDate;date<config.targetDate;date=addDays(date,1))if(weekday(date)===5&&date>=today){
   const id=`reflection:${date}`;tasks.push({...source,id,type:'reflection',minutes:10,reason:'每周核对所选报告与实际任务执行记录，列出仍需巩固点；没有复测证据不写进步',completion:'回看本周执行/作答与所选报告，记录下一步；不以完成勾选判掌握',dependsOn:null,lagDays:0,order:tasks.length,locked:false,status:'planned',notBefore:date,fixedDate:null,available:true,gap:null});
  }
 }
 return {tasks,gaps};
}
export function schedule(config,tasks,events=[],today=localToday(config.timezone)){
 const c=validateConfig(config),cal=calendar(c),logs=new Map(events.map(e=>[e.taskId,e])),placed=new Map(),unscheduled=[],warnings=[...cal.warnings];
 const entries=structuredClone(tasks).sort((a,b)=>Number(b.locked)-Number(a.locked)||a.order-b.order);
 const validIds=new Set(entries.map(t=>t.id));check(validIds.size===entries.length&&entries.length<=400,'任务重复或数量过多');
 for(const t of entries){int(t.minutes,5,600,'任务预计分钟');check(['self','offline'].includes(t.mode),'任务模式错误');if(t.fixedDate)dateNumber(t.fixedDate);if(t.notBefore)dateNumber(t.notBefore);if(t.deadline)dateNumber(t.deadline);}
 const result=[];
 const allocate=(d,t,n)=>{const slots=t.mode==='offline'?d.offlineFree:d.free;let left=n,parts=[];for(const [a,b]of [...slots]){if(!left)break;const k=Math.min(b-a,left,c.sessionMinutes);if(k<=0)continue;parts.push({date:d.date,start:a,end:a+k,minutes:k});left-=k;if(left&&b-a>k){let x=a+k;while(left&&x<b){const m=Math.min(b-x,left,c.sessionMinutes);parts.push({date:d.date,start:x,end:x+m,minutes:m});x+=m;left-=m;}}}return {left,parts};};
 for(const d of cal.days){d.offlineFree=d.date<today?[]:structuredClone(d.offline);if(d.date<today){d.self=0;d.free=[];}}
 const locked=new Map();
 for(const t of entries.filter(t=>t.locked&&t.allocations?.length&&!['completed','skipped'].includes(logs.get(t.id)?.status))){
  const allocations=t.allocations,valid=allocations.reduce((n,a)=>n+a.minutes,0)===t.minutes&&allocations.every(a=>{const d=cal.days.find(d=>d.date===a.date),slots=t.mode==='offline'?d?.offlineFree:d?.free;return d&&a.date>=today&&(!t.fixedDate||a.date===t.fixedDate)&&(!t.notBefore||a.date>=t.notBefore)&&slots?.some(([s,e])=>s<=a.start&&e>=a.end)&&(t.mode==='offline'||d.self>=allocations.filter(x=>x.date===a.date).reduce((n,x)=>n+x.minutes,0));});
  if(valid){for(const a of allocations){const d=cal.days.find(d=>d.date===a.date);if(t.mode==='offline')d.offlineFree=subtract(d.offlineFree,[a.start,a.end]);else{d.free=subtract(d.free,[a.start,a.end]);d.self-=a.minutes;}}locked.set(t.id,allocations);}else locked.set(t.id,null);
 }
 // Stable topological passes allow locked descendants without bypassing prerequisite order.
 let pending=[...entries];for(let pass=0;pending.length&&pass<=entries.length;pass++){
  const next=[];let progressed=false;
  for(const t of pending){
   const actual=logs.get(t.id);if(actual?.status==='completed'){const x={...t,actual,allocations:t.allocations??[],planningState:'completed_recorded',masteryConfirmed:false};result.push(x);placed.set(t.id,x.allocations.at(-1)?.date??actual.date??today);progressed=true;continue;}
   const skip=actual?.status==='skipped';if(skip||!t.available){unscheduled.push({...t,reason:skip?'用户跳过，保留记录':t.gap||'内容建设中'});progressed=true;continue;}
   if(t.dependsOn&&!placed.has(t.dependsOn)&&pending.some(x=>x.id===t.dependsOn)){next.push(t);continue;}
   if(t.dependsOn&&!placed.has(t.dependsOn)){unscheduled.push({...t,reason:'前置任务尚未安排或被跳过'});progressed=true;continue;}
   const earliest=[c.startDate,today,t.notBefore??c.startDate,t.dependsOn?addDays(placed.get(t.dependsOn),t.lagDays??0):c.startDate].sort().at(-1);
   if(locked.has(t.id)){const allocations=locked.get(t.id);if(!allocations||allocations.some(a=>a.date<earliest)){unscheduled.push({...t,reason:'锁定时段与新时间/前置安排冲突，保留原时间，等待人工处理'});progressed=true;continue;}for(const a of allocations)cal.days.find(d=>d.date===a.date).items.push({taskId:t.id,...a,mode:t.mode});result.push({...t,allocations,planningState:'scheduled',actual:actual??null,masteryConfirmed:false});placed.set(t.id,allocations.at(-1).date);progressed=true;continue;}
   let remaining=t.minutes,allocations=[];
   for(const d of cal.days){if(d.date<earliest||(t.deadline&&d.date>t.deadline)||(t.fixedDate&&d.date!==t.fixedDate))continue;let cap=t.mode==='offline'?total(d.offlineFree):d.self;if(!cap)continue;const part=allocate(d,t,Math.min(cap,remaining));const got=part.parts.reduce((n,p)=>n+p.minutes,0);allocations.push(...part.parts);remaining-=got;if(!remaining)break;}
   if(remaining){unscheduled.push({...t,reason:t.fixedDate?'指定日期容量或前置间隔不满足，固定安排未移动':'剩余可用时间不足或前置间隔无法满足'});progressed=true;continue;}
   for(const a of allocations){const d=cal.days.find(d=>d.date===a.date);if(t.mode==='offline')d.offlineFree=subtract(d.offlineFree,[a.start,a.end]);else{d.free=subtract(d.free,[a.start,a.end]);d.self-=a.minutes;}d.items.push({taskId:t.id,...a,mode:t.mode});}
   const item={...t,allocations,planningState:'scheduled',actual:actual??null,masteryConfirmed:false};result.push(item);placed.set(t.id,allocations.at(-1).date);progressed=true;
  }
  pending=next;if(!progressed)break;
 }
 for(const t of pending)unscheduled.push({...t,reason:'前置顺序无法满足，请调整任务顺序'});
 const weeks=cal.weeks.map(w=>({...w,scheduled:cal.days.filter(d=>d.week===w.week).flatMap(d=>d.items).reduce((n,x)=>n+x.minutes,0),remainingSelf:cal.days.filter(d=>d.week===w.week).reduce((n,d)=>n+d.self,0)}));
 const months=[...new Set(cal.days.map(d=>d.date.slice(0,7)))].map(month=>({month,taskIds:[...new Set(cal.days.filter(d=>d.date.startsWith(month)).flatMap(d=>d.items.map(x=>x.taskId)))],focus:month===c.targetDate.slice(0,7)?'保留复盘与同范围复测；综合练习未有匹配内容时不生成':'先处理有错误证据的内容，再间隔复习与复测'}));
 const needed=tasks.filter(t=>logs.get(t.id)?.status!=='completed'&&logs.get(t.id)?.status!=='skipped').reduce((n,t)=>n+t.minutes,0);
 return {config:c,tasks:result,unscheduled,weeks,months,days:cal.days.map(({date,week,rest,paused,capacity,offlineMinutes,reservedMinutes,items})=>({date,week,rest,paused,selfCapacity:capacity,offlineMinutes,reservedMinutes,items})),summary:{requiredMinutes:needed,selfMinutes:cal.days.filter(d=>d.date>=today).reduce((n,d)=>n+d.capacity,0),offlineMinutes:sum(cal.days.filter(d=>d.date>=today),'offlineMinutes'),scheduledMinutes:sum(weeks,'scheduled'),unscheduledMinutes:sum(unscheduled,'minutes'),completedRecords:events.filter(x=>x.status==='completed').length,masteryImprovement:null},warnings:[...new Set(warnings),'计划仅覆盖所选报告及已有内容，不能证明目标分可达到；预估用时可调整','完成勾选是执行记录，不代表复测掌握。空余时间不是漏排完整课程，也不自动填满','自学/线下可用汇总从今天或开始日中较晚者计算；过去日期不补塞任务']};
}
