import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {openDatabase} from '../scripts/local-db.mjs';
import {migrateReferralProduction,REFERRAL_TABLES,REFERRAL_MIGRATIONS,databaseTables,tableSnapshots} from '../scripts/migrate-referral-production.mjs';

function priorDatabase(){const db=openDatabase();db.sqlite.exec('CREATE TABLE local_migrations (name TEXT PRIMARY KEY)');for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')&&!REFERRAL_MIGRATIONS.includes(n)).sort()){db.sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));db.sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(name);}db.sqlite.prepare('INSERT INTO organizations VALUES (?,?)').run('simulation-org','Synthetic migration fixture');db.sqlite.prepare('INSERT INTO users (id,org_id,username,display_name,role,password_hash,created_at) VALUES (?,?,?,?,?,?,?)').run('simulation-user','simulation-org','migration-fixture','合成账号','student','invalid-test-hash',new Date().toISOString());db.sqlite.prepare("INSERT INTO attempts (id,org_id,student_id,subject,phase,status,created_by,created_at,correct,total) VALUES ('legacy-attempt','simulation-org','simulation-user','math','diagnostic','submitted','simulation-user',?,0,1)").run(new Date().toISOString());db.sqlite.prepare("INSERT INTO arts_content_versions (org_id,point_id,version,subject,payload_json,status,reason,created_at) VALUES ('simulation-org','existing-arts-point',2,'math',?,'pending_human','Synthetic historical content',?)").run(JSON.stringify({simulation:true,unchangedText:'旧艺考内容保留'}),new Date().toISOString());return db;}

test('additive referral migration preserves every existing row and schema, leaves all new tables empty and repeats idempotently',()=>{const db=priorDatabase();try{const names=databaseTables(db),before=tableSnapshots(db),first=migrateReferralProduction(db);assert.deepEqual(first.newTables,REFERRAL_TABLES);assert.equal(first.seedPerformed,false);assert.equal(first.allReferralTablesEmpty,true);assert.deepEqual(tableSnapshots(db,names.filter(n=>n!=='local_migrations')),before);assert.ok(Object.values(first.referralCounts).every(n=>n===0));assert.deepEqual(first.appliedMigrations,REFERRAL_MIGRATIONS);const once=tableSnapshots(db,databaseTables(db)),second=migrateReferralProduction(db);assert.deepEqual(second.appliedMigrations,[]);assert.deepEqual(second.newTables,[]);assert.deepEqual(tableSnapshots(db,databaseTables(db)),once);assert.equal(db.sqlite.prepare('SELECT correct FROM attempts').get().correct,0);assert.equal(db.sqlite.prepare('SELECT version FROM arts_content_versions').get().version,2);}finally{db.sqlite.close();}});

test('idempotent migration preserves subsequently created referral data instead of reseeding or clearing it',()=>{const db=priorDatabase();try{migrateReferralProduction(db);db.sqlite.prepare('INSERT INTO referral_meta (org_id,version,write_token) VALUES (?,?,?)').run('simulation-org',7,'simulation-token');db.sqlite.prepare('INSERT INTO referral_rules (org_id,version,payload_json,effective_at,reason) VALUES (?,?,?,?,?)').run('simulation-org',1,'{"simulation":true}',new Date().toISOString(),'Synthetic existing rule');const before=tableSnapshots(db,databaseTables(db));const r=migrateReferralProduction(db);assert.equal(r.allReferralTablesEmpty,false);assert.equal(r.businessRowsCreated,0);assert.deepEqual(tableSnapshots(db,databaseTables(db)),before);}finally{db.sqlite.close();}});

test('partial or untracked referral schemas fail without changing existing rows or migration registration',()=>{const db=priorDatabase();try{db.sqlite.exec('CREATE TABLE referral_unexpected (id TEXT PRIMARY KEY)');const before=tableSnapshots(db,databaseTables(db));assert.throws(()=>migrateReferralProduction(db),/partial or unknown/);assert.deepEqual(tableSnapshots(db,databaseTables(db)),before);}finally{db.sqlite.close();}});

test('idempotent migration rejects a missing unique index or altered referral schema without silently repairing it',()=>{for(const sql of ['DROP INDEX referral_one_live_order_proposal','ALTER TABLE referral_orders ADD COLUMN unexpected_note TEXT']){const db=priorDatabase();try{migrateReferralProduction(db);db.sqlite.exec(sql);const before=tableSnapshots(db,databaseTables(db));assert.throws(()=>migrateReferralProduction(db),/referral schema differs/);assert.deepEqual(tableSnapshots(db,databaseTables(db)),before);}finally{db.sqlite.close();}}});

test('registry disagreement and a missing established arts schema are refused rather than silently initialized',()=>{for(const scenario of ['registry','missing']){const db=priorDatabase();try{if(scenario==='registry')db.sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(REFERRAL_MIGRATIONS[0]);else db.sqlite.exec('DROP TABLE arts_reviews');const before=tableSnapshots(db,databaseTables(db));assert.throws(()=>migrateReferralProduction(db));assert.deepEqual(tableSnapshots(db,databaseTables(db)),before);}finally{db.sqlite.close();}}});

test('an accidental original-row and index change during migration is detected and rolled back with the new schema',()=>{const db=priorDatabase();try{const before=tableSnapshots(db,databaseTables(db)),execute=db.sqlite.exec.bind(db.sqlite);let injected=false;db.sqlite.exec=sql=>{const result=execute(sql);if(!injected&&sql.includes('CREATE TABLE referral_meta')){injected=true;execute("UPDATE arts_content_versions SET reason='synthetic accidental change'; CREATE INDEX unwanted_original_index ON attempts(status)");}return result;};assert.throws(()=>migrateReferralProduction(db),/existing table|row|index|trigger/);assert.equal(injected,true);assert.deepEqual(tableSnapshots(db,databaseTables(db)),before);assert.equal(databaseTables(db).filter(n=>n.startsWith('referral_')).length,0);}finally{db.sqlite.close();}});

test('CLI requires an explicit existing database and does not create a missing target',()=>{const cli=fileURLToPath(new URL('../scripts/migrate-referral-production.mjs',import.meta.url)),folder=mkdtempSync(join(tmpdir(),'referral-migration-cli-')),missing=join(folder,'missing.sqlite');for(const args of [[],['--database',missing],['--database',missing,'--org','unexpected']]){const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});assert.notEqual(r.status,0);assert.equal(existsSync(missing),false);}});

