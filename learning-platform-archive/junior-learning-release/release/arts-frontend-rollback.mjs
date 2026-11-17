import fs from 'node:fs';import{cf}from './cf-client.mjs';
if(process.argv[2]!=='--frontend')throw Error('Use --frontend; read ARTS-PRODUCTION-REPORT.md for backend rollback first.');
const r=JSON.parse(fs.readFileSync('release/arts-production.json')),path='/workers/scripts/learning-platform-production/deployments',v=(await cf(path)).deployments[0].versions;
if(v.length!==1||![r.workerVersion,r.previousWorkerVersion].includes(v[0].version_id))throw Error('Another deployment is active; re-audit before rollback.');
if(v[0].version_id!==r.previousWorkerVersion)await cf(path,{method:'POST',body:{strategy:'percentage',versions:[{version_id:r.previousWorkerVersion,percentage:100}]}});
if((await cf(path)).deployments[0].versions[0].version_id!==r.previousWorkerVersion)throw Error('Rollback not verified');
const file='release/production-deployment.json',d=JSON.parse(fs.readFileSync(file));d.activeVersion=r.previousWorkerVersion;d.artsFrontendRolledBackAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(d,null,2));console.log({frontend:r.previousWorkerVersion,databaseReplaced:false,artsDataPreserved:true});
