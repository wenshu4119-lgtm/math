// Explicit additive schema migration only. No seed, account, grant or contact data.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,realpathSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {openDatabase} from './local-db.mjs';

export const PLAN_CENTER_MIGRATIONS=['0051_plan_center.sql'];
export const PLAN_CENTER_TABLES=['time_plan_profiles','time_plan_reflections'];
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const hash=value=>createHash('sha256').update(value).digest('hex');
const encoded=value=>JSON.stringify(value,(_key,v)=>typeof v==='bigint'?{$integer:v.toString()}:v instanceof Uint8Array?{$blob:Buffer.from(v).toString('base64')}:v);
export function databaseTables(db){return db.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);}
export function tableSnapshots(db,names=databaseTables(db).filter(n=>n!=='local_migrations')){
 return Object.fromEntries(names.map(name=>{const statement=db.sqlite.prepare('SELECT * FROM '+quote(name));statement.setReadBigInts(true);const records=statement.all().map(encoded).sort();const schema=db.sqlite.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE tbl_name=? AND type IN ('table','index','trigger') ORDER BY type,name").all(name);return [name,{rows:records.length,sha256:hash(encoded(records)),schemaSha256:hash(encoded(schema))}];}));
}
export function assertDatabaseIntegrity(db){assert.equal(db.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok','SQLite integrity check failed');assert.equal(db.sqlite.prepare('PRAGMA foreign_key_check').all().length,0,'Foreign-key check failed');}
export function planCenterCounts(db){return Object.fromEntries(PLAN_CENTER_TABLES.map(name=>[name,db.sqlite.prepare('SELECT COUNT(*) AS n FROM '+quote(name)).get().n]));}
export function planCenterSchemaHashes(db){return Object.fromEntries(Object.entries(tableSnapshots(db,PLAN_CENTER_TABLES)).map(([name,value])=>[name,value.schemaSha256]));}
function expectedPlanCenterSchema(){const scratch=openDatabase();try{for(const name of PLAN_CENTER_MIGRATIONS)scratch.sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));return planCenterSchemaHashes(scratch);}finally{scratch.sqlite.close();}}

export function migratePlanCenterProduction(db){
 assertDatabaseIntegrity(db);const beforeNames=databaseTables(db);
 for(const name of ['local_migrations','organizations','users','attempts','arts_content_versions','arts_reviews','arts_plans','arts_attempts','time_plans','time_plan_versions','time_plan_previews','time_plan_events'])assert.ok(beforeNames.includes(name),'Expected established junior/arts database table is missing: '+name);
 const existingPlanCenter=beforeNames.filter(n=>PLAN_CENTER_TABLES.includes(n));assert.ok(existingPlanCenter.length===0||encoded(existingPlanCenter)===encoded(PLAN_CENTER_TABLES),'Unexpected partial or unknown planCenter schema; re-audit without deleting data');
 const expectedSchema=expectedPlanCenterSchema();if(existingPlanCenter.length)assert.deepEqual(planCenterSchemaHashes(db),expectedSchema,'Existing planCenter schema differs from current migration definitions; refuse without repairing or deleting data');
 const originalNames=beforeNames.filter(n=>n!=='local_migrations'),before=tableSnapshots(db,originalNames),migrationSchema=tableSnapshots(db,['local_migrations']).local_migrations.schemaSha256;
 const priorRegistrations=db.sqlite.prepare('SELECT name FROM local_migrations ORDER BY name').all().map(r=>r.name),registered=PLAN_CENTER_MIGRATIONS.filter(n=>priorRegistrations.includes(n));
 assert.ok((existingPlanCenter.length===0&&registered.length===0)||(existingPlanCenter.length===PLAN_CENTER_TABLES.length&&registered.length===PLAN_CENTER_MIGRATIONS.length),'Migration registration does not match planCenter schema');
 const applied=[];db.sqlite.exec('BEGIN IMMEDIATE');
 try{
  for(const name of PLAN_CENTER_MIGRATIONS){if(priorRegistrations.includes(name))continue;db.sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));db.sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name);applied.push(name);}
  assert.deepEqual(databaseTables(db).filter(n=>PLAN_CENTER_TABLES.includes(n)),PLAN_CENTER_TABLES,'PlanCenter migration created an unexpected schema');
  assert.deepEqual(planCenterSchemaHashes(db),expectedSchema,'New planCenter schema differs from current migration definitions');
  assert.deepEqual(tableSnapshots(db,originalNames),before,'An existing table, row, index or trigger changed');
  assert.equal(tableSnapshots(db,['local_migrations']).local_migrations.schemaSha256,migrationSchema,'Migration registry schema changed');
  const registrations=db.sqlite.prepare('SELECT name FROM local_migrations ORDER BY name').all().map(r=>r.name);assert.deepEqual(registrations,[...new Set([...priorRegistrations,...PLAN_CENTER_MIGRATIONS])].sort(),'Unexpected migration registration change');
  const added=databaseTables(db).filter(n=>!beforeNames.includes(n));assert.deepEqual(added,existingPlanCenter.length?[]:PLAN_CENTER_TABLES,'Unexpected table added');
  const counts=planCenterCounts(db);for(const name of added)assert.equal(counts[name],0,'New planCenter tables must start empty; seeding is forbidden');assertDatabaseIntegrity(db);db.sqlite.exec('COMMIT');
  return {success:true,appliedMigrations:applied,newTables:added,planCenterTables:PLAN_CENTER_TABLES,planCenterCounts:counts,planCenterSchemaVerified:true,planCenterSchemaHashes:expectedSchema,originalTablesChecked:originalNames.length,originalTablesUnchanged:true,originalSchemasUnchanged:true,migrationRegistryOnlyAppended:true,allNewTablesEmpty:true,allPlanCenterTablesEmpty:Object.values(counts).every(n=>n===0),seedPerformed:false,businessRowsCreated:0,accountsCreated:0,grantsCreated:0,contactDraftsCreated:0,databaseReplaced:false};
 }catch(error){db.sqlite.exec('ROLLBACK');throw error;}
}

function invokedAsCli(){try{return Boolean(process.argv[1])&&pathToFileURL(realpathSync(resolve(process.argv[1]))).href===import.meta.url;}catch{return false;}}
if(invokedAsCli()){
 const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--database'||!args[1])throw Error('Usage: node scripts/migrate-plan-center-production.mjs --database EXISTING_DB');
 const requested=resolve(args[1]);assert.ok(existsSync(requested)&&lstatSync(requested).isFile()&&!lstatSync(requested).isSymbolicLink(),'Existing regular database file required; refusing to create or follow a database link');const file=realpathSync(requested);
 if(process.platform==='linux'&&file==='/var/lib/learning-platform/data/learning.sqlite'){const state=execFileSync('systemctl',['show','learning-platform.service','-p','ActiveState','--value'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();assert.equal(state,'inactive','Production learning-platform.service must be inactive before migration');}
 const db=openDatabase(file);try{console.log(JSON.stringify(migratePlanCenterProduction(db)));}finally{db.sqlite.close();}
}
