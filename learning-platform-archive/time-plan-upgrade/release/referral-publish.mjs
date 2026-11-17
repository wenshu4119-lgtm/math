// Local sole-publisher coordinator. A failed precheck cannot fall through to deploy.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {cf,account} from './cf-client.mjs';
const expected=process.argv[2];
if(!/^[a-f0-9-]{36}$/.test(expected||'')||process.argv.length!==3)throw Error('Pass the exact verified active Worker version');
const cli='C:/Users/Administrator/Desktop/junior-learning-platform/node_modules/wrangler/bin/wrangler.js';
const cfg=JSON.parse(fs.readFileSync('wrangler.production.jsonc','utf8'));
if(cfg.name!=='learning-platform-production'||cfg.account_id!==account||cfg.main!=='release/production-worker.mjs'||cfg.assets?.directory!=='public'||cfg.vars?.APP_ORIGIN!=='https://mrxu.uk'||cfg.vars?.BACKEND_ORIGIN!=='https://earning-origin.mrxu.uk'||cfg.vars?.MAINTENANCE!=='false')throw Error('Verified production configuration changed');
// Refresh only the already-authorized Wrangler credential; never start an account/login flow.
const auth=spawnSync(process.execPath,[cli,'whoami'],{encoding:'utf8',windowsHide:true,timeout:60000});
if(auth.error||auth.status!==0)throw Error('Existing Cloudflare authentication unavailable; deployment was not started');
const list=(await cf('/workers/scripts/learning-platform-production/deployments')).deployments;
if(list[0].versions.length!==1||list[0].versions[0].version_id!==expected)throw Error('Another Worker deployment is active; deployment was not started');
console.log(JSON.stringify({precheckPassed:true,expectedVersion:expected,worker:cfg.name,assets:'public'}));
const run=spawnSync(process.execPath,[cli,'deploy','--config','wrangler.production.jsonc'],{stdio:'inherit',windowsHide:true,timeout:180000});
if(run.error||run.status!==0)throw Error('Wrangler deployment did not complete; inspect the actual active version before retrying');
const current=(await cf('/workers/scripts/learning-platform-production/deployments')).deployments[0];
if(current.versions.length!==1)throw Error('Unexpected percentage rollout; re-audit required');
const record=JSON.parse(fs.readFileSync('release/referral-production.json'));record.workerVersion=current.versions[0].version_id;record.workerVersions=[...new Set([...(record.workerVersions||[]),record.workerVersion])];record.lastStaticPublishedAt=current.created_on;fs.writeFileSync('release/referral-production.json',JSON.stringify(record,null,2));
const general=JSON.parse(fs.readFileSync('release/production-deployment.json'));general.activeVersion=record.workerVersion;general.contentRelease=record.version;fs.writeFileSync('release/production-deployment.json',JSON.stringify(general,null,2));console.log(JSON.stringify({workerVersion:record.workerVersion,publishedAt:current.created_on,databaseModified:false}));
