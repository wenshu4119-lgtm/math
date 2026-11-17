import {readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {verifyBackup,decryptBackup} from './production-backup.mjs';
import {readProductionSecrets} from './production-secrets.mjs';
import {openDatabase} from '../scripts/local-db.mjs';
import {handleApi} from '../src/api.mjs';
const folder='.local/production/backups';
const file=readdirSync(folder).filter(n=>n.endsWith('.lpbak')).sort().at(-1);
if(!file)throw Error('No encrypted backup downloaded');
const {backupPrivateKey}=readProductionSecrets();
const verified=await verifyBackup({input:folder+'/'+file,privateKey:backupPrivateKey});
const outputDir='.local/production/content-restore-'+Date.now();
await decryptBackup({input:folder+'/'+file,outputDir,privateKey:backupPrivateKey});
const DB=openDatabase(outputDir+'/learning.sqlite');
try {
 const integrity=DB.sqlite.prepare('PRAGMA integrity_check').get().integrity_check;
 if(integrity!=='ok'||DB.sqlite.prepare('PRAGMA foreign_key_check').all().length)throw Error('Restored database failed integrity checks');
 const env={DB,APP_ENV:'local',APP_ORIGIN:'http://127.0.0.1:18792',SESSION_SECRET:randomBytes(32).toString('hex')};
 const health=await handleApi(new Request(env.APP_ORIGIN+'/api/v1/health'),env);
 const privateRoute=await handleApi(new Request(env.APP_ORIGIN+'/api/v1/students'),env);
 if(health.status!==200||privateRoute.status!==401)throw Error('Restored backend boundary check failed');
 const result={checkedAt:new Date().toISOString(),archive:file,...verified,sqliteIntegrity:integrity,foreignKeysValid:true,restoredApiHealth:health.status,anonymousStudents:privateRoute.status,productionUntouched:true,restoreDirectory:outputDir};
 mkdirSync('test-results/content-release',{recursive:true});writeFileSync('test-results/content-release/restore-check.json',JSON.stringify(result,null,2));console.log(result);
}finally{DB.sqlite.close();}
