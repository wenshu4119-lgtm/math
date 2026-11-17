import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate} from './local-db.mjs';
import {applyRecheckBatch,rollbackRecheckBatch} from '../src/question-bank-recheck.mjs';
const args=process.argv.slice(2),value=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:null;
if(!value('--database'))throw Error('Explicit --database path required');
const db=openDatabase(value('--database'));
try{
 migrate(db);let org=value('--org');if(!org){const orgs=db.sqlite.prepare('SELECT id FROM organizations').all();if(orgs.length!==1)throw Error('Explicit --org required for multiple organizations');org=orgs[0].id;}
 if(!db.sqlite.prepare('SELECT id FROM organizations WHERE id=?').get(org))throw Error('Organization not found');
 if(value('--rollback'))console.log(JSON.stringify(await rollbackRecheckBatch(db,org,value('--rollback'))));
 else{
  const file=resolve(value('--report')||'');if(!file.endsWith('.json'))throw Error('Explicit packaged --report JSON required');
  const report=JSON.parse(readFileSync(file,'utf8'));if(report.schemaVersion!==2)throw Error('Recheck schema 2 required');
  const selected=report.batches.filter(b=>!value('--batch')||b.id===value('--batch'));if(!selected.length)throw Error('Unknown batch');
  const results=[];
  for(const batch of selected){
   const records=report.records.filter(r=>batch.questionIds.includes(r.questionId));if(records.length!==batch.questionIds.length)throw Error('Batch question IDs do not match report');
   results.push(await applyRecheckBatch(db,org,{id:batch.id,subject:batch.subject,grade:batch.grade,checker:report.checker||report.validator,records}));
  }
  console.log(JSON.stringify({report:file.split(/[\\/]/).at(-1),results}));
 }
}finally{db.sqlite.close();}
