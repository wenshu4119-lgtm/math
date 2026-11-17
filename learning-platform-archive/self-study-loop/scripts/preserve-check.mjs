import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {root} from './environment.mjs';
const source=resolve(root,'../cloudflare-deploy'),doc=readFileSync(join(root,'docs/ANTIGRAVITY-INTEGRATION.md'),'utf8');let count=0;const changes=[],baseline=new Map();
for(const match of doc.matchAll(/^\| ([^|]+?) \| `([0-9a-f]{64})` \|$/gm)){const path=match[1];assert(!path.includes('..'));const bytes=readFileSync(join(source,'platform-ui',path)),actual=createHash('sha256').update(bytes).digest('hex');baseline.set(path,match[2]);if(actual!==match[2])changes.push({path,expected:match[2],actual});count++;}
assert.equal(count,12);execFileSync('git',['-C',source,'diff','--exit-code'],{stdio:'pipe'});
for(const name of ['tokens','layout','components'])assert.equal(createHash('sha256').update(readFileSync(join(root,`public/styles/prototype-${name}.css`))).digest('hex'),baseline.get(`styles/${name}.css`),'Integrated CSS changed from pinned initial prototype');
mkdirSync(join(root,'test-results'),{recursive:true});writeFileSync(join(root,'test-results/prototype-preservation.json'),JSON.stringify({trackedMathUnchanged:true,pinnedCssUnchanged:true,checked:count,unchanged:count-changes.length,changes,notice:'The original directory was only read by this task. Concurrent changes are recorded, never overwritten or silently relabeled as unchanged.'},null,2));
console.log(`旧math tracked diff为空；整合样式与起始版本一致。原型 ${count-changes.length}/${count} 文件未变化，${changes.length} 个并行变化已登记，未覆盖。`);
if(changes.length)process.exitCode=2;
