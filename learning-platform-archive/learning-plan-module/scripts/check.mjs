import { readdirSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { root } from './environment.mjs';
import {DRAFT_EXPORTS} from '../public/draft-export-registry.js';
import { EXPORTS } from '../public/export-registry.js';
let checked=0;
for(const dir of ['src','public','scripts','tests','functions']) {
  function walk(base){for(const e of readdirSync(base,{withFileTypes:true})){if(e.name==='fixtures')continue;const path=join(base,e.name);if(e.isDirectory())walk(path);else if(/\.(mjs|cjs|js)$/.test(e.name)){const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);checked++;}}}walk(join(root,dir));
}
const spec=JSON.parse(readFileSync(join(root,'docs/openapi.json'),'utf8'));assert.equal(spec.openapi,'3.1.0');assert(spec.paths['/packs/{id}/worksheet']);
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));assert(!Object.keys(pkg.scripts).some(k=>/deploy|push/.test(k)));
const app=readFileSync(join(root,'public/app.js'),'utf8')+readFileSync(join(root,'public/teacher-workspace.js'),'utf8')+readFileSync(join(root,'public/teacher-editors.js'),'utf8')+readFileSync(join(root,'public/pack-workspace.js'),'utf8')+readFileSync(join(root,'public/paper-workspace.js'),'utf8')+readFileSync(join(root,'public/homework-workspace.js'),'utf8')+readFileSync(join(root,'public/ocr-workspace.js'),'utf8'),loader=readFileSync(join(root,'public/print-data.js'),'utf8');
for(const kind of Object.keys(EXPORTS)){if(Object.hasOwn(DRAFT_EXPORTS,kind)){assert(readFileSync(join(root,'public/draft-workspace.js'),'utf8').includes(kind),`Missing visible draft export: ${kind}`);assert(loader.includes('loadDraftDocument'));continue;}assert(app.includes(`'${kind}'`),`Missing visible export entry: ${kind}`);assert(loader.includes(`'${kind}'`),`Missing export loader: ${kind}`);}
assert(!app.includes('innerHTML'));assert(!readFileSync(join(root,'public/sw.js'),'utf8').includes("'/print.html'"));
const publicFiles=readdirSync(join(root,'public'));assert(!publicFiles.some(f=>/env|sqlite|account|content\.mjs/.test(f)));
console.log(`语法检查 ${checked} 文件；API契约、安全静态边界、${Object.keys(EXPORTS).length} 类导出登记和入口通过。`);
