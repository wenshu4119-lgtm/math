// Explicit, single-organization initialization. No accounts, reviews or attempts.
import assert from 'node:assert/strict';
import {existsSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {openDatabase,migrate} from './local-db.mjs';
import {seedArtsContent} from '../src/arts.mjs';
import content from '../data/arts-content.json' with {type:'json'};

export const ARTS_TABLES=['arts_attempts','arts_content_versions','arts_plan_versions','arts_plans','arts_reports','arts_reviews'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const quoted=name=>'"'+name.replaceAll('"','""')+'"';
export function databaseTables(db){return db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);}
export function tableSnapshots(db,names=databaseTables(db).filter(n=>n!=='local_migrations')){
 return Object.fromEntries(names.map(name=>{const rows=db.sqlite.prepare('SELECT * FROM '+quoted(name)).all().map(row=>JSON.stringify(row,(_k,v)=>typeof v==='bigint'?v.toString():v)).sort();const schema=db.sqlite.prepare("SELECT type,name,sql FROM sqlite_master WHERE tbl_name=? AND type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_autoindex%' ORDER BY type,name").all(name);return [name,{rows:rows.length,sha256:sha(JSON.stringify(rows)),schemaSha256:sha(JSON.stringify(schema))}];}));
}
export function assertDatabaseIntegrity(db){assert.equal(db.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok','SQLite integrity failed');assert.equal(db.sqlite.prepare('PRAGMA foreign_key_check').all().length,0,'Foreign-key check failed');}
export function artsSeedCounts(db,org){
 const tableCounts=Object.fromEntries(ARTS_TABLES.map(t=>[t,db.sqlite.prepare('SELECT COUNT(*) AS n FROM '+quoted(t)).get().n]));
 const versions=db.sqlite.prepare('SELECT point_id,version,payload_json,status,created_by FROM arts_content_versions WHERE org_id=? ORDER BY point_id,version').all(org);
 return {tableCounts,contents:versions.length,questions:versions.reduce((n,v)=>n+JSON.parse(v.payload_json).questions.length,0),pending:versions.filter(v=>v.status==='pending_human').length,reviewed:tableCounts.arts_reviews,versions};
}
export async function initializeArtsProduction(db,org){
 assert.equal(typeof org,'string','Explicit organization ID is required');assert.match(org,/^[\w-]{1,120}$/);
 const organizations=db.sqlite.prepare('SELECT id FROM organizations ORDER BY id').all();assert.equal(organizations.length,1,'This release requires exactly one audited organization');assert.equal(organizations[0].id,org,'Explicit organization does not match audited database');
 const originalNames=databaseTables(db).filter(n=>n!=='local_migrations'),originalNonArts=originalNames.filter(n=>!n.startsWith('arts_'));
 const before=tableSnapshots(db,originalNonArts),existingArts=originalNames.filter(n=>n.startsWith('arts_'));
 assert.ok(existingArts.length===0||JSON.stringify(existingArts)===JSON.stringify(ARTS_TABLES),'Unexpected partial arts schema; re-audit before initialization');
 if(existingArts.length){const old=artsSeedCounts(db,org);assert.ok(old.contents===0||old.contents===6,'Existing arts content requires an explicit new release review');for(const t of ARTS_TABLES.filter(t=>t!=='arts_content_versions'))assert.equal(old.tableCounts[t],0,'Existing arts activity must not be treated as a fresh seed');for(const row of old.versions){const point=content.points.find(p=>p.id===row.point_id&&p.version===row.version);assert.ok(point&&row.status==='pending_human'&&row.created_by===null&&row.payload_json===JSON.stringify(point),'Existing arts content was changed; preserve it and re-audit');}}
 assertDatabaseIntegrity(db);migrate(db);assert.deepEqual(databaseTables(db).filter(n=>n.startsWith('arts_')),ARTS_TABLES,'Expected exactly six arts tables');
 await seedArtsContent(db,org);
 assert.deepEqual(tableSnapshots(db,originalNonArts),before,'Pre-existing non-arts tables or schemas changed');
 const counts=artsSeedCounts(db,org);assert.equal(content.points.length,6);assert.equal(counts.contents,6);assert.equal(counts.questions,18);assert.equal(counts.pending,6);assert.equal(counts.reviewed,0);
 for(const t of ARTS_TABLES.filter(t=>t!=='arts_content_versions'))assert.equal(counts.tableCounts[t],0,'Seeding created reviews, reports, plans or attempts');
 for(const row of counts.versions){const point=content.points.find(p=>p.id===row.point_id);assert.equal(row.version,point.version);assert.equal(row.created_by,null);assert.equal(row.payload_json,JSON.stringify(point));}
 assertDatabaseIntegrity(db);
 return {success:true,organizationCount:1,contents:counts.contents,questions:counts.questions,pending:counts.pending,reviewed:counts.reviewed,artsTableCounts:counts.tableCounts,originalTablesChecked:originalNonArts.length,originalTablesUnchanged:true,accountsCreated:0,studentRecordsCreated:0,humanReviewsCreated:0};
}
const invokedDirectly=()=>{try{return Boolean(process.argv[1])&&pathToFileURL(realpathSync(resolve(process.argv[1]))).href===import.meta.url;}catch{return false;}};
if(invokedDirectly()){
 const args=process.argv.slice(2);if(args.length!==4||args.filter(x=>x==='--database').length!==1||args.filter(x=>x==='--org').length!==1||args.some((x,i)=>i%2===0&&!['--database','--org'].includes(x)))throw Error('Usage: node scripts/seed-arts-production.mjs --database EXISTING_DB --org AUDITED_SINGLE_ORG');
 const file=resolve(args[args.indexOf('--database')+1]),org=args[args.indexOf('--org')+1];assert.ok(existsSync(file),'Existing database required; refusing to create a new production database');
 const db=openDatabase(file);try{console.log(JSON.stringify(await initializeArtsProduction(db,org)));}finally{db.sqlite.close();}
}
