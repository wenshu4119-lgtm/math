import catalog from '../data/question-bank/expansion/subject-pilot.json' with {type:'json'};
import {sha} from './question-bank-validation.mjs';
import {checkPilotQuestion} from './subject-pilot-validation.mjs';
export const pilotCatalog=catalog;
export async function importPilot(db,org,{batchId,actor=null}={}){
 const batches=catalog.batches.filter(b=>!batchId||b.id===batchId);if(!batches.length)throw Error('Unknown packaged pilot');
 let imported=0,skipped=0;
 for(const b of batches){
  const records=catalog.records.filter(r=>r.batchId===b.id);
  if(sha(records.map(({batchId,...r})=>r))!==b.sha256)throw Error('Pilot checksum changed');
  for(const r of records){if(r.question.source!=='original_platform_authored'||r.question.license!=='platform-internal-use'||r.question.reviewStatus!=='pending_human'||r.validation.status!=='needs_review'||r.validation.humanReview!==false||r.validation.issues.length||checkPilotQuestion(r.question).status!=='passed')throw Error('Pilot automatic/rights gate failed');}
  const existing=await db.prepare('SELECT source_sha256 FROM bank_batches WHERE org_id=? AND id=?').bind(org,b.id).first();if(existing){if(existing.source_sha256!==b.sha256)throw Error('Existing pilot ID has different content');skipped+=records.length;continue;}
  const at=new Date().toISOString(),guard=actor?"EXISTS(SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=? AND u.org_id=? AND u.role='admin' AND u.active=1 AND u.must_change_password=0 AND s.token_hash=? AND s.expires_at>?)":'1',args=actor?[actor.id,org,actor.token_hash,Date.now()]:[];
  const statements=[db.prepare(`INSERT INTO bank_batches SELECT ?,?,?,?,? WHERE ${guard}`).bind(org,b.id,b.sha256,JSON.stringify(b),at,...args)];
  for(const r of records){const q=r.question;
   statements.push(db.prepare(`INSERT INTO bank_heads SELECT ?,?,?,0 WHERE ${guard} AND EXISTS(SELECT 1 FROM bank_batches WHERE org_id=? AND id=?)`).bind(org,q.id,b.id,...args,org,b.id));
   statements.push(db.prepare(`INSERT INTO bank_versions SELECT ?,?,1,?,?,?,'pending',NULL,NULL,?,'original_pilot_import',?,? WHERE ${guard} AND EXISTS(SELECT 1 FROM bank_heads WHERE org_id=? AND id=? AND revision=0)`).bind(org,q.id,JSON.stringify(q),sha(q),JSON.stringify(r.validation),actor?.id||null,'原创候选经独立数值/定义检查；教材与教学适用性待教师审核，未开放学生练习。',at,...args,org,q.id));
  }
  const result=await db.batch(statements);if(!result[0].meta.changes)throw Error('Pilot import authorization changed');imported+=records.length;
 }
 return {imported,skipped,humanReviewsCreated:0,studentPracticeAdded:0,batches:batches.map(b=>b.id)};
}
export async function withdrawPilot(db,org,batchId){
 if(!catalog.batches.some(b=>b.id===batchId))throw Error('Unknown pilot');
 const rows=(await db.prepare('SELECT h.id FROM bank_heads h WHERE h.org_id=? AND h.batch_id=?').bind(org,batchId).all()).results,at=new Date().toISOString();let withdrawn=0;const conflicts=[];
 for(const {id} of rows){const result=await db.prepare(`INSERT INTO bank_versions SELECT v.org_id,v.question_id,2,v.content_json,v.content_hash,v.validation_json,'withdrawn',NULL,NULL,NULL,'pilot_batch_withdrawal',?,? FROM bank_heads h JOIN bank_versions v ON v.org_id=h.org_id AND v.question_id=h.id AND v.revision=h.revision WHERE h.org_id=? AND h.id=? AND h.revision=1 AND v.action='original_pilot_import' AND v.reviewed_by IS NULL`).bind(JSON.stringify({batch:batchId,humanReview:false}),at,org,id).run();if(result.meta.changes)withdrawn++;else conflicts.push(id);}
 return {withdrawn,conflicts,historicalVersionsPreserved:true};
}
