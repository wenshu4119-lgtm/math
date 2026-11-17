// Run ONLY against the explicitly isolated local Wrangler state documented in README.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './environment.mjs';
if(!process.argv.includes('--isolated-tests'))throw new Error('Use --isolated-tests only with .local/workerd-stage2-tests server');
const origin='http://127.0.0.1:8788',credentials=readFileSync(join(root,'.local/accounts.txt'),'utf8').split(/\r?\n/).find(l=>l.startsWith('teacher\t')).split('\t');let cookie,csrf;const checks=[];
async function req(path,method='GET',body){const res=await fetch(origin+'/api/v1'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='GET'?{}:{Origin:origin,'X-CSRF-Token':csrf||'','Content-Type':'application/json'})},body:body?JSON.stringify(body):undefined});const result=await res.json();return {status:res.status,data:result.data,error:result.error,res};}
const logged=await req('/auth/login','POST',{username:'teacher',password:credentials[2]});assert.equal(logged.status,200);cookie=logged.res.headers.get('set-cookie').split(';')[0];csrf=logged.data.csrfToken;
try{
  const student=(await req('/students')).data[0];assert(student);const p=(await req('/papers','POST',{studentId:student.id,subject:'math',title:'隔离 workerd 本机验收',kind:'scored_paper',requestId:crypto.randomUUID()})).data;assert.equal(p.status,'draft');checks.push('D1 draft creation');
  const item={questionNo:'21(1)',prompt:'隔离合成：1/3+1/6',qtype:'solution',mappingLevel:'chapter',scopeText:'人工确认到章节',maxScore:4,earnedScore:2.5,reviewed:true};
  const saves=await Promise.all([req(`/papers/${p.id}`,'PATCH',{revision:1,title:p.title,items:[item]}),req(`/papers/${p.id}`,'PATCH',{revision:1,title:p.title,items:[{...item,earnedScore:3.5}]})]);assert.deepEqual(saves.map(r=>r.status).sort(),[200,409]);checks.push('D1 concurrent CAS and token-gated item writes');
  const stored=(await req(`/papers/${p.id}`)).data;assert.equal(stored.items[0].earnedScore,saves.find(r=>r.status===200).data.items[0].earnedScore);checks.push('losing draft save did not change items');
  const confirms=await Promise.all([req(`/papers/${p.id}/confirm`,'POST',{revision:stored.revision,confirmed:true}),req(`/papers/${p.id}/confirm`,'POST',{revision:stored.revision,confirmed:true})]);assert.deepEqual(confirms.map(r=>r.status).sort(),[200,409]);checks.push('single finalization under concurrency');
  const report=(await req(`/papers/${p.id}/report`)).data;assert.equal(report.report.score.max,4);assert.equal(report.report.score.earned,stored.items[0].earnedScore);checks.push('real partial-score report');
  const growth=(await req(`/students/${student.id}/growth`)).data;assert(growth.paperEvidence.some(x=>x.id===p.id));assert(!growth.evidence.some(x=>x.id===p.id));checks.push('paper evidence separated from choice attempts');
  assert.equal((await req(`/papers/${p.id}`,'PATCH',{revision:report.revision,title:'overwrite',items:[]})).status,409);checks.push('confirmed record immutable');
}finally{await req('/auth/logout','POST');}
mkdirSync(join(root,'test-results'),{recursive:true});writeFileSync(join(root,'test-results/workerd-paper-smoke.json'),JSON.stringify({passed:checks.length,checks,state:'.local/workerd-stage2-tests',scope:'isolated local D1 workerd; synthetic records only; no production or normal demo data writes'},null,2));console.log(`workerd人工阅卷 ${checks.length}/${checks.length} 通过；记录仅留在隔离本地测试状态。`);
