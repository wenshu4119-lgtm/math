// Independently restore the latest existing encrypted backup. No production writes.
import {readdirSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {verifyBackup,decryptBackup} from './production-backup.mjs';
import {readProductionSecrets} from './production-secrets.mjs';
import {handleApi} from '../src/api.mjs';
const directory='.local/production/backups',archive=readdirSync(directory).filter(n=>/^learning-platform-[A-Za-z0-9-]+\.lpbak$/.test(n)).sort().at(-1);
if(!archive)throw Error('No encrypted production backup available');
const file=directory+'/'+archive,hash=b=>createHash('sha256').update(b).digest('hex'),encryptedSha=hash(readFileSync(file));
const {backupPrivateKey}=readProductionSecrets(),verified=await verifyBackup({input:file,privateKey:backupPrivateKey});
const outputDir='.local/production/referral-restore-'+Date.now();await decryptBackup({input:file,outputDir,privateKey:backupPrivateKey});
const dbPath=outputDir+'/learning.sqlite',before=hash(readFileSync(dbPath)),sqlite=new DatabaseSync(dbPath,{readOnly:true});sqlite.exec('PRAGMA query_only=ON');
const DB={prepare(sql){const statement=sqlite.prepare(sql);return{params:[],bind(...params){this.params=params;return this;},first(){return statement.get(...this.params)??null;},all(){return{results:statement.all(...this.params)};},run(){throw Error('Restore verification refuses writes');}};},batch(){throw Error('Restore verification refuses batches');}};
try{const integrity=sqlite.prepare('PRAGMA integrity_check').get().integrity_check;if(integrity!=='ok'||sqlite.prepare('PRAGMA foreign_key_check').all().length)throw Error('Restored database is invalid');const env={DB,APP_ENV:'local',APP_ORIGIN:'http://127.0.0.1:18792',SESSION_SECRET:randomBytes(32).toString('hex')};const health=await handleApi(new Request(env.APP_ORIGIN+'/api/v1/health'),env),students=await handleApi(new Request(env.APP_ORIGIN+'/api/v1/students'),env);if(health.status!==200||students.status!==401)throw Error('Restored API boundary failed');
 const result={checkedAt:new Date().toISOString(),archive,...verified,encryptedSha256:encryptedSha,sqliteIntegrity:integrity,foreignKeysValid:true,restoredApiHealth:health.status,anonymousStudents:students.status,productionUntouched:true,restoreDirectory:outputDir,restoredDatabaseSha256:before};mkdirSync('test-results/referral-production',{recursive:true});writeFileSync('test-results/referral-production/restore-check.json',JSON.stringify(result,null,2));writeFileSync('test-results/referral-production/restore-check-'+Date.now()+'.json',JSON.stringify(result,null,2));console.log({archive,verified:result.verified,releaseVersion:result.releaseVersion,sqliteIntegrity:integrity,restoredApiHealth:health.status,anonymousStudents:students.status,productionUntouched:true});
}finally{sqlite.close();if(hash(readFileSync(dbPath))!==before||hash(readFileSync(file))!==encryptedSha)throw Error('Verification unexpectedly changed a backup');}
