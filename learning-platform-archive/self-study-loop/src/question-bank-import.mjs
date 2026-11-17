import catalog from '../data/question-bank/catalog.json' with {type:'json'};
import {sha} from './question-bank-validation.mjs';
export const bankCatalog=catalog;
export async function importBank(db,orgId,{batchId,actor=null}={}){
 const batches=catalog.batches.filter(b=>!batchId||b.id===batchId);if(!batches.length)throw Error('Unknown packaged batch');let imported=0,skipped=0;
 for(const batch of batches){
  if(await db.prepare('SELECT id FROM bank_batches WHERE org_id=? AND source_sha256=?').bind(orgId,batch.sha256).first()){skipped+=catalog.records.filter(r=>r.batchId===batch.id).length;continue;}
  const at=new Date().toISOString(),guard=actor?"EXISTS(SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=? AND u.org_id=? AND u.role='admin' AND u.active=1 AND u.must_change_password=0 AND s.token_hash=? AND s.expires_at>?)":'1',args=actor?[actor.id,orgId,actor.token_hash,Date.now()]:[];
  const statements=[db.prepare(`INSERT INTO bank_batches SELECT ?,?,?,?,? WHERE ${guard}`).bind(orgId,batch.id,batch.sha256,JSON.stringify(batch),at,...args)];
  for(const r of catalog.records.filter(r=>r.batchId===batch.id)){
   statements.push(db.prepare(`INSERT INTO bank_heads SELECT ?,?,?,0 WHERE ${guard} AND EXISTS(SELECT 1 FROM bank_batches WHERE org_id=? AND id=?)`).bind(orgId,r.question.id,batch.id,...args,orgId,batch.id));
   const state=r.validation.status==='quarantined'?'quarantined':r.validation.status==='passed'?'available':'pending';
   statements.push(db.prepare(`INSERT INTO bank_versions SELECT ?,?,1,?,?,?,?,NULL,NULL,?,'import',?,? WHERE ${guard} AND EXISTS(SELECT 1 FROM bank_heads WHERE org_id=? AND id=? AND revision=0)`).bind(orgId,r.question.id,JSON.stringify(r.question),sha(r.question),JSON.stringify(r.validation),state,actor?.id||null,'保存原稿、独立校验与源文件哈希；未执行真人审核',at,...args,orgId,r.question.id));
  }
  const result=await db.batch(statements);if(result[0].meta.changes!==1)throw Error('Import authorization changed');imported+=catalog.records.filter(r=>r.batchId===batch.id).length;
 }
 return {imported,skipped,humanReviewsCreated:0,batches:batches.map(b=>b.id)};
}
