import {fail,textField,exactKeys} from './security.mjs';
export const SUBJECTS=['chinese','math','english','history','geography','politics'];
export const MAX_SCORES={chinese:150,math:150,english:150,history:100,geography:100,politics:100};
export const TARGETS={400:[85,70,75,60,55,55],450:[95,80,85,65,62,63],500:[105,90,95,70,70,70],550:[115,100,105,80,75,75]};
export const targetMap=total=>Object.fromEntries(SUBJECTS.map((s,i)=>[s,TARGETS[total]?.[i]??null]));
export function examYear(value){const n=Number(value);if(!Number.isInteger(n)||n<2026||n>2100)fail(400,'INVALID_YEAR','考试年度不正确');return n;}
function date(value,label,nullable=false){if(nullable&&value===null)return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail(400,'INVALID_DATE',`${label}不正确`);return value;}
function integer(n,min,max,label){if(!Number.isInteger(n)||n<min||n>max)fail(400,'INVALID_INPUT',`${label}超出范围`);return n;}
export function validatePlan(b,points=[]){
 if(b.combination!=='history_geography_politics')fail(400,'UNSUPPORTED_COMBINATION','第一期仅支持历史、地理、思想政治组合');
 const total=integer(b.targetTotal,0,750,'目标总分');exactKeys(b.targets,SUBJECTS);exactKeys(b.baseline,SUBJECTS);
 const targets={},baseline={};for(const s of SUBJECTS){targets[s]=integer(b.targets[s],0,MAX_SCORES[s],'单科目标');const n=b.baseline[s];if(n!==null&&(typeof n!=='number'||!Number.isFinite(n)||n<0||n>MAX_SCORES[s]))fail(400,'INVALID_BASELINE','真实基线必须为有效原始分或未覆盖 null');baseline[s]=n;}
 if(Object.values(targets).reduce((a,n)=>a+n,0)!==total)fail(400,'TARGET_SUM_MISMATCH','六科目标之和必须等于总分目标');
 const startDate=date(b.startDate,'开始日期'),examDate=date(b.examDate,'预计考试日期',true),dailyMinutes=integer(b.dailyMinutes,15,600,'每日学习分钟'),restDaysPerWeek=integer(b.restDaysPerWeek,1,4,'每周休息天数'),offlineMinutesPerWeek=integer(b.offlineMinutesPerWeek,0,3600,'每周线下分钟');
 const days=examDate===null?null:Math.ceil((Date.parse(examDate)-Date.parse(startDate))/86400000);if(days!==null&&(days<1||days>730))fail(400,'INVALID_DATE','预计考试日期须晚于开始日期，且在两年内');
 if(examDate!==null&&Number(examDate.slice(0,4))!==examYear(b.examYear))fail(400,'YEAR_MISMATCH','预计考试日期须属于所选考试年度');
 const gross=(7-restDaysPerWeek)*dailyMinutes,reviewMinutes=Math.min(60,Math.round(gross*.1)),bufferMinutes=Math.round(gross*.15),weeklyStudyMinutes=gross-reviewMinutes-bufferMinutes;
 if(offlineMinutesPerWeek>weeklyStudyMinutes)fail(400,'INVALID_TIME_BUDGET','线下时间不能超出扣除休息、复盘和缓冲后的周预算');
 const priorities=b.priorities??[];if(!Array.isArray(priorities)||priorities.length>100)fail(400,'INVALID_PRIORITIES','优先任务格式不正确');const seen=new Set();for(const p of priorities){exactKeys(p,['pointId','priority','reason']);if(!points.some(x=>x.id===p.pointId&&x.applicableYears.includes(examYear(b.examYear)))||seen.has(p.pointId)||!['secure','improve','defer'].includes(p.priority))fail(400,'INVALID_PRIORITIES','优先任务范围或适用年度不正确');seen.add(p.pointId);textField(p.reason,'调整原因',3,500);}
 return {stage:'senior_arts',examYear:examYear(b.examYear),combination:b.combination,targetTotal:total,targets,baseline,baselineScoreType:'raw_mock_score_not_official_rank_score',targetScoreTypes:{geography:'grade_score_target',politics:'grade_score_target'},startDate,examDate,examDateStatus:'user_estimate_not_official_schedule',dailyMinutes,restDaysPerWeek,offlineMinutesPerWeek,priorities,teacherNote:b.teacherNote===undefined?'':textField(b.teacherNote,'指导备注',0,2000),reason:textField(b.reason,'规划或调整原因',3,1000),schedule:{daysRemaining:days,weeklyStudyMinutes,weeklyReviewMinutes:reviewMinutes,weeklyBufferMinutes:bufferMinutes,weeklyOnlineMinutes:weeklyStudyMinutes-offlineMinutesPerWeek},warnings:[...(dailyMinutes>360?['每日超过六小时，请结合疲劳、专业课和学校安排复核']:[]),'目标分配是可调整规划，不是分数线、成绩预测或录取保证','政治、地理模拟原始分不换算为正式等级分']};
}
export function validatePoint(p,original){
 if(!p||typeof p!=='object'||p.id!==original.id||p.subject!==original.subject||!SUBJECTS.includes(p.subject))fail(400,'INVALID_CONTENT','不能改变内容标识或学科');
 textField(p.title,'标题',1,180);if(!Array.isArray(p.applicableYears)||!p.applicableYears.length||p.applicableYears.some(v=>!Number.isInteger(v)||v<2026||v>2100))fail(400,'INVALID_CONTENT','须填写适用年度');
 if(!p.source||p.source.kind!=='original'||typeof p.source.license!=='string'||!p.source.license.trim()||typeof p.source.title!=='string'||!p.source.title.trim())fail(400,'RIGHTS_REQUIRED','当前首批仅允许有来源与许可记录的原创内容');
 for(const k of ['questionType','ability','mastery'])textField(p[k],k,1,2000);
 integer(p.minutes,1,600,'建议投入分钟');
 const strings=(values,label,minimum=1)=>{if(!Array.isArray(values)||values.length<minimum||values.length>100||values.some(v=>typeof v!=='string'||!v.trim()||v.length>3000))fail(400,'INVALID_CONTENT',`${label}须为有效文字清单`);};
 strings(p.prerequisites,'前置基础');strings(p.coverage,'覆盖范围');strings(p.uncovered,'未覆盖范围');
 const h=p.handout;if(!h||typeof h!=='object'||Array.isArray(h))fail(400,'INVALID_CONTENT','需要完整讲义');
 for(const k of ['focus','retestGuide','errorReplay'])textField(h[k],k,1,4000);strings(h.steps,'解题步骤');strings(h.pitfalls,'易错点');
 if(!h.workedExample||!h.memoryCard)fail(400,'INVALID_CONTENT','讲义需要典型例题和记背卡');
 for(const k of ['prompt','answer','explanation'])textField(h.workedExample[k],k,1,4000);
 for(const k of ['front','back'])textField(h.memoryCard[k],k,1,2000);
 if(!Array.isArray(h.exercises)||h.exercises.length<2||h.exercises.length>30)fail(400,'INVALID_CONTENT','讲义需要至少两道分层练习及解析');
 for(const x of h.exercises)for(const k of ['level','prompt','answer','explanation'])textField(x?.[k],k,1,4000);
 if(!Array.isArray(p.questions)||p.questions.length!==3)fail(400,'INVALID_CONTENT','当前题组须包含筛查、练习和复测各一题');
 const phases=new Set(),ids=new Set();for(const q of p.questions){if(!q||!['diagnostic','practice','retest'].includes(q.phase)||phases.has(q.phase)||ids.has(q.id))fail(400,'INVALID_CONTENT','题目阶段或标识重复');phases.add(q.phase);ids.add(q.id);textField(q.id,'题号',1,160);textField(q.prompt,'题干',1,4000);textField(q.rationale,'解析',1,4000);if(!Array.isArray(q.options)||q.options.length<2||q.options.length>6||q.options.some(x=>typeof x!=='string'||!x.trim()||x.length>2000)||new Set(q.options.map(x=>x.trim())).size!==q.options.length||!Number.isInteger(q.correctOption)||q.correctOption<0||q.correctOption>=q.options.length||!['超低','低','中等','高','超高'].includes(q.difficulty)||q.maxScore!==1)fail(400,'INVALID_CONTENT','选项、答案、难度或练习计分格式不正确');}
 return Object.fromEntries(['id','subject','title','version','applicableYears','questionType','ability','minutes','mastery','coverage','uncovered','source','prerequisites','handout','questions'].map(k=>[k,p[k]]));
}
