// Switch only the verified frontend version. Follow the documented backend rollback first.
import fs from 'node:fs';
import {cf} from './cf-client.mjs';
if(process.argv[2]!=='--frontend'||process.argv.length!==3)throw Error('Use --frontend after reading TIME-PLAN-PRODUCTION-REPORT.md');
const r=JSON.parse(fs.readFileSync('release/time-plan-production.json')),route='/workers/scripts/learning-platform-production/deployments',versions=(await cf(route)).deployments[0].versions;
const known=new Set([r.previousWorkerVersion,...(r.workerVersions||[]),r.workerVersion]);
if(versions.length!==1||!known.has(versions[0].version_id))throw Error('Another deployment is active; no rollback was executed');
if(versions[0].version_id!==r.previousWorkerVersion)await cf(route,{method:'POST',body:{strategy:'percentage',versions:[{version_id:r.previousWorkerVersion,percentage:100}]}});
if((await cf(route)).deployments[0].versions[0].version_id!==r.previousWorkerVersion)throw Error('Frontend rollback was not verified');
const d=JSON.parse(fs.readFileSync('release/production-deployment.json'));d.activeVersion=r.previousWorkerVersion;d.timePlanFrontendRolledBackAt=new Date().toISOString();fs.writeFileSync('release/production-deployment.json',JSON.stringify(d,null,2));console.log({frontend:r.previousWorkerVersion,referralDataPreserved:true,databaseReplaced:false});
