import fs from 'node:fs';import{cf}from './cf-client.mjs';
if(process.argv[2]!=='--frontend')throw Error('Use --frontend; see CONTENT-ROUND2-REPORT.md for full rollback.');
const r=JSON.parse(fs.readFileSync('release/content-round2.json')),path='/workers/scripts/learning-platform-production/deployments',current=(await cf(path)).deployments[0].versions;
if(current.length!==1||![r.workerVersion,r.previousWorkerVersion].includes(current[0].version_id))throw Error('A newer/different deployment is active; re-audit first.');
if(current[0].version_id!==r.previousWorkerVersion)await cf(path,{method:'POST',body:{strategy:'percentage',versions:[{version_id:r.previousWorkerVersion,percentage:100}]}});
if((await cf(path)).deployments[0].versions[0].version_id!==r.previousWorkerVersion)throw Error('Rollback not verified');
const p='release/production-deployment.json',d=JSON.parse(fs.readFileSync(p));d.activeVersion=r.previousWorkerVersion;d.round2FrontendRolledBackAt=new Date().toISOString();fs.writeFileSync(p,JSON.stringify(d,null,2));console.log({frontend:r.previousWorkerVersion,databaseReplaced:false});
