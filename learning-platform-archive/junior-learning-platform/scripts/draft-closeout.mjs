import {readFileSync,readdirSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {root} from './environment.mjs';
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
const snapshot=join(root,'.local/stage7-before-ai'),publicFiles=files(join(root,'public'));
const publicChanged=publicFiles.filter(p=>!existsSync(join(snapshot,relative(root,p)))||sha(p)!==sha(join(snapshot,relative(root,p)))).map(p=>relative(root,p));
const changed=[];for(const folder of ['src','migrations','scripts','tests','docs','integrations'])for(const path of files(join(root,folder)).filter(p=>!/__pycache__|\.pyc$/.test(p))){const name=relative(root,path).replaceAll('\\','/'),old=join(snapshot,name);if(!existsSync(old)||sha(path)!==sha(old))changed.push({path:name,sha256:sha(path)});}
const db=new DatabaseSync(join(root,'.local/learning.sqlite'),{readOnly:true}),counts={};try{for(const table of ['knowledge','questions','content_reviews','attempts','packs','homeworks','draft_sources','question_drafts']){const exists=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);counts[table]=exists?db.prepare('SELECT COUNT(*) n FROM '+table).get().n:'migration_not_applied';}}finally{db.close();}
const oldRepo='C:/Users/Administrator/Desktop/cloudflare-deploy';const tracked=execFileSync('git',['diff','HEAD','--'],{cwd:oldRepo,encoding:'utf8'}),head=execFileSync('git',['rev-parse','HEAD'],{cwd:oldRepo,encoding:'utf8'}).trim();
const result={observedAt:new Date().toISOString(),publicFilesCompared:publicFiles.length,publicChanged,oldMathHead:head,oldMathTrackedDiffEmpty:tracked==='',ordinaryDemoReadOnlyCounts:counts,changedBackendAndHandoffFiles:changed,notice:'Only changed backend/migration/test/contract/handoff paths are candidates for website-thread review. No deployment, Android build or VPS mutation in this thread.'};
mkdirSync(join(root,'test-results/stage8'),{recursive:true});writeFileSync(join(root,'test-results/stage8/closeout.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({publicFilesCompared:publicFiles.length,publicChanged,oldMathTrackedDiffEmpty:tracked==='',ordinaryDemoReadOnlyCounts:counts,changedFileCount:changed.length}));if(publicChanged.length||tracked!=='')process.exitCode=2;
