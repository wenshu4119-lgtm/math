import {fail,id,jsonBody,now,requireRole,textField} from './security.mjs';
import {planGuard,planAccess,planReports,planInventory,reportWarnings,evidenceStamp,evidenceStampQuery} from './time-plan-reports.mjs';
import {validateConfig,tasksFromReports,schedule,localToday,ARTS} from './time-plan-model.mjs';
import {learningRoutes} from './learning.mjs';
import {artsRoutes} from './arts.mjs';
const rows=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
const hash=async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v))))].map(x=>x.toString(16).padStart(2,'0')).join('');
const domain=fn=>{try{return fn();}catch(e){fail(400,'INVALID_PLAN',e.message);}};
const scopeOf=c=>({stage:c.stage,grade:c.grade,examYear:c.examYear});
const eventsFor=async(db,p)=>{const es=await rows(db,'SELECT id,task_id AS taskId,status,minutes,local_date AS date,note,actor_id AS actorId,created_at AS createdAt FROM time_plan_events WHERE plan_id=? ORDER BY rowid',p);return {all:es,latest:[...new Map(es.map(e=>[e.taskId,e])).values()]};};
async function getPlan(db,u,pid){const p=await db.prepare('SELECT * FROM time_plans WHERE id=? AND org_id=?').bind(pid,u.org_id).first();if(!p)fail(404,'NOT_FOUND','计划不存在或无权访问');await planAccess(db,u,p.student_id);return p;}
async function view(db,u,p){const events=await eventsFor(db,p.id),value=JSON.parse(p.payload_json);await planAccess(db,u,p.student_id);return {id:p.id,studentId:p.student_id,version:p.version,createdAt:p.created_at,updatedAt:p.updated_at,...value,events:events.all,actual:events.latest,notice:'任务计划、执行记录、检测证据分别保存；家长调整计划不改变学生作答'};}
function assertVersion(b,p){if(!Number.isInteger(b.expectedVersion)||b.expectedVersion!==p.version)fail(409,'PLAN_VERSION_CONFLICT','计划已由另一页面修改，请重新加载后再调整');}
function validateEdits(tasks,edits,logs){if(!Array.isArray(edits)||edits.length>400)fail(400,'INVALID_PLAN','任务修改数量不正确');const seen=new Set();for(const e of edits){if(!e||Object.keys(e).some(k=>!['id','minutes','order','mode','locked','fixedDate','notBefore'].includes(k))||seen.has(e.id))fail(400,'INVALID_PLAN','任务修改字段不正确');seen.add(e.id);const t=tasks.find(t=>t.id===e.id);if(!t)fail(400,'INVALID_PLAN','任务不属于所选检测内容');if(logs.some(l=>l.taskId===t.id&&l.status==='completed'))fail(409,'TASK_COMPLETED','已完成任务保留历史，不改写原安排');if(e.order!==undefined&&(!Number.isInteger(e.order)||e.order<0||e.order>1000))fail(400,'INVALID_PLAN','顺序不正确');if(e.locked!==undefined&&typeof e.locked!=='boolean')fail(400,'INVALID_PLAN','锁定值不正确');if(e.fixedDate!==undefined&&e.fixedDate!==t.fixedDate||e.minutes!==undefined&&e.minutes!==t.minutes||e.mode!==undefined&&e.mode!==t.mode)delete t.allocations;Object.assign(t,e);if(t.locked&&!t.fixedDate)fail(400,'INVALID_PLAN','锁定任务必须指定日期');}return tasks;}
export async function timePlanRoutes(request,env,path,u,url){
 if(!path.startsWith('/time-plans'))return null;requireRole(u,'student','parent','teacher');const db=env.DB,method=request.method;
 if(path==='/time-plans/context'&&method==='GET'){
  const s=textField(url.searchParams.get('studentId'),'学生'),stage=url.searchParams.get('stage'),examYear=Number(url.searchParams.get('examYear')),grade=stage==='junior'?Number(url.searchParams.get('grade')):null;
  if(!['junior','senior_arts'].includes(stage)||!Number.isInteger(examYear)||examYear<2026||examYear>2100||(stage==='junior'&&![7,8,9].includes(grade)))fail(400,'INVALID_SCOPE','学段、年级或年度不正确');
  const scope={stage,examYear,grade},reports=await planReports(db,u,s,scope),inventory=await planInventory(db,u,scope),plans=await rows(db,'SELECT id,version,stage,exam_year AS examYear,grade,updated_at AS updatedAt FROM time_plans WHERE org_id=? AND student_id=? AND stage=? AND exam_year=? AND grade IS ? ORDER BY updated_at DESC',u.org_id,s,stage,examYear,grade);
  const latest=new Map();for(const r of reports)if(r.valid&&!latest.has(r.subject))latest.set(r.subject,r.id);await planAccess(db,u,s);
  return {data:{reports,defaultReportIds:[...latest.values()],inventory,plans,scope,limits:{reportLimit:200,ocrUsed:false,bankPracticeReports:false,unpublishedStudyModule:false},notice:'报告最多最近200条；默认每科最近有效检测/复测，未测不等于不会'}};
 }
 if(path==='/time-plans/preview'&&method==='POST'){
  const b=await jsonBody(request,['studentId','planId','expectedVersion','config','taskEdits','restoreVersion']),s=textField(b.studentId,'学生');await planAccess(db,u,s);
  const old=b.planId?await getPlan(db,u,textField(b.planId,'计划')):null;if(old){if(old.student_id!==s)fail(404,'NOT_FOUND','学生不匹配');assertVersion(b,old);}
  let restored=null;if(b.restoreVersion!==undefined){if(!old||!Number.isInteger(b.restoreVersion))fail(400,'INVALID_PLAN','恢复版本不正确');const row=await db.prepare('SELECT payload_json FROM time_plan_versions WHERE plan_id=? AND version=?').bind(old.id,b.restoreVersion).first();if(!row)fail(404,'NOT_FOUND','历史版本不存在');restored=JSON.parse(row.payload_json);}
  const config=domain(()=>validateConfig(restored?{...restored.config,reason:textField(b.config?.reason,'恢复原因',3,1000)}:b.config));
  if(old&&(config.stage!==old.stage||config.examYear!==old.exam_year||config.grade!==old.grade))fail(400,'SCOPE_CHANGED','不能把已有计划换成其他学段、年级或年度，请创建独立计划');
  const stamp=await evidenceStamp(db,u,s),all=await planReports(db,u,s,scopeOf(config)),selected=config.reportIds.map(id=>{const r=all.find(x=>x.id===id);if(!r)fail(400,'REPORT_SCOPE_MISMATCH','报告不存在或不属于当前学生/范围');if(!config.goal.subjects.some(x=>x.id===r.subject))fail(400,'REPORT_SCOPE_MISMATCH','报告学科不属于目标科目');return r;});
  const previous=old?JSON.parse(old.payload_json):null,log=old?(await eventsFor(db,old.id)).latest:[],generated=tasksFromReports(selected,config),base=previous?.allTasks??[];
  let tasks=generated.tasks.map(t=>{const was=(restored?.allTasks??base).find(x=>x.id===t.id);return was?{...t,minutes:was.minutes,order:was.order,mode:was.mode,locked:was.locked,fixedDate:was.fixedDate,notBefore:was.notBefore}:t;});
  for(const t of base)if(t.locked||log.some(e=>e.taskId===t.id&&e.status==='completed')){const i=tasks.findIndex(x=>x.id===t.id);if(i>=0)tasks[i]=t;else tasks.push(t);}
  tasks=validateEdits(tasks,b.taskEdits??[],log);
  const output=domain(()=>schedule(config,tasks,log));
  const changes=tasks.map(t=>{const old=base.find(x=>x.id===t.id),newDates=output.tasks.find(x=>x.id===t.id)?.allocations??[],oldDates=previous?.schedule?.tasks?.find(x=>x.id===t.id)?.allocations??[];return {taskId:t.id,title:t.title,change:!old?'新增':JSON.stringify(old)!==JSON.stringify(t)||JSON.stringify(oldDates)!==JSON.stringify(newDates)?'调整':'保留',reason:t.reason,previous:oldDates,next:newDates};});
  for(const t of base)if(!tasks.some(x=>x.id===t.id))changes.push({taskId:t.id,title:t.title,change:'移出剩余计划',reason:'新的报告范围/证据调整；历史和实际记录保留'});
  // Keep old completed/locked task source summaries as well as the newly selected evidence.
  const retained=(previous?.reports??[]).filter(r=>tasks.some(t=>t.evidenceId===r.id)&&!selected.some(x=>x.id===r.id));
  const comparisons=selected.filter(r=>r.phase==='retest').map(r=>{const before=(previous?.reports??all).find(x=>x.attemptId===r.diagnosticId&&x.phase==='diagnostic');const same=Boolean(before&&before.points.length===r.points.length&&before.points.every(p=>r.points.some(q=>q.id===p.id&&q.version===p.version&&q.sample===p.sample&&JSON.stringify(q.coverage)===JSON.stringify(p.coverage))));return {subject:r.subject,before:before?{id:before.id,correct:before.correct,sample:before.sample,date:before.date}:null,after:{id:r.id,correct:r.correct,sample:r.sample,date:r.date},sameScope:same,comparable:false,reason:same?'范围、版本与样本数相同；尚未独立校准等难度/耗时，只展示实际答题变化，不外推考试提分':'范围、版本、样本量不同或前测缺失，不作掌握进步判断'};});
  const value={config,comparisons,allTasks:tasks.map(t=>({...t,allocations:output.tasks.find(x=>x.id===t.id)?.allocations??t.allocations??[]})),reports:[...selected,...retained],schedule:output,gaps:generated.gaps,warnings:reportWarnings(config,selected,localToday(config.timezone)),changes,reason:config.reason,algorithm:'evidence-time-v1',createdAt:now()};
  if(stamp!==await evidenceStamp(db,u,s))fail(409,'EVIDENCE_CHANGED','读取期间检测/内容发生变化，请重新预览');
  const previewId=id(),g=planGuard(u,s),expires=Date.now()+20*60000,evidenceHash=await hash({all,stamp});
  const result=await db.prepare(`INSERT INTO time_plan_previews SELECT ?,?,?,?,?,?,?,?,?,0,? WHERE ${g.sql} ${old?'AND EXISTS(SELECT 1 FROM time_plans WHERE id=? AND version=?)':''}`).bind(previewId,u.org_id,s,u.id,old?.id??null,old?.version??0,JSON.stringify(value),evidenceHash,expires,now(),...g.args,...(old?[old.id,old.version]:[])).run();
  if(!result.meta.changes)fail(409,'PLAN_VERSION_CONFLICT','权限或计划已变化，请重新生成预览');return {data:{previewId,expiresAt:expires,baseVersion:old?.version??0,...value}};
 }
 if(path==='/time-plans/commit'&&method==='POST'){
  const b=await jsonBody(request,['previewId','confirmed']),preview=await db.prepare('SELECT * FROM time_plan_previews WHERE id=? AND org_id=? AND actor_id=?').bind(textField(b.previewId,'预览'),u.org_id,u.id).first();
  if(!preview)fail(404,'NOT_FOUND','预览不存在或无权访问');if(b.confirmed!==true||preview.consumed||preview.expires_at<Date.now())fail(409,'PREVIEW_EXPIRED','预览已使用/过期或尚未确认');
  const value=JSON.parse(preview.payload_json),g=await planAccess(db,u,preview.student_id),stamp=await evidenceStamp(db,u,preview.student_id),all=await planReports(db,u,preview.student_id,scopeOf(value.config));if(await hash({all,stamp})!==preview.evidence_hash)fail(409,'EVIDENCE_CHANGED','检测或内容版本已变化，请查看新预览');
  const stampQuery=evidenceStampQuery(u.org_id,preview.student_id);
  const pid=preview.plan_id??id(),version=preview.base_version+1,at=now(),guard=`${g.sql} AND (${stampQuery.sql})=? AND EXISTS(SELECT 1 FROM time_plan_previews WHERE id=? AND consumed=0 AND expires_at>?)`,args=[...g.args,...stampQuery.args,stamp,preview.id,Date.now()];
  const statement=preview.plan_id?db.prepare(`UPDATE time_plans SET version=version+1,payload_json=?,updated_at=? WHERE id=? AND version=? AND ${guard}`).bind(preview.payload_json,at,pid,preview.base_version,...args):db.prepare(`INSERT INTO time_plans SELECT ?,?,?,?,?,?,1,?,?,?,? WHERE ${guard}`).bind(pid,u.org_id,preview.student_id,value.config.stage,value.config.examYear,value.config.grade,preview.payload_json,u.id,at,at,...args);
  const result=await db.batch([statement,db.prepare('INSERT INTO time_plan_versions SELECT id,version,payload_json,?,?,? FROM time_plans WHERE id=? AND version=? AND changes()=1').bind(value.reason,u.id,at,pid,version),db.prepare('UPDATE time_plan_previews SET consumed=1 WHERE id=? AND changes()=1').bind(preview.id),db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),u.org_id,u.id,'time_plan_committed',pid,at)]);
  if(!result[0].meta.changes)fail(409,'PLAN_VERSION_CONFLICT','计划、授权或预览已改变；旧请求没有覆盖新版本');return {status:201,data:await view(db,u,await getPlan(db,u,pid))};
 }
 let m=path.match(/^\/time-plans\/([\w-]+)(?:\/(history|events|export|content|action))?$/);if(!m)return null;
 const p=await getPlan(db,u,m[1]),value=JSON.parse(p.payload_json);
 if(!m[2]&&method==='GET')return {data:await view(db,u,p)};
 if(m[2]==='history'&&method==='GET'){const history=await rows(db,'SELECT version,reason,created_at AS createdAt FROM time_plan_versions WHERE plan_id=? ORDER BY version DESC',p.id);await planAccess(db,u,p.student_id);return {data:history};}
 if(m[2]==='events'&&method==='POST'){
  const b=await jsonBody(request,['expectedVersion','requestId','taskId','status','minutes','date','note']);assertVersion(b,p);const task=value.allTasks.find(t=>t.id===b.taskId);if(!task)fail(400,'INVALID_TASK','任务不属于此计划');if(!['started','completed','skipped','reopened'].includes(b.status)||!Number.isInteger(b.minutes)||b.minutes<0||b.minutes>1440)fail(400,'INVALID_TASK','状态或实际时长不正确');domain(()=>{const c={...value.config,startDate:b.date,targetDate:b.date,examYear:Number(String(b.date).slice(0,4))};validateConfig(c);});
  const req=textField(b.requestId,'请求标识',8,100),exists=await db.prepare('SELECT id FROM time_plan_events WHERE plan_id=? AND request_id=?').bind(p.id,req).first();if(exists)return {data:await view(db,u,p)};
  const g=planGuard(u,p.student_id),event=id(),at=now();const result=await db.batch([db.prepare(`UPDATE time_plans SET version=version+1,updated_at=? WHERE id=? AND version=? AND ${g.sql}`).bind(at,p.id,p.version,...g.args),db.prepare('INSERT INTO time_plan_events SELECT ?,?,?,?,?,?,?,?,?,? WHERE changes()=1').bind(event,p.id,b.taskId,b.status,b.minutes,b.date,textField(b.note??'','执行说明',0,500),u.id,at,req),db.prepare('INSERT INTO time_plan_versions SELECT id,version,payload_json,?,?,? FROM time_plans WHERE id=? AND version=? AND changes()=1').bind('记录执行；不是掌握结论',u.id,at,p.id,p.version+1)]);
  if(!result[0].meta.changes)fail(409,'PLAN_VERSION_CONFLICT','计划或授权已变化，执行记录未覆盖');return {data:await view(db,u,await getPlan(db,u,p.id))};
 }
 if(m[2]==='export'&&method==='GET'){
  const range=url.searchParams.get('range')??'all',date=url.searchParams.get('date');if(!['all','week','day'].includes(range)||(range!=='all'&&!/^\d{4}-\d{2}-\d{2}$/.test(date??'')))fail(400,'INVALID_PLAN','导出范围不正确');const out=await view(db,u,p);const days=out.schedule.days.filter(d=>range==='all'||range==='week'&&d.week===date||range==='day'&&d.date===date);return {data:{...out,exportDays:days,exportRange:range,exportDate:date}};
 }
 if(['content','action'].includes(m[2])){
  const b=method==='POST'?await jsonBody(request,['taskId']):{taskId:url.searchParams.get('taskId')},t=value.allTasks.find(t=>t.id===b.taskId);if(!t)fail(404,'NOT_FOUND','任务不存在');const report=value.reports.find(r=>r.id===t.evidenceId);if(!report)fail(409,'CONTENT_UNAVAILABLE','关联报告待补充');
  const current=await planReports(db,u,p.student_id,scopeOf(value.config)),r=current.find(r=>r.id===report.id),point=r?.points.find(x=>x.id===t.pointId);if(!r?.valid||!point||point.version!==t.contentVersion)fail(409,'CONTENT_UNAVAILABLE','关联内容版本已变化或审核不可用，请重新预览');
  if(m[2]==='content'&&method==='GET'){
   let material;if(value.config.stage==='junior'){const k=await db.prepare('SELECT id,title,explanation,memory_card AS memoryCard,source,version FROM knowledge WHERE id=? AND version=?').bind(t.pointId,t.contentVersion).first();material={...k,kind:'short_explanation_not_full_handout'};}else{const c=await db.prepare('SELECT payload_json FROM arts_content_versions WHERE org_id=? AND point_id=? AND version=?').bind(u.org_id,t.pointId,t.contentVersion).first();const x=JSON.parse(c.payload_json);material={id:x.id,title:x.title,handout:x.handout,coverage:x.coverage,uncovered:x.uncovered,source:x.source,version:x.version};}
   await planAccess(db,u,p.student_id);return {data:{task:t,material,report:r,canAnswer:u.role!=='parent',notice:'具体内容来自现有版本；家长只读学习材料，不提供未作答题答案'}};
  }
  if(m[2]==='action'&&method==='POST'){
   requireRole(u,'student','teacher');if(!['practice','retest'].includes(t.type))fail(400,'INVALID_TASK','此任务请打开学习内容');
   const invoke=async(route,method='GET',body)=>{const rr=new Request(new URL('/api/v1'+route,request.url),{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return value.config.stage==='junior'?learningRoutes(rr,env,route,u,new URL(rr.url)):artsRoutes(rr,env,route,u,new URL(rr.url));};
   let answer;if(value.config.stage==='junior'){
    const pack=await invoke('/packs','POST',{diagnosticId:r.diagnosticId});const existing=await db.prepare('SELECT id FROM attempts WHERE pack_id=? AND phase=?').bind(pack.data.id,t.type).first();answer=existing?await invoke('/attempts/'+existing.id):await invoke('/attempts','POST',{studentId:p.student_id,subject:r.subject,phase:t.type,packId:pack.data.id});
   }else{const existing=await db.prepare('SELECT id FROM arts_attempts WHERE diagnostic_id=? AND phase=?').bind(r.diagnosticId,t.type).first();answer=existing?await invoke('/arts/attempts/'+existing.id):await invoke('/arts/attempts','POST',{planId:r.planId,pointId:t.pointId,phase:t.type,diagnosticId:r.diagnosticId});}
   await planAccess(db,u,p.student_id);return {data:{stage:value.config.stage,attempt:answer.data,notice:'复用原检测/练习流程；教师审核、范围和阶段门禁保持不变'}};
  }
 }
 return null;
}