test('rehearsal excludes only the two verified top-level clock fields and retains all semantic and nested fields',()=>{const source=readFileSync(new URL('../release/referral-rehearsal.mjs',import.meta.url),'utf8'),code=source.match(/^function comparablePublicData[^\n]+$/m)[0],compare=runInNewContext('('+code+')',{assert});for(const[name,key]of [['junior','generatedAt'],['qa','checkedAt']]){const a={[key]:'2026-11-15T00:00:00.000Z',totals:{questions:1},nested:{[key]:'must remain exact'}},b={...a,[key]:'2026-11-15T00:01:00.000Z'};assert.equal(JSON.stringify(compare(name,a)),JSON.stringify(compare(name,b)));assert.notEqual(JSON.stringify(compare(name,a)),JSON.stringify(compare(name,{...b,totals:{questions:2}})));assert.notEqual(JSON.stringify(compare(name,a)),JSON.stringify(compare(name,{...b,nested:{[key]:'changed nested clock'}})));for(const bad of [null,'2026-02-30T00:00:00.000Z','2026-11-15','not-a-time'])assert.throws(()=>compare(name,{...a,[key]:bad}));assert.equal(a[key],'2026-11-15T00:00:00.000Z');}const arts={generatedAt:'keep everything',checkedAt:'keep this too'};assert.equal(compare('arts',arts),arts);});

test('deployment comparators and ownership/lock protocol are checked locally without loading SSH credentials or contacting a host',()=>{const file=fileURLToPath(new URL('../release/referral-production-upgrade.py',import.meta.url));const script=String.raw`
import ast,json,re,shlex,sys
from datetime import datetime
tree=ast.parse(open(sys.argv[1],encoding='utf-8').read())
names={'coverage_without_generated_at','qa_without_checked_at','ensure_recovery_ownership','RemoteOperationLock'}
selected=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in names]
scope={'json':json,'re':re,'shlex':shlex,'datetime':datetime,'TARGET':'/expected-target','PRIOR':'/expected-prior'}
exec(compile(ast.Module(body=selected,type_ignores=[]),'<selected-pure-deployment-helpers>','exec'),scope)
for name,key in [('coverage_without_generated_at','generatedAt'),('qa_without_checked_at','checkedAt')]:
 fn=scope[name];a={key:'2026-11-15T00:00:00.000Z','totals':{'n':1},'nested':{key:'exact'}};b={**a,key:'2026-11-15T00:00:01.000Z'}
 assert fn(a)==fn(b) and fn(a)!=fn({**b,'totals':{'n':2}}) and fn(a)!=fn({**b,'nested':{key:'changed'}})
 for value in [None,'2026-02-30T00:00:00.000Z','2026-11-15']:
  try:fn({**a,key:value});raise AssertionError('invalid clock accepted')
  except RuntimeError:pass
guard=scope['ensure_recovery_ownership']
for switched,current,ok in [(False,'/expected-prior',True),(False,'/expected-target',False),(False,'/unknown',False),(True,'/expected-target',True),(True,'/expected-prior',True),(True,'/unknown',False)]:
 try:guard(switched,current);assert ok
 except RuntimeError:assert not ok
class Channel:
 def __init__(self):self.exited=False;self.closed=False
 def exit_status_ready(self):return self.exited
 def close(self):self.closed=True
 def shutdown_write(self):pass
class Input:
 def __init__(self,channel):self.channel=channel;self.sent=''
 def write(self,value):self.sent+=value
 def flush(self):pass
class Output:
 def __init__(self,channel,lines):self.channel=channel;self.lines=list(lines)
 def readline(self):return self.lines.pop(0) if self.lines else ''
class Client:
 def __init__(self,lines):self.channel=Channel();self.stdin=Input(self.channel);self.stdout=Output(self.channel,lines);self.calls=[]
 def exec_command(self,command,timeout):self.calls.append(command);return self.stdin,self.stdout,None
client=Client([json.dumps({'acquired':True,'operationId':'own-token'}),json.dumps({'released':True,'operationId':'own-token'})]);lease=scope['RemoteOperationLock'](client,'own-token','activate');lease.acquire();lease.assert_held();program=shlex.split(client.calls[0])[-1];assert 'LOCK_EX|fcntl.LOCK_NB' in program and 'os.O_EXCL' in program and 'assert not os.path.lexists(owner)' in program;lease.release();assert client.stdin.sent=='own-token'+chr(10) and client.channel.closed
bad=Client(['']);lease=scope['RemoteOperationLock'](bad,'new-token','activate')
try:lease.acquire();raise AssertionError('missing owner acknowledgement accepted')
except RuntimeError:assert bad.stdin.sent=='' and bad.channel.closed
print('Pure comparators, recovery ownership, and stubbed lock protocol passed; no SSH or remote flock executed')
`;const r=spawnSync('python',['-B','-c',script,file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);});
