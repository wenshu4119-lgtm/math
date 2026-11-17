import {readFileSync,writeFileSync} from 'node:fs';
import {cf,worker,origin} from './cf-client.mjs';
const action=process.argv[2];if(!['--maintenance','--resume'].includes(action))throw Error('Choose --maintenance or --resume');
const path=new URL('deployment.json',import.meta.url),state=JSON.parse(readFileSync(path,'utf8'));
if(state.worker!==worker||!state.vpsMaintenanceVersion||!state.activeVersion)throw Error('Verified trial version IDs required');
const selected=action==='--maintenance'?state.vpsMaintenanceVersion:state.activeVersion;
await cf(`/workers/scripts/${worker}/deployments`,{method:'POST',body:{strategy:'percentage',versions:[{version_id:selected,percentage:100}]}});
const expected=action==='--maintenance'?503:200;
let status;
for(let i=0;i<10;i++){status=(await fetch(origin+'/api/v1/health',{cache:'no-store'})).status;if(status===expected)break;await new Promise(r=>setTimeout(r,1000));}
if(status!==expected)throw Error('Deployment state not yet verified');
state.lastRollbackCheck={action,version:selected,status,at:new Date().toISOString()};writeFileSync(path,JSON.stringify(state,null,2));console.log(JSON.stringify(state.lastRollbackCheck));
