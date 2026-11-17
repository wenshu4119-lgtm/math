import {sha} from './question-bank-validation.mjs';

const queryCurrent=`SELECT v.* FROM bank_heads h JOIN bank_versions v ON v.org_id=h.org_id AND v.question_id=h.id AND v.revision=h.revision WHERE h.org_id=? AND h.id=?`;
const expect=(condition,message)=>{if(!condition)throw Error(message);};
function validateRecord(r){
 const p=r.proposal;
 expect(r.humanReview===false&&p&&p.validation?.humanReview===false,'Automated batch cannot create teacher review');
 expect(/^[-\w]+$/.test(r.questionId)&&p.content?.id===r.questionId,'Question identity mismatch');
 expect(Number.isInteger(p.expectedRevision)&&p.expectedRevision===r.expectedRevision&&p.expectedRevision===1,'This round rechecks original version one only');
 expect(/^[a-f0-9]{64}$/.test(r.sourceContentHash)&&p.expectedContentHash===r.sourceContentHash,'Original content digest required');
 expect(sha(p.content)===p.contentHash,'Proposed content digest mismatch');
 const state={passed:'available',needs_review:'pending',quarantined:'quarantined'}[r.decision];
 expect(state&&p.state===state&&p.validation.status===r.decision,'Verification and state mismatch');
 expect(Array.isArray(p.validation.issues)&&Array.isArray(p.validation.warnings),'Explicit validation findings required');
 expect(typeof p.reason==='string'&&p.reason.length>=5,'Specific audit reason required');
 expect(p.content.source==='original_authored_cc0'&&p.content.license==='CC0-1.0','Source rights declaration missing');
 expect(Array.isArray(p.content.options)&&p.content.options.length===4&&new Set(p.content.options).size===4&&Number.isInteger(p.content.correctOption)&&p.content.correctOption>=0&&p.content.correctOption<4,'Invalid multiple-choice content');
 expect(!p.content.reviewedBy&&!p.content.reviewedAt&&p.content.reviewStatus==='pending_human','Proposed content cannot claim human review');
 if(r.decision==='passed'){
  expect(!p.validation.issues.length&&r.independentAnswer?.optionIndexes?.length===1&&r.independentAnswer.optionIndexes[0]===p.content.correctOption,'Passing requires one independently derived answer');
  expect(typeof r.independentAnswer.reason==='string'&&r.independentAnswer.reason.length>5&&typeof r.independentAnswer.method==='string','Independent derivation required');
 }
 return p;
}
export async function applyRecheckBatch(db,org,batch){
 expect(/^[-\w]{1,100}$/.test(batch.id)&&Array.isArray(batch.records)&&batch.records.length>0&&batch.records.length<=100,'Invalid bounded recheck batch');
 expect(new Set(batch.records.map(r=>r.questionId)).size===batch.records.length,'Duplicate question in recheck batch');
 batch.records.forEach(validateRecord);
 const digest=sha(batch),existing=await db.prepare('SELECT digest FROM bank_recheck_batches WHERE org_id=? AND id=?').bind(org,batch.id).first();
 if(existing){expect(existing.digest===digest,'Existing batch ID has different content');return {id:batch.id,idempotent:true,...await recheckSummary(db,org,batch.id)};}
 const at=new Date().toISOString(),statements=[db.prepare('INSERT INTO bank_recheck_batches VALUES (?,?,?,?,?)').bind(org,batch.id,digest,JSON.stringify({kind:'automated_recheck',subject:batch.subject,grade:batch.grade,checker:batch.checker,questions:batch.records.length,humanReview:false}),at)];
 for(const r of batch.records){
  const p=r.proposal,before=await db.prepare(queryCurrent).bind(org,r.questionId).first();
  const note=JSON.stringify({batch:batch.id,reason:p.reason,independentAnswer:r.independentAnswer,evidence:r.evidence,originalHash:r.sourceContentHash,humanReview:false});
  statements.push(db.prepare(`INSERT INTO bank_versions SELECT ?,?,?, ?,?,?,?,NULL,NULL,NULL,?,?,? FROM bank_heads h JOIN bank_versions v ON v.org_id=h.org_id AND v.question_id=h.id AND v.revision=h.revision WHERE h.org_id=? AND h.id=? AND h.revision=? AND v.content_hash=? AND v.reviewed_by IS NULL AND v.action='import' AND v.state IN ('pending','quarantined','available')`).bind(org,r.questionId,p.expectedRevision+1,JSON.stringify(p.content),p.contentHash,JSON.stringify(p.validation),p.state,'automated_recheck:'+batch.id,note,at,org,r.questionId,p.expectedRevision,p.expectedContentHash));
  statements.push(db.prepare(`INSERT INTO bank_recheck_items SELECT ?,?,?,?,?,CASE WHEN changes()=1 THEN ? ELSE NULL END,CASE WHEN changes()=1 THEN ? ELSE NULL END,CASE WHEN changes()=1 THEN ? ELSE NULL END,CASE WHEN changes()=1 THEN 'applied' ELSE 'conflict' END,?,NULL`).bind(org,batch.id,r.questionId,p.expectedRevision,p.expectedContentHash,p.expectedRevision+1,p.contentHash,before?JSON.stringify(before):null,at));
 }
 await db.batch(statements);
 return {id:batch.id,idempotent:false,...await recheckSummary(db,org,batch.id)};
}
export async function recheckSummary(db,org,batchId){
 const items=(await db.prepare('SELECT question_id,result,applied_revision FROM bank_recheck_items WHERE org_id=? AND batch_id=? ORDER BY question_id').bind(org,batchId).all()).results;
 return {applied:items.filter(x=>x.result==='applied').length,conflicts:items.filter(x=>x.result==='conflict'||x.result==='rollback_conflict').map(x=>x.question_id),rolledBack:items.filter(x=>x.result==='rolled_back').length,humanReviewsCreated:0,items};
}
export async function rollbackRecheckBatch(db,org,batchId){
 const items=(await db.prepare("SELECT * FROM bank_recheck_items WHERE org_id=? AND batch_id=? AND result='applied' ORDER BY question_id").bind(org,batchId).all()).results,at=new Date().toISOString();
 for(const item of items){
  const prior=JSON.parse(item.prior_json);expect(prior.reviewed_by===null,'Automated rollback cannot restore a fabricated teacher review');
  await db.batch([
   db.prepare(`INSERT INTO bank_versions SELECT ?,?,?,?,?,?,?,NULL,NULL,NULL,?,?,? FROM bank_heads h JOIN bank_versions v ON v.org_id=h.org_id AND v.question_id=h.id AND v.revision=h.revision WHERE h.org_id=? AND h.id=? AND h.revision=? AND v.content_hash=? AND v.action=? AND v.reviewed_by IS NULL`).bind(org,item.question_id,item.applied_revision+1,prior.content_json,prior.content_hash,prior.validation_json,prior.state,'automated_recheck_rollback',JSON.stringify({batch:batchId,restoredFromVersion:prior.revision,humanReview:false}),at,org,item.question_id,item.applied_revision,item.applied_hash,'automated_recheck:'+batchId),
   db.prepare("UPDATE bank_recheck_items SET result=CASE WHEN changes()=1 THEN 'rolled_back' ELSE 'rollback_conflict' END,rollback_at=? WHERE org_id=? AND batch_id=? AND question_id=? AND result='applied'").bind(at,org,batchId,item.question_id)
  ]);
 }
 return {id:batchId,...await recheckSummary(db,org,batchId)};
}
