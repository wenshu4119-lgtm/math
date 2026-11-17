import {readFileSync,existsSync} from 'node:fs';
import {importBank,bankCatalog} from '../src/question-bank-import.mjs';
import {applyRecheckBatch} from '../src/question-bank-recheck.mjs';
export async function installPracticeBatches(f){
 await importBank(f.DB,f.org);
 const english=existsSync(new URL('../data/question-bank/rechecks/english-recheck-v3.json',import.meta.url))?'english-recheck-v3.json':'english-recheck-v2.json';
 const files=['math-recheck-v2.json',english],expectedIds=new Set(bankCatalog.records.filter(r=>r.validation.status==='passed').map(r=>r.question.id));
 for(const file of files){const report=JSON.parse(readFileSync(new URL('../data/question-bank/rechecks/'+file,import.meta.url),'utf8'));for(const b of report.batches){const records=report.records.filter(r=>b.questionIds.includes(r.questionId));const result=await applyRecheckBatch(f.DB,f.org,{id:b.id,subject:b.subject,grade:b.grade,checker:report.checker||report.validator,records});if(result.conflicts.length)throw Error('Unexpected fixture batch conflict');for(const record of records){expectedIds.delete(record.questionId);if(record.decision==='passed')expectedIds.add(record.questionId);}}}
 return {files,expectedPractice:expectedIds.size,expectedIds:[...expectedIds].sort()};
}
