import { allowStudent,audit,fail,id,jsonBody,now,requireRole,textField } from './security.mjs';
import { paperSummaries } from './papers.mjs';
import { homeworkSummaries } from './homeworks.mjs';
import {scopeFromItems,scopesForAttempts} from './assessment-scope.mjs';

const rows=async(db,sql,...params)=>(await db.prepare(sql).bind(...params).all()).results;
const parse=JSON.parse;
const reviewTeacherGuard="EXISTS (SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=? AND u.org_id=? AND u.role='teacher' AND u.active=1 AND u.must_change_password=0 AND s.token_hash=? AND s.expires_at>?)";
const reviewTeacherArgs=user=>[user.id,user.org_id,user.token_hash,Date.now()];
async function currentReviewTeacher(db,user){if(!await db.prepare(`SELECT 1 AS ok WHERE ${reviewTeacherGuard}`).bind(...reviewTeacherArgs(user)).first())fail(404,'NOT_FOUND','教师权限或会话已改变');}
const teachingLink="EXISTS (SELECT 1 FROM relationships r JOIN users t ON t.id=r.adult_id JOIN users s ON s.id=r.student_id WHERE r.adult_id=? AND r.student_id=packs.student_id AND r.org_id=packs.org_id AND r.kind='teacher' AND t.org_id=packs.org_id AND s.org_id=packs.org_id AND t.role='teacher' AND s.role='student' AND t.active=1 AND s.active=1)";
const byId=(values,key='id')=>new Map(values.map(v=>[v[key],v]));
function subject(value) { if(!['math','english'].includes(value)) fail(400,'INVALID_SUBJECT','仅支持 math 或 english'); return value; }
async function approvedTopics(db,org,sub) {
  return rows(db,'SELECT k.* FROM knowledge k JOIN content_reviews r ON r.knowledge_id=k.id AND r.version=k.version AND r.org_id=? WHERE k.subject=? ORDER BY k.id',org,sub);
}
function materials(topics) {return topics.map(t=>({id:t.id,title:t.title,explanation:t.explanation,memoryCard:t.memory_card,version:t.version,isExample:true}));}
async function getAttempt(db,user,env,attemptId) {
  const a=await db.prepare('SELECT * FROM attempts WHERE id=? AND org_id=?').bind(attemptId,user.org_id).first();
  if(!a) fail(404,'NOT_FOUND','测评不存在');
  await allowStudent(env,user,a.student_id); return a;
}
async function getPack(db,user,env,packId) {
  const p=await db.prepare('SELECT * FROM packs WHERE id=? AND org_id=?').bind(packId,user.org_id).first();
  if(!p) fail(404,'NOT_FOUND','学习包不存在');
  await allowStudent(env,user,p.student_id);return p;
}
async function attemptView(db,a) {
  const items=await rows(db,'SELECT i.*,a.selected_option,a.is_correct FROM attempt_items i LEFT JOIN answers a ON a.attempt_id=i.attempt_id AND a.question_id=i.question_id WHERE i.attempt_id=? ORDER BY i.position',a.id);
  return {id:a.id,studentId:a.student_id,subject:a.subject,phase:a.phase,packId:a.pack_id,status:a.status,source:a.source,submittedAt:a.submitted_at,
    result:a.status==='submitted'?{correct:a.correct,total:a.total}:null,scope:scopeFromItems(items),
    questions:items.map(i=>{const q=parse(i.snapshot_json);return {id:i.question_id,knowledgeId:i.knowledge_id,prompt:q.prompt,options:q.options,isExample:true,
      ...(a.status==='submitted'?{selectedOption:i.selected_option,correctOption:q.correctOption,isCorrect:Boolean(i.is_correct),rationale:q.rationale}:{})};})};
}
function packView(p) {return {id:p.id,studentId:p.student_id,diagnosticId:p.diagnostic_id,subject:p.subject,status:p.status,revision:p.revision,knowledgeIds:parse(p.knowledge_ids_json),weakKnowledgeIds:parse(p.weak_ids_json),materials:parse(p.material_json),teacherNote:p.teacher_note,reviewedBy:p.reviewed_by,reviewedAt:p.reviewed_at,algorithm:p.algorithm,isExample:true};}

