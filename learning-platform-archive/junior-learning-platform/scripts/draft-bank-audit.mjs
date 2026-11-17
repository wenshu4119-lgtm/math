import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {fixture} from '../tests/helpers.mjs';
import {isolatedBankGroups} from '../src/draft-import.mjs';
import {root} from './environment.mjs';
const arg=process.argv.indexOf('--input');if(arg<0)throw new Error('Specify an authorized read-only draft JSON with --input. Only an isolated synthetic lab is written.');
const batchArg=process.argv.indexOf('--batches'),batches=batchArg<0?null:process.argv[batchArg+1].split(',').map(Number);
const raw=readFileSync(process.argv[arg+1],'utf8'),bank=isolatedBankGroups(raw,{batches}),f=await fixture(),checks=[];
try{
 const teacher=await f.login('teacher');
 for(const group of bank.groups){
  const source=await f.request('/draft-sources',{client:teacher,method:'POST',body:{requestId:crypto.randomUUID(),title:group.title,subject:group.subject,text:group.text,sourceLabel:`Antigravity隔离原创草稿声明；版本 ${bank.bankVersion}；SHA256 ${bank.digest}`,licenseDeclaration:'CC0-1.0',syntheticOnly:true,rightsConfirmed:true}});assert.equal(source.status,201);
  const s=source.data,questions=group.questions.map(({citationLines,...q})=>({...q,citations:[{sourceId:s.id,sourceVersion:s.version,digest:s.digest,lineStart:citationLines.start,lineEnd:citationLines.end,text:s.text.split('\n').slice(citationLines.start-1,citationLines.end).join('\n')}]}));
  const draft=await f.request('/question-drafts',{client:teacher,method:'POST',body:{requestId:crypto.randomUUID(),title:group.title,subject:group.subject,sourceIds:[s.id],questions}});assert.equal(draft.status,201);assert.equal(draft.data.status,'pending_human');assert.equal(draft.data.published,false);checks.push(`${group.key}: ${questions.length} pending_human, source digest/lines checked`);
 }
 const actual=f.DB.sqlite.prepare("SELECT SUM(json_array_length(questions_json)) n FROM draft_versions WHERE revision=1").get().n;assert.equal(actual,bank.questionCount);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM questions').get().n,12);assert.equal(f.DB.sqlite.prepare("SELECT COUNT(*) n FROM question_drafts WHERE status='accepted_isolated'").get().n,0);
 const folder=join(root,'.local/draft-bank-labs');mkdirSync(folder,{recursive:true});const name=`synthetic-${Date.now()}.sqlite`,target=join(folder,name);f.DB.sqlite.exec("VACUUM INTO '"+target.replaceAll("'","''")+"'");
 const result={inputDigest:bank.digest,bankVersion:bank.bankVersion,inputQuestions:bank.inputQuestionCount,selectedBatches:bank.selectedBatches,excludedIds:bank.excludedIds,isolatedLab:`.local/draft-bank-labs/${name}`,sources:bank.groups.length,batches:bank.groups.length,questions:actual,teacherReviewRecords:0,humanReviewsVerified:0,publishedQuestions:0,formalExampleQuestionsUnchanged:12,checks,notice:'Actual API persisted to isolated synthetic-account SQLite. Source CC0/original declaration is retained, not independently verified. No supplied expression executed, model called or ordinary database changed.'};
 mkdirSync(join(root,'test-results/stage8'),{recursive:true});writeFileSync(join(root,'test-results/stage8/draft-bank-audit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,checks:checks.length}));
}finally{f.close();}
