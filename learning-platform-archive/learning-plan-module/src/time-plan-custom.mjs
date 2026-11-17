import {dateNumber,addDays,weekday,NAMES,TYPES} from './time-plan-model.mjs';
export function normalizeCustomTasks(config){const list=config.customTasks??[];if(!Array.isArray(list)||list.length>60)throw Error('自定事项最多 60 项');const seen=new Set();
 return list.map((raw,i)=>{const t={id:raw.id,title:raw.title,subject:raw.subject,type:raw.type,minutes:raw.minutes,material:raw.material,completion:raw.completion,from:raw.from,to:raw.to,weekdays:raw.weekdays,repeat:raw.repeat,mode:raw.mode,priority:raw.priority??2};
 if(typeof t.id!=='string'||!/^custom-[a-zA-Z0-9-]{8,80}$/.test(t.id)||seen.has(t.id))throw Error('自定任务标识不正确或重复');seen.add(t.id);
 for(const [key,min,max]of [['title',2,120],['material',1,2000],['completion',3,500]])if(typeof t[key]!=='string'||t[key].trim().length<min||t[key].length>max)throw Error('请填写自定事项、材料说明和完成标准');
 if(!config.goal.subjects.some(s=>s.id===t.subject)||!Object.hasOwn(NAMES,t.subject)||!Object.hasOwn(TYPES,t.type))throw Error('自定任务科目或类型不在当前计划范围');
 if(!Number.isInteger(t.minutes)||t.minutes<5||t.minutes>600||![1,2,3].includes(t.priority)||!['self','offline'].includes(t.mode)||!['once','weekly'].includes(t.repeat))throw Error('自定任务时长、优先级或重复方式不正确');
 dateNumber(t.from);dateNumber(t.to);if(t.from>t.to||dateNumber(t.to)-dateNumber(t.from)>730)throw Error('自定任务日期须正向，跨度不超过两年；计划期外事项会显示未排入');
 if(!Array.isArray(t.weekdays)||t.weekdays.some(n=>!Number.isInteger(n)||n<0||n>6)||new Set(t.weekdays).size!==t.weekdays.length||t.repeat==='weekly'&&!t.weekdays.length)throw Error('请选择重复星期');
 return t;});
}
export function expandCustomTasks(config){const out=[];for(const d of normalizeCustomTasks(config)){const dates=[];if(d.repeat==='once')dates.push(d.from);else for(let day=d.from;day<=d.to;day=addDays(day,1))if(d.weekdays.includes(weekday(day)))dates.push(day);
 for(const date of dates){out.push({id:`${d.id}:${date}`,definitionId:d.id,origin:'custom',priority:d.priority,pointId:d.id,subject:d.subject,title:d.title,type:d.type,minutes:d.minutes,estimated:true,reason:'用户自定学习事项；不是平台检测结论',evidenceId:null,contentVersion:null,dependsOn:null,lagDays:0,order:100+d.priority*100+out.length,mode:d.mode,locked:false,status:'planned',notBefore:date,deadline:d.to,fixedDate:d.repeat==='weekly'?date:null,available:true,gap:null,completion:d.completion,material:d.material,source:'用户自定内容/材料说明，未由平台审核',coverage:[],uncovered:['未建立平台检测/评分证据']});}
 }if(out.length>300)throw Error('重复展开后超过 300 项，请缩短周期或减少重复天数');return out;
}
export const taskLabel=t=>t.origin==='custom'?({foundation:'自定基础学习',learn:'自定学习',practice:'自定练习',review:'自定复习',retest:'自定检查（非平台复测）',reflection:'自定复盘'}[t.type]??TYPES[t.type]):TYPES[t.type];