function progressView(a,scope){return a?{id:a.id,subject:a.subject,phase:a.phase,packId:a.pack_id,status:a.status,source:a.source,submittedAt:a.submitted_at,result:a.status==='submitted'?{correct:a.correct,total:a.total}:null,scope}:null;}
async function packActivity(env,user,packId){
  const p=await getPack(env.DB,user,env,packId);
  const attempts=await rows(env.DB,"SELECT * FROM attempts WHERE pack_id=? AND org_id=? AND student_id=? AND phase IN ('practice','retest')",p.id,user.org_id,p.student_id),scopes=await scopesForAttempts(env.DB,attempts);
  const activity=phase=>{const a=attempts.find(x=>x.phase===phase);return a?progressView(a,scopes.get(a.id)):null;};
  return {pack:packView(p),practice:activity('practice'),retest:activity('retest')};
}

export async function learningRoutes(request,env,path,user,url) {
  const db=env.DB,method=request.method;
  const cyclePath=path.match(/^\/students\/([^/]+)\/learning-cycle$/);
  if(cyclePath&&method==='GET'){
    requireRole(user,'student','teacher');await allowStudent(env,user,cyclePath[1]);const sub=subject(url.searchParams.get('subject'));
    const diagnostic=await db.prepare("SELECT * FROM attempts WHERE student_id=? AND org_id=? AND subject=? AND phase='diagnostic' ORDER BY created_at DESC,rowid DESC LIMIT 1").bind(cyclePath[1],user.org_id,sub).first();
    if(!diagnostic)return {data:{diagnostic:null,pack:null,practice:null,retest:null}};
    const scopes=await scopesForAttempts(db,[diagnostic]),p=await db.prepare('SELECT id FROM packs WHERE diagnostic_id=? AND org_id=? AND student_id=?').bind(diagnostic.id,user.org_id,cyclePath[1]).first();
    return {data:{diagnostic:progressView(diagnostic,scopes.get(diagnostic.id)),...(p?await packActivity(env,user,p.id):{pack:null,practice:null,retest:null})}};
  }
  const activityPath=path.match(/^\/packs\/([^/]+)\/activity$/);
  if(activityPath&&method==='GET'){requireRole(user,'student','teacher');return {data:await packActivity(env,user,activityPath[1])};}
  if(path==='/knowledge' && method==='GET') {
    const sub=subject(url.searchParams.get('subject'));
    const data=await rows(db,'SELECT k.id,k.title,k.subject,k.version,CASE WHEN r.knowledge_id IS NULL THEN 0 ELSE 1 END AS reviewed FROM knowledge k LEFT JOIN content_reviews r ON r.knowledge_id=k.id AND r.version=k.version AND r.org_id=? WHERE k.subject=? ORDER BY k.id',user.org_id,sub);
    return {data:data.map(t=>({...t,isExample:true,reviewStatus:t.reviewed?'human_reviewed':'pending_human'}))};
  }
  if(path==='/content/review-queue' && method==='GET') {
    requireRole(user,'teacher');
    const ts=await rows(db,'SELECT k.*,r.reviewed_by,r.reviewed_at FROM knowledge k LEFT JOIN content_reviews r ON r.knowledge_id=k.id AND r.version=k.version AND r.org_id=? ORDER BY k.id',user.org_id);
    for(const t of ts) {
      t.questions=(await rows(db,'SELECT * FROM questions WHERE knowledge_id=? ORDER BY phase',t.id)).map(q=>({id:q.id,phase:q.phase,prompt:q.prompt,options:parse(q.options_json),correctOption:q.correct_option,rationale:q.rationale,automatedCheck:q.verification}));
      t.reviewStatus=t.reviewed_by?'human_reviewed':'pending_human';
    }
    await currentReviewTeacher(db,user);
    return {data:ts};
  }
  let match=path.match(/^\/content\/([^/]+)\/review$/);
  if(match && method==='POST') {
    requireRole(user,'teacher');
    const b=await jsonBody(request,['version','confirmed']);
    if(b.confirmed!==true || !Number.isInteger(b.version)) fail(400,'REVIEW_REQUIRED','需要明确确认已核对讲解、记背卡、题干、选项、答案和解析');
    const t=await db.prepare('SELECT * FROM knowledge WHERE id=? AND version=?').bind(match[1],b.version).first();
    if(!t) fail(409,'VERSION_CONFLICT','内容版本已变化');
    const reviewedAt=now();
    const committed=await db.batch([
      db.prepare(`INSERT INTO content_reviews SELECT ?,?,?,?,? WHERE ${reviewTeacherGuard} AND EXISTS(SELECT 1 FROM knowledge WHERE id=? AND version=?)`).bind(user.org_id,t.id,t.version,user.id,reviewedAt,...reviewTeacherArgs(user),t.id,t.version),
      db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),user.org_id,user.id,'content_reviewed',t.id,reviewedAt)
    ]);
    if(!committed[0].meta.changes)fail(409,'VERSION_CONFLICT','内容版本或教师权限已改变，请重新加载');
    await currentReviewTeacher(db,user);
    return {data:{id:t.id,version:t.version,reviewStatus:'human_reviewed'}};
  }
  if(path==='/attempts' && method==='GET') {
    const studentId=textField(url.searchParams.get('studentId'),'学生');await allowStudent(env,user,studentId);
    const attempts=await rows(db,'SELECT id,subject,phase,pack_id AS packId,status,created_at AS createdAt FROM attempts WHERE student_id=? AND org_id=? ORDER BY created_at DESC LIMIT 100',studentId,user.org_id),scopes=await scopesForAttempts(db,attempts);
    return {data:attempts.map(a=>({...a,scope:scopes.get(a.id)}))};
  }
  if(path==='/attempts' && method==='POST') {
    requireRole(user,'student','teacher');
    const b=await jsonBody(request,['studentId','subject','phase','packId','knowledgeIds']);
    const studentId=textField(b.studentId,'学生'); await allowStudent(env,user,studentId);
    const sub=subject(b.subject),phase=b.phase;
    if(!['diagnostic','practice','retest'].includes(phase)) fail(400,'INVALID_PHASE','测评类型不正确');
    let ts=await approvedTopics(db,user.org_id,sub),pack=null,scopeMode='pack_topics';
    if(phase==='diagnostic') {
      if(b.packId) fail(400,'INVALID_INPUT','筛查不关联学习包');
      const known=await rows(db,'SELECT id FROM knowledge WHERE subject=?',sub);
      if(b.knowledgeIds!==undefined){
        const ids=b.knowledgeIds;
        if(!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(x=>typeof x!=='string'||!x||x.length>200)||new Set(ids).size!==ids.length||ids.some(x=>!known.some(k=>k.id===x)))fail(400,'INVALID_SCOPE','请选择1–20个不重复的当前科目知识点');
        ts=ts.filter(t=>ids.includes(t.id));if(ts.length!==ids.length)fail(409,'CONTENT_NOT_REVIEWED','所选知识点尚未全部经本机构教师人工审核');scopeMode='selected_topics';
      }else{if(ts.length!==known.length||!ts.length)fail(409,'CONTENT_NOT_REVIEWED','本科目示例内容尚未全部经教师人工审核');scopeMode='subject_examples';}
    } else {
      if(b.knowledgeIds!==undefined)fail(400,'INVALID_SCOPE','练习和复测范围由已审核学习包决定，不能另传知识点');
      pack=await getPack(db,user,env,textField(b.packId,'学习包'));
      if(pack.subject!==sub || pack.student_id!==studentId) fail(400,'PACK_MISMATCH','学习包与学生或科目不一致');
      if((phase==='practice' && pack.status!=='approved') || (phase==='retest' && pack.status!=='in_progress')) fail(409,'PACK_NOT_READY','学习包尚未审核、正在学习或已完成');
      if(phase==='retest' && !await db.prepare("SELECT id FROM attempts WHERE pack_id=? AND phase='practice' AND status='submitted'").bind(pack.id).first()) fail(409,'PRACTICE_REQUIRED','先完成学习包练习，再进行复测');
      const selected=parse(pack.knowledge_ids_json); ts=ts.filter(t=>selected.includes(t.id));
      if(ts.length!==selected.length) fail(409,'CONTENT_NOT_REVIEWED','学习包内容尚未审核');
      const snapshots=parse(pack.material_json);
      if(ts.some(t=>snapshots.find(s=>s.id===t.id)?.version!==t.version))fail(409,'CONTENT_VERSION_CHANGED','课程版本已变化，请老师重新审核学习包');
    }
    const allQ=await rows(db,'SELECT q.* FROM questions q JOIN knowledge k ON k.id=q.knowledge_id WHERE k.subject=? AND q.phase=? ORDER BY q.id',sub,phase);
    const selected=allQ.filter(q=>ts.some(t=>t.id===q.knowledge_id));
    if(selected.length!==ts.length) fail(409,'CONTENT_INCOMPLETE','没有完整的已审核样题');
    const aid=id(),statements=[];
    if(pack && phase==='practice') statements.push(db.prepare("UPDATE packs SET status='in_progress' WHERE id=? AND revision=? AND status='approved'").bind(pack.id,pack.revision));
    const base='INSERT INTO attempts (id,org_id,student_id,subject,phase,pack_id,created_by,created_at)';
    statements.push(pack
      ?db.prepare(`${base} SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM packs WHERE id=? AND revision=? AND status='in_progress')`).bind(aid,user.org_id,studentId,sub,phase,pack.id,user.id,now(),pack.id,pack.revision)
      :db.prepare(`${base} VALUES (?,?,?,?,?,?,?,?)`).bind(aid,user.org_id,studentId,sub,phase,null,user.id,now()));
    selected.forEach((q,pos)=>statements.push(db.prepare('INSERT INTO attempt_items VALUES (?,?,?,?,?)').bind(aid,q.id,q.knowledge_id,pos,JSON.stringify({prompt:q.prompt,options:parse(q.options_json),correctOption:q.correct_option,rationale:q.rationale,version:ts.find(t=>t.id===q.knowledge_id).version,knowledgeTitle:ts.find(t=>t.id===q.knowledge_id).title,scopeMode}))));
    statements.push(audit(db,user,'attempt_created',aid));await db.batch(statements);
    return {status:201,data:await attemptView(db,await getAttempt(db,user,env,aid))};
  }
  match=path.match(/^\/attempts\/([^/]+)$/);
  if(match && method==='GET') return {data:await attemptView(db,await getAttempt(db,user,env,match[1]))};
  match=path.match(/^\/attempts\/([^/]+)\/submit$/);
  if(match && method==='POST') {
    requireRole(user,'student','teacher');
    const a=await getAttempt(db,user,env,match[1]);
    if(a.status!=='open') fail(409,'ALREADY_SUBMITTED','测评已提交，不能覆盖实际作答');
    const b=await jsonBody(request,['answers']);
    const items=await rows(db,'SELECT * FROM attempt_items WHERE attempt_id=? ORDER BY position',a.id);
    if(!Array.isArray(b.answers)||b.answers.length!==items.length||b.answers.some(a=>!a||Array.isArray(a)||typeof a!=='object')) fail(400,'ANSWER_SET_INVALID','必须逐题作答');
    const answerMap=byId(b.answers,'questionId');
    if(answerMap.size!==items.length) fail(400,'ANSWER_SET_INVALID','不能重复提交同一道题');
    let correct=0; const statements=[];
    for(const item of items) {
      const ans=answerMap.get(item.question_id),q=parse(item.snapshot_json);
      if(!ans || Object.keys(ans).some(k=>!['questionId','selectedOption'].includes(k)) || !Number.isInteger(ans.selectedOption)||ans.selectedOption<0||ans.selectedOption>=q.options.length) fail(400,'ANSWER_SET_INVALID','作答题目或选项不正确');
      const ok=ans.selectedOption===q.correctOption?1:0;correct+=ok;
      statements.push(db.prepare('INSERT INTO answers VALUES (?,?,?,?)').bind(a.id,item.question_id,ans.selectedOption,ok));
    }
    statements.unshift(db.prepare("UPDATE attempts SET status='submitted',submitted_by=?,source=?,submitted_at=?,correct=?,total=? WHERE id=? AND status='open'").bind(user.id,user.role==='student'?'student_self':'teacher_recorded',now(),correct,items.length,a.id));
    if(a.phase==='retest') statements.push(db.prepare("UPDATE packs SET status='completed' WHERE id=?").bind(a.pack_id));
    statements.push(audit(db,user,'attempt_submitted',a.id));
    await db.batch(statements);
    return {data:await attemptView(db,await getAttempt(db,user,env,a.id))};
  }
  if(path==='/packs' && method==='GET') {
    const studentId=textField(url.searchParams.get('studentId'),'学生');await allowStudent(env,user,studentId);
    return {data:(await rows(db,'SELECT * FROM packs WHERE student_id=? AND org_id=? ORDER BY created_at DESC LIMIT 100',studentId,user.org_id)).map(packView)};
  }
  if(path==='/packs' && method==='POST') {
    requireRole(user,'student','teacher');
    const b=await jsonBody(request,['diagnosticId']);
    const a=await getAttempt(db,user,env,textField(b.diagnosticId,'筛查'));
    if(a.phase!=='diagnostic'||a.status!=='submitted') fail(409,'DIAGNOSTIC_REQUIRED','先提交能力筛查');
    const existing=await db.prepare('SELECT * FROM packs WHERE diagnostic_id=?').bind(a.id).first();
    if(existing) return {data:packView(existing)};
    const answers=await rows(db,'SELECT i.knowledge_id,a.is_correct FROM attempt_items i JOIN answers a ON a.attempt_id=i.attempt_id AND a.question_id=i.question_id WHERE i.attempt_id=?',a.id);
    const weak=[...new Set(answers.filter(a=>!a.is_correct).map(a=>a.knowledge_id))];
    const target=weak.length?weak:[...new Set(answers.map(a=>a.knowledge_id))];
    const ts=(await approvedTopics(db,user.org_id,a.subject)).filter(t=>target.includes(t.id));
    if(ts.length!==target.length) fail(409,'CONTENT_NOT_REVIEWED','所需内容尚未审核');
    const pid=id();
    await db.batch([db.prepare('INSERT INTO packs (id,org_id,student_id,diagnostic_id,subject,knowledge_ids_json,weak_ids_json,material_json,algorithm,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(pid,user.org_id,a.student_id,a.id,a.subject,JSON.stringify(target),JSON.stringify(weak),JSON.stringify(materials(ts)),'rule-v1:wrong-topics-else-consolidation',now()),audit(db,user,'pack_matched',pid)]);
    return {status:201,data:packView(await getPack(db,user,env,pid))};
  }
  match=path.match(/^\/packs\/([^/]+)\/worksheet$/);
  if(match && method==='GET') {
    const p=await getPack(db,user,env,match[1]);
    if(p.status==='draft')fail(409,'PACK_NOT_READY','学习包审核后才能导出作业');
    const selected=parse(p.knowledge_ids_json);
    const ts=(await approvedTopics(db,user.org_id,p.subject)).filter(t=>selected.includes(t.id));
    const snapshots=parse(p.material_json);
    if(ts.length!==selected.length||ts.some(t=>snapshots.find(s=>s.id===t.id)?.version!==t.version))fail(409,'CONTENT_VERSION_CHANGED','课程版本已变化，请老师重新审核学习包');
    const qs=(await rows(db,"SELECT * FROM questions WHERE phase='practice' ORDER BY id")).filter(q=>selected.includes(q.knowledge_id));
    return {data:{packId:p.id,studentId:p.student_id,subject:p.subject,revision:p.revision,teacherNote:p.teacher_note,isExample:true,questions:qs.map(q=>({id:q.id,knowledgeId:q.knowledge_id,prompt:q.prompt,options:parse(q.options_json)}))}};
  }
  match=path.match(/^\/packs\/([^/]+)$/);
  if(match && method==='GET') return {data:packView(await getPack(db,user,env,match[1]))};
  if(match && method==='PATCH') {
    requireRole(user,'teacher');
    const p=await getPack(db,user,env,match[1]),b=await jsonBody(request,['revision','knowledgeIds','teacherNote','approve']);
    if(!['draft','approved'].includes(p.status)) fail(409,'PACK_LOCKED','学习已开始，不能改写该学习包');
    if(!Number.isInteger(b.revision)||b.revision!==p.revision) fail(409,'VERSION_CONFLICT','学习包已更新，请重新加载');
    if(!Array.isArray(b.knowledgeIds)||!b.knowledgeIds.length||b.knowledgeIds.length>4||new Set(b.knowledgeIds).size!==b.knowledgeIds.length || typeof b.approve!=='boolean') fail(400,'INVALID_INPUT','请选择知识点并明确审核状态');
    const ts=(await approvedTopics(db,user.org_id,p.subject)).filter(t=>b.knowledgeIds.includes(t.id));
    if(ts.length!==b.knowledgeIds.length) fail(400,'CONTENT_NOT_REVIEWED','只能选择同科目已审核知识点');
    const note=textField(b.teacherNote??'','教师指导',0,500);
    const result=await db.batch([db.prepare(`UPDATE packs SET knowledge_ids_json=?,material_json=?,teacher_note=?,status=?,revision=revision+1,reviewed_by=?,reviewed_at=? WHERE id=? AND revision=? AND status IN ('draft','approved') AND org_id=? AND ${teachingLink}`)
      .bind(JSON.stringify(b.knowledgeIds),JSON.stringify(materials(ts)),note,b.approve?'approved':'draft',b.approve?user.id:null,b.approve?now():null,p.id,b.revision,user.org_id,user.id),
      db.prepare("INSERT INTO audit_events SELECT ?,?,?,?, ?,? WHERE changes()=1").bind(id(),user.org_id,user.id,'pack_reviewed',p.id,now())]);
    if(result[0].meta.changes!==1){if(!await db.prepare(`SELECT id FROM packs WHERE id=? AND org_id=? AND ${teachingLink}`).bind(p.id,user.org_id,user.id).first())fail(404,'NOT_FOUND','学习包不存在或当前授课授权已失效');fail(409,'VERSION_CONFLICT','学习包已更新或已开始学习');}
    return {data:packView(await getPack(db,user,env,p.id))};
  }
  match=path.match(/^\/students\/([^/]+)\/growth$/);
  if(match && method==='GET') {
    await allowStudent(env,user,match[1],true);
    const evidence=await rows(db,"SELECT a.id,a.phase,a.subject,a.pack_id,a.correct,a.total,a.source,a.submitted_at FROM attempts a WHERE a.student_id=? AND a.org_id=? AND a.status='submitted' ORDER BY a.submitted_at LIMIT 500",match[1],user.org_id);
    const topicEvidence=await rows(db,"SELECT i.knowledge_id AS knowledgeId,k.title,at.phase,COUNT(*) AS answered,SUM(a.is_correct) AS correct FROM answers a JOIN attempts at ON at.id=a.attempt_id JOIN attempt_items i ON i.attempt_id=a.attempt_id AND i.question_id=a.question_id JOIN knowledge k ON k.id=i.knowledge_id WHERE at.student_id=? AND at.org_id=? AND at.status='submitted' GROUP BY i.knowledge_id,at.phase ORDER BY i.knowledge_id,at.phase",match[1],user.org_id);
    const comparisons=await rows(db,"SELECT p.id AS packId,d.correct AS diagnosticCorrect,d.total AS diagnosticTotal,r.correct AS retestCorrect,r.total AS retestTotal FROM packs p JOIN attempts d ON d.id=p.diagnostic_id JOIN attempts r ON r.pack_id=p.id AND r.phase='retest' AND r.status='submitted' WHERE p.student_id=? AND p.org_id=? ORDER BY r.submitted_at",match[1],user.org_id);
    const scopes=await scopesForAttempts(db,evidence);
    return {data:{studentId:match[1],evidence:evidence.map(a=>({id:a.id,phase:a.phase,subject:a.subject,packId:a.pack_id,correct:a.correct,total:a.total,source:a.source,submittedAt:a.submitted_at,scope:scopes.get(a.id)})),topicEvidence,comparisons,paperEvidence:await paperSummaries(env,user,match[1]),homeworkEvidence:await homeworkSummaries(env,user,match[1],{onlyEvidence:true}),notice:'仅反映实际提交记录。未列出的知识点或阶段表示暂无有效作答或未覆盖，不代表0分。测评、作业、人工卷面成绩和能力观察分别列示，不相加为能力或进步百分比。'}};
  }
  return null;
}
