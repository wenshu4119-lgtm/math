// Export bootstrap users and original samples to local Wrangler only. Never target remote D1.
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { openDatabase } from './local-db.mjs';
import { root } from './environment.mjs';
const db=openDatabase(join(root,'.local','learning.sqlite'));
const quote=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const tables=['organizations','users','relationships','knowledge','questions'];const statements=['PRAGMA foreign_keys=ON;'];
for(const table of tables){const rows=db.sqlite.prepare(`SELECT * FROM ${table}`).all();for(const row of rows)statements.push(`INSERT OR IGNORE INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(quote).join(',')});`);}
const path=join(root,'.local','pages-bootstrap.sql');writeFileSync(path,statements.join('\n'));db.sqlite.close();
const args=[join(root,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','DB','--local','--file',path];
if(process.argv.includes('--isolated-draft-tests'))args.push('--persist-to',join(root,'.local/workerd-stage8-tests'));
else if(process.argv.includes('--isolated-teacher-tests'))args.push('--persist-to',join(root,'.local/workerd-stage7-tests'));
else if(process.argv.includes('--isolated-pack-tests'))args.push('--persist-to',join(root,'.local/workerd-stage6-tests'));
else if(process.argv.includes('--isolated-scope-tests'))args.push('--persist-to',join(root,'.local/workerd-stage5-tests'));
else if(process.argv.includes('--isolated-homework-tests'))args.push('--persist-to',join(root,'.local/workerd-stage4-tests'));
else if(process.argv.includes('--isolated-ocr-tests'))args.push('--persist-to',join(root,'.local/workerd-stage3-tests'));
else if(process.argv.includes('--isolated-tests'))args.push('--persist-to',join(root,'.local/workerd-stage2-tests'));
const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});process.exitCode=result.status??1;
