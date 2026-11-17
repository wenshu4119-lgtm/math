// Read current legacy source; execute only four reviewed pure functions in an isolated VM.
// No old app initialization, writes, deploy scripts, network, models or real student data.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fixture} from '../../tests/helpers.mjs';
import {root} from '../environment.mjs';
const old=resolve(root,'../cloudflare-deploy'),source=readFileSync(join(old,'app.js'),'utf8');
function extract(name){const start=source.indexOf(`  function ${name}(`),end=source.indexOf('\n  }',start);assert(start>=0&&end>start);return source.slice(start,end+4);}
const code=['entryKey','diffAt','buildQuestionsForEntry','buildAllQuestions'].map(extract).join('\n');
function entry(sub,n,count){return {sub,modKey:'synthetic-module',chapKey:'chapter-'+n,chapName:'合成章节'+n,kps:Object.fromEntries(Array.from({length:count},(_,i)=>['point-'+i,'合成知识点'+i]))};}
function run(name,entries,subjects,max){const ctx=vm.createContext({FLOW:{maxQuestions:max,weights:{math:30,physics:18,chem:12}},STATE:{subjects},entries});vm.runInContext(code,ctx,{timeout:1000});const rows=JSON.parse(JSON.stringify(vm.runInContext('buildAllQuestions(entries,e=>Object.keys(e.kps))',ctx,{timeout:1000})));const chosen=entries.flatMap(e=>Object.keys(e.kps).map(k=>`${e.sub}/${e.chapKey}/${k}`)),actual=[...new Set(rows.map(q=>`${q.subject}/${q.chapKey}/${q.kpKey}`))],omitted=chosen.filter(id=>!actual.includes(id));assert(rows.every(q=>q.score===3&&!('prompt'in q)&&!('options'in q)&&!('correctOption'in q)));return {name,configuredCap:max,selectedChapters:entries.length,selectedPoints:chosen.length,rows:rows.length,chaptersCovered:new Set(rows.map(q=>`${q.subject}/${q.chapKey}`)).size,pointsCovered:actual.length,omitted,subjectsCovered:[...new Set(rows.map(q=>q.subject))],difficultyLabels:[...new Set(rows.map(q=>q.diff))],generatedValidatedQuestions:false};}
const cases=[run('one chapter, 12 selected points',[entry('math',1,12)],['math'],60),run('16 chapters exceed single-subject 45 slots',Array.from({length:16},(_,i)=>entry('math',i,1)),['math'],60),run('synthetic cap 8 is below per-subject minimum',[entry('math',1,1),entry('physics',1,1)],['math','physics'],8),run('same point receives positional difficulty labels',[entry('math',1,1)],['math'],60)];
assert.deepEqual(cases.slice(0,3).map(x=>[x.rows,x.pointsCovered,x.omitted.length]),[[9,9,3],[45,15,1],[8,1,1]]);assert.equal(cases[3].difficultyLabels.length,3);
const f=await fixture();let platform;
try{
  const teacher=await f.login('teacher'),student=await f.login('student'),ids=Array.from({length:21},(_,i)=>`capacity-test-${i+1}`);
  for(const id of ids){f.DB.sqlite.prepare('INSERT INTO knowledge (id,subject,title,explanation,memory_card,version,source) VALUES (?,\'math\',?,?,?,1,?)').run(id,'合成容量占位 '+id,'只用于接口容量测试，不是教学内容','不用于真实学习','synthetic boundary fixture, not verified curriculum');f.DB.sqlite.prepare('INSERT INTO questions VALUES (?,?,?,?,?,?,?,?)').run(id+'-diagnostic',id,'diagnostic','合成接口容量占位',JSON.stringify(['A','B','C','D']),0,'不作教学或判分验证','capacity fixture only');await f.request(`/content/${id}/review`,{client:teacher,method:'POST',body:{version:1,confirmed:true}});}
  const create=knowledgeIds=>f.request('/attempts',{client:student,method:'POST',body:{studentId:student.id,subject:'math',phase:'diagnostic',knowledgeIds}});
  const tooMany=await create(ids);assert.equal(tooMany.status,400);assert.equal(tooMany.error.code,'INVALID_SCOPE');assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM attempts').get().n,0);
  const accepted=await create(ids.slice(0,20));assert.equal(accepted.status,201);assert.equal(accepted.data.questions.length,20);assert.deepEqual(accepted.data.scope.topics.map(k=>k.id).sort(),ids.slice(0,20).sort());
  platform={requestedOverLimit:21,status:tooMany.status,error:tooMany.error.code,overLimitCreatedRecords:0,acceptedRequested:20,actualQuestions:20,omitted:[],notice:'21 synthetic placeholder topics exist only in this in-memory fixture. Automated teacher-role approvals are not real curriculum review. No answers or scores submitted.'};
}finally{f.close();}
const result={oldHead:execFileSync('git',['rev-parse','HEAD'],{cwd:old,encoding:'utf8'}).trim(),workingAppSha256:createHash('sha256').update(source).digest('hex'),cases,platform,conclusion:'Legacy output is manual 0–3 observation slots with positional difficulty, not validated questions. Slicing can omit selected points/chapters/subjects. Never migrate selected scope as tested scope or convert these slots into objective scores.'};mkdirSync(join(root,'test-results/stage6'),{recursive:true});writeFileSync(join(root,'test-results/stage6/legacy-cap-audit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({legacy:cases.map(({name,rows,pointsCovered,omitted})=>({name,rows,pointsCovered,omitted:omitted.length})),platform}));
