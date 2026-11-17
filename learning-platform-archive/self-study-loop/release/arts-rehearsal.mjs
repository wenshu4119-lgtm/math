// Local-only rehearsal from an already decrypted and independently restored backup.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,readdirSync,realpathSync,statSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync,backup} from 'node:sqlite';
import {createHash,randomBytes} from 'node:crypto';
import {openDatabase} from '../scripts/local-db.mjs';
import {initializeArtsProduction,ARTS_TABLES,databaseTables,tableSnapshots,artsSeedCounts,assertDatabaseIntegrity} from '../scripts/seed-arts-production.mjs';
import {handleApi} from '../src/api.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const inside=(child,parent)=>{const r=relative(parent,child);return r!==''&&r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r);};
const release=JSON.parse(readFileSync(join(root,'release/content-round2.json'),'utf8')),receipt=release.backup;
assert.equal(release.backend,'/opt/learning-platform/releases/20261114-content-2');assert.equal(receipt?.verified,true);assert.equal(receipt.sqliteIntegrity,'ok');assert.equal(receipt.foreignKeysValid,true);assert.equal(receipt.productionUntouched,true);
const allowed=realpathSync(join(root,'.local/production')),restored=realpathSync(resolve(root,receipt.restoreDirectory));assert.ok(inside(restored,allowed),'Restore source must be inside the audited local production-backup directory');
const sourceFile=realpathSync(join(restored,'learning.sqlite'));assert.ok(inside(sourceFile,restored));assert.ok(statSync(sourceFile).isFile());
const manifest=JSON.parse(readFileSync(join(restored,'backup-manifest.json'),'utf8')),entry=manifest.files.find(f=>f.path==='learning.sqlite'),sourceHash=hash(readFileSync(sourceFile));assert.equal(manifest.releaseVersion,'20261114-content-2');assert.equal(entry?.sha256,sourceHash,'Restored source no longer matches its backup manifest');
mkdirSync(join(root,'.local'),{recursive:true});const isolated=mkdtempSync(join(root,'.local/arts-rehearsal-')),copy=join(isolated,'learning.sqlite');assert.ok(inside(realpathSync(isolated),realpathSync(join(root,'.local'))));
const source=new DatabaseSync(sourceFile,{readOnly:true});try{source.exec('PRAGMA query_only=ON');await backup(source,copy);}finally{source.close();}
const db=openDatabase(copy),output=join(root,'test-results/arts-production');mkdirSync(output,{recursive:true});
try{
 const originalNames=databaseTables(db).filter(n=>n!=='local_migrations');assert.equal(originalNames.filter(n=>n.startsWith('arts_')).length,0,'Audited .3 backup must predate arts schema');
 const before=tableSnapshots(db,originalNames),orgs=db.sqlite.prepare('SELECT id FROM organizations').all();assert.equal(orgs.length,1);const org=orgs[0].id;
 const first=await initializeArtsProduction(db,org),firstSnapshot=tableSnapshots(db,databaseTables(db));assert.deepEqual(tableSnapshots(db,originalNames),before);
 const second=await initializeArtsProduction(db,org);assert.deepEqual(tableSnapshots(db,databaseTables(db)),firstSnapshot,'Second migrate/seed was not idempotent');assert.deepEqual(tableSnapshots(db,originalNames),before);
 const additions=databaseTables(db).filter(n=>!originalNames.includes(n)&&n!=='local_migrations');assert.deepEqual(additions,ARTS_TABLES);
 const counts=artsSeedCounts(db,org);assert.equal(counts.contents,6);assert.equal(counts.questions,18);assert.equal(counts.pending,6);assert.equal(counts.reviewed,0);assertDatabaseIntegrity(db);
 const env={DB:db,APP_ENV:'local',APP_ORIGIN:'http://127.0.0.1:18794',SESSION_SECRET:randomBytes(32).toString('base64url')};
 const check=async path=>{const r=await handleApi(new Request(env.APP_ORIGIN+'/api/v1/'+path),env);return {status:r.status,body:await r.json()};};
 const health=await check('health'),arts=await check('public/arts/catalog'),junior=await check('public/coverage'),qa=await check('public/learning-qa-status'),privateArts=await check('arts/catalog?examYear=2027'),students=await check('students');
 assert.equal(health.status,200);assert.equal(arts.status,200,'Root must finish the public arts API wiring before release');assert.equal(arts.body.data.stage,'senior_arts');assert.equal(arts.body.data.counts.points,6);assert.equal(arts.body.data.counts.questions,18);assert.equal(arts.body.data.counts.initialHumanReviewed,0);assert.equal(arts.body.data.counts.humanReviewed,null);
 const rejectPrivate=(v)=>{if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){assert.ok(!['correctOption','selectedOption','rationale','snapshot_json','answers_json','studentId','owner_id'].includes(k),'Public arts catalog contains private payload key');rejectPrivate(x);}};rejectPrivate(arts.body.data);
 assert.equal(junior.status,200);assert.deepEqual(junior.body.data.totals,release.coverage,'Junior public data changed');assert.equal(qa.status,200);assert.equal(qa.body.data.status,'unavailable','Local rehearsal deliberately has no model configuration');assert.equal(privateArts.status,401);assert.equal(students.status,401);assert.deepEqual(tableSnapshots(db,originalNames),before,'Read-only API checks mutated original tables');
 assert.equal(hash(readFileSync(sourceFile)),sourceHash,'The decrypted source backup was modified');
 const critical=['src/api.mjs','src/arts.mjs','src/arts-domain.mjs','scripts/local-db.mjs','scripts/seed-arts-production.mjs','release/production-server.mjs',...readdirSync(join(root,'migrations')).filter(n=>n.endsWith('.sql')).map(n=>'migrations/'+n),...readdirSync(join(root,'data')).filter(n=>/^arts.*\.json$/.test(n)).map(n=>'data/'+n)].sort();
 const result={checkedAt:new Date().toISOString(),localOnly:true,productionModified:false,sourceRelease:release.version,restoredFromArchive:receipt.archive,sourceDatabaseSha256:sourceHash,sourceBackupUnchanged:true,isolatedCopy:relative(root,isolated).split(sep).join('/'),sqliteBackupUsed:true,first,second,newTables:additions,allOriginalTablesUnchanged:true,originalTableSnapshots:before,secondMigrateAndSeedIdempotent:true,artsCounts:{contents:6,questions:18,pending:6,reviewed:0,tableCounts:counts.tableCounts},apiChecks:{health:health.status,publicArts:arts.status,junior:junior.status,juniorTotalsUnchanged:true,qaStatusEndpoint:qa.status,qaMode:'deliberately_unconfigured_local_no_model_call',anonymousArts:privateArts.status,anonymousStudents:students.status,publicArtsContainsNoAnswers:true},criticalSourceHashes:Object.fromEntries(critical.map(p=>[p,hash(readFileSync(join(root,p)))]))};
 const serialized=JSON.stringify(result,null,2)+'\n';writeFileSync(join(output,'rehearsal-'+Date.now()+'.json'),serialized);writeFileSync(join(output,'rehearsal.json'),serialized);console.log(JSON.stringify({localOnly:true,productionModified:false,originalTablesChecked:originalNames.length,allOriginalTablesUnchanged:true,newTables:additions,contents:6,questions:18,pending:6,reviewed:0,idempotent:true,sourceBackupUnchanged:true,isolatedCopy:result.isolatedCopy,apiChecks:result.apiChecks}));
}finally{db.sqlite.close();}
