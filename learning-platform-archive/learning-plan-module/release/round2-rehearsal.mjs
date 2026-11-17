import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {DatabaseSync,backup} from 'node:sqlite';
import {sha} from '../src/question-bank-validation.mjs';
import {openDatabase,migrate} from '../scripts/local-db.mjs';
import {applyRecheckBatch,rollbackRecheckBatch} from '../src/question-bank-recheck.mjs';
import {importPilot,withdrawPilot} from '../src/question-bank-expansion.mjs';
import {publicCoverage} from '../src/question-bank.mjs';
import assert from 'node:assert/strict';
const baseline=JSON.parse(readFileSync('test-results/content-round2/baseline.json'));
const folder='.local/round2-rehearsal-'+Date.now();mkdirSync(folder,{recursive:true});
const source=new DatabaseSync(baseline.restore.restoreDirectory+'/learning.sqlite',{readOnly:true});await backup(source,folder+'/learning.sqlite');source.close();
const db=openDatabase(folder+'/learning.sqlite');
const exclude=new Set(['local_migrations','bank_heads','bank_versions','bank_batches']);
const originalTables=db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name).filter(n=>!exclude.has(n));
const capture=()=>Object.fromEntries(originalTables.map(n=>[n,sha(db.sqlite.prepare(`SELECT * FROM "${n}"`).all().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))]));
try{
 const before=capture();migrate(db);const orgs=db.sqlite.prepare('SELECT id FROM organizations').all();assert.equal(orgs.length,1);const org=orgs[0].id;
 const receipts=[],ids=[];
 for(const filename of ['math-recheck-v2.json','english-recheck-v3.json']){
  const report=JSON.parse(readFileSync('data/question-bank/rechecks/'+filename));
  for(const b of report.batches){const batch={id:b.id,subject:b.subject,grade:b.grade,checker:report.checker,records:report.records.filter(r=>b.questionIds.includes(r.questionId))};const receipt=await applyRecheckBatch(db,org,batch);receipts.push({id:b.id,applied:receipt.applied,conflicts:receipt.conflicts});ids.push(b.id);assert.equal((await applyRecheckBatch(db,org,batch)).idempotent,true);}
 }
 const pilot=await importPilot(db,org);assert.equal(pilot.imported,12);assert.equal((await importPilot(db,org)).skipped,12);
 const coverage=await publicCoverage(db);assert.equal(coverage.totals.questionCount,348);assert.equal(coverage.totals.knowledgeCount,116);assert.equal(coverage.totals.studentPracticeCount,281);assert.equal(coverage.totals.pendingCount,30);assert.equal(coverage.totals.quarantinedCount,25);assert.equal(coverage.totals.reviewedCount,baseline.coverage.totals.reviewedCount);
 assert.deepEqual(capture(),before);assert.equal(db.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal(db.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const versionCountBeforeRollback=db.sqlite.prepare('SELECT count(*) n FROM bank_versions').get().n;
 for(const id of ids){const result=await rollbackRecheckBatch(db,org,id);assert.equal(result.conflicts.length,0);}
 for(const id of ['pilot-physics-20261114-v1','pilot-geography-20261114-v1'])assert.equal((await withdrawPilot(db,org,id)).withdrawn,6);
 const afterRollback=await publicCoverage(db);assert.equal(afterRollback.totals.studentPracticeCount,4);assert.equal(afterRollback.totals.quarantinedCount,3);assert.deepEqual(capture(),before);
 assert(db.sqlite.prepare('SELECT count(*) n FROM bank_versions').get().n>versionCountBeforeRollback);
 const result={checkedAt:new Date().toISOString(),isolatedRestoredCopy:folder,productionModified:false,originalBusinessTablesUnchanged:true,applied:receipts,pilot,afterApply:coverage.totals,afterRollback:afterRollback.totals,historyPreserved:true,independentBackup:baseline.restore.archive};writeFileSync('test-results/content-round2/rehearsal.json',JSON.stringify(result,null,2));console.log({...result,applied:receipts.map(r=>({id:r.id,applied:r.applied,conflicts:r.conflicts.length}))});
}finally{db.sqlite.close();}
