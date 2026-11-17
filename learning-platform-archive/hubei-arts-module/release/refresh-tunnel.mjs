// Run only after the trial tunnel restarts. Does not register a new tunnel or DNS name.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {cf,worker} from './cf-client.mjs';
const root=new URL('../',import.meta.url);
const result=spawnSync('C:/Users/Administrator/AppData/Local/Python/pythoncore-3.14-64/python.exe',['-B','release/vps-ops.py','status'],{cwd:root,encoding:'utf8',windowsHide:true});
if(result.status!==0)throw Error('VPS status failed');
const status=JSON.parse(readFileSync(new URL('../.local/vps/current-status.json',import.meta.url),'utf8'));
const runtime=JSON.parse(readFileSync(new URL('../.local/vps/runtime.json',import.meta.url),'utf8'));
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(status.backendOrigin||''))throw Error('No valid tunnel endpoint');
const health=await fetch(status.backendOrigin+'/api/v1/health',{headers:{'X-Trial-Bridge':runtime.BRIDGE_SECRET}});
if(health.status!==200)throw Error('Authenticated backend health failed');
const path=new URL('../wrangler.jsonc',import.meta.url),config=JSON.parse(readFileSync(path,'utf8'));
if(config.name!==worker||config.main!=='release/worker-vps.mjs')throw Error('Trial-only guard failed');
config.vars.TRIAL_BACKEND_ORIGIN=status.backendOrigin;writeFileSync(path,JSON.stringify(config,null,2));
const deploy=spawnSync(process.execPath,['C:/Users/Administrator/Desktop/junior-learning-platform/node_modules/wrangler/bin/wrangler.js','deploy'],{cwd:root,stdio:'inherit',windowsHide:true});
if(deploy.status!==0)throw Error('Gateway update failed');
const versions=await cf(`/workers/scripts/${worker}/deployments`),ledger=new URL('deployment.json',import.meta.url),state=JSON.parse(readFileSync(ledger,'utf8'));state.activeVersion=versions.deployments[0].versions[0].version_id;writeFileSync(ledger,JSON.stringify(state,null,2));console.log('Trial tunnel rebound; private credential was not printed.');
