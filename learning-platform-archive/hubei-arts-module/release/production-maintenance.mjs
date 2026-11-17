import fs from'node:fs';import{cf}from'./cf-client.mjs';
const action=process.argv[2];if(!['--on','--off'].includes(action))throw Error('Choose --on or --off');const file='release/production-deployment.json',d=JSON.parse(fs.readFileSync(file,'utf8'));
const id=action==='--on'?d.maintenanceVersion:d.activeVersion;if(!id)throw Error('Verified version missing');
await cf('/workers/scripts/learning-platform-production/deployments',{method:'POST',body:{strategy:'percentage',versions:[{version_id:id,percentage:100}]}});
let status;for(let n=0;n<15;n++){status=(await fetch('https://mrxu.uk/api/v1/health',{cache:'no-store'})).status;if(status===(action==='--on'?503:200))break;await new Promise(r=>setTimeout(r,1000));}
if(status!==(action==='--on'?503:200))throw Error('Maintenance state not verified');d.lastMaintenanceCheck={action,status,at:new Date().toISOString()};fs.writeFileSync(file,JSON.stringify(d,null,2));console.log(d.lastMaintenanceCheck);
