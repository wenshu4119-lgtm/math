import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {openDatabase,migrate} from '../scripts/local-db.mjs';
import {importBank} from '../src/question-bank-import.mjs';
import {publicCoverage} from '../src/question-bank.mjs';
const restored=JSON.parse(readFileSync('test-results/content-release/restore-check.json'));
const db=openDatabase(restored.restoreDirectory+'/learning.sqlite');
const snapshot=()=>Object.fromEntries(db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().filter(({name})=>!['local_migrations','audit_events','rate_limits','sessions'].includes(name)&&!name.startsWith('bank_')&&!name.startsWith('deeptutor_lab_')).map(({name})=>[name,createHash('sha256').update(JSON.stringify(db.sqlite.prepare(`SELECT * FROM "${name}"`).all().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest('hex')]));
try{
 const before=snapshot();migrate(db);const organizations=db.sqlite.prepare('SELECT id FROM organizations').all();assert.equal(organizations.length,1);
 const imported=await importBank(db,organizations[0].id),again=await importBank(db,organizations[0].id);
 assert.equal(imported.imported,324);assert.equal(again.skipped,324);assert.deepEqual(snapshot(),before);
 assert.equal(db.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 const coverage=await publicCoverage(db);assert.equal(coverage.totals.questionCount,336);assert.equal(coverage.totals.knowledgeCount,112);assert.equal(coverage.totals.studentPracticeCount,4);
 const result={checkedAt:new Date().toISOString(),sourceBackup:restored.archive,isolatedRestoredCopy:true,productionModified:false,imported:imported.imported,repeatedImportSkipped:again.skipped,existingBusinessTablesUnchanged:true,integrity:'ok',coverage};
 writeFileSync('test-results/content-release/migration-rehearsal.json',JSON.stringify(result,null,2));console.log({imported:result.imported,repeatedImportSkipped:result.repeatedImportSkipped,existingBusinessTablesUnchanged:true,totals:coverage.totals});
}finally{db.sqlite.close();}
