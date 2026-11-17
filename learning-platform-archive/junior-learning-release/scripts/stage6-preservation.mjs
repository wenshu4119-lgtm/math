import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,relative,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {root} from './environment.mjs';
const old=resolve(root,'../cloudflare-deploy'),prototype=join(old,'platform-ui'),out=join(root,'test-results/stage6');mkdirSync(out,{recursive:true});
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const files=[];function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.')||e.name==='node_modules')continue;const path=join(dir,e.name);if(e.isDirectory())walk(path);else files.push({path:relative(prototype,path).replaceAll('\\','/'),sha256:hash(path)});}}walk(prototype);
const actual={oldHead:execFileSync('git',['rev-parse','HEAD'],{cwd:old,encoding:'utf8'}).trim(),oldTrackedDiff:execFileSync('git',['diff','--numstat'],{cwd:old,encoding:'utf8'}),prototypeFiles:files};
const baselinePath=join(out,'preservation-baseline.json');
if(process.argv.includes('--create')){try{readFileSync(baselinePath);throw new Error('Baseline exists; do not overwrite it');}catch(error){if(error.code!=='ENOENT')throw error;}writeFileSync(baselinePath,JSON.stringify(actual,null,2));console.log(`Saved current prototype baseline: ${files.length} files; old tracked diff captured.`);}
else{const baseline=JSON.parse(readFileSync(baselinePath)),before=new Map(baseline.prototypeFiles.map(f=>[f.path,f.sha256])),after=new Map(files.map(f=>[f.path,f.sha256]));const changes=[...new Set([...before.keys(),...after.keys()])].filter(path=>before.get(path)!==after.get(path)).map(path=>({path,before:before.get(path)||null,after:after.get(path)||null}));const oldTrackedUnchanged=actual.oldHead===baseline.oldHead&&actual.oldTrackedDiff===baseline.oldTrackedDiff,matched=oldTrackedUnchanged&&!changes.length;writeFileSync(join(out,'preservation-result.json'),JSON.stringify({matched,oldTrackedUnchanged,checked:files.length,changes,...actual,notice:'Baseline retained. Concurrent prototype updates are recorded without overwriting or resetting them.'},null,2));console.log(JSON.stringify({matched,oldTrackedUnchanged,checked:files.length,parallelChanges:changes.map(c=>c.path)}));if(!matched)process.exitCode=2;}
