import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,PNG} from './helpers.mjs';
import {id} from '../src/security.mjs';
import {EXPORTS} from '../public/export-registry.js';
const spec=JSON.parse(readFileSync(new URL('../docs/openapi.json',import.meta.url)));
test('prototype handoff names do not silently become supported writes or export kinds',async()=>{
  const f=await fixture();try{const s=await f.login('student'),t=await f.login('teacher');await f.review(t);
    assert.equal((await f.request('/attempts',{client:s,method:'POST',body:{studentId:s.id,subject:'math',phase:'screening'}})).error.code,'INVALID_PHASE');
    assert.equal((await f.request('/ocr-runs',{client:s,method:'POST',body:{}})).status,404);
    assert.equal((await f.request('/attempts',{client:s,method:'POST',body:{studentId:s.id,subject:'math',phase:'diagnostic',requestId:id()}})).status,400);
    assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM attempts').get().n,0);
    const a=(await f.request('/attempts',{client:s,method:'POST',body:{studentId:s.id,subject:'math',phase:'diagnostic'}})).data;assert.equal((await f.request(`/attempts/${a.id}/submit`,{client:s,method:'POST',body:{answers:f.correctAnswers(a),requestId:id()}})).status,400);
    await f.request(`/attempts/${a.id}/submit`,{client:s,method:'POST',body:{answers:f.correctAnswers(a)}});const p=(await f.request('/packs',{client:s,method:'POST',body:{diagnosticId:a.id}})).data;const body={revision:p.revision,knowledgeIds:p.knowledgeIds,teacherNote:'合成交接核对',approve:true};assert.equal((await f.request(`/packs/${p.id}`,{client:t,method:'PATCH',body})).status,200);
    const conflict=await f.request(`/packs/${p.id}`,{client:t,method:'PATCH',body});assert.equal(conflict.status,409);assert.equal(conflict.error.code,'VERSION_CONFLICT');assert.deepEqual(Object.keys(conflict.error).sort(),['code','message','requestId']);assert(!('currentRevision' in conflict.error));
    assert(!EXPORTS['teacher-roster']);assert(!EXPORTS['review-queue']);assert(EXPORTS.roster&&EXPORTS.content);assert.equal(Object.keys(EXPORTS).length,29);
  }finally{f.close();}
});
// Validate the schema subset emitted by our contract generator (not a general JSON Schema engine).
function validate(schema,value,path='data'){
  if(schema.$ref)return validate(spec.components.schemas[schema.$ref.split('/').at(-1)],value,path);
  if(schema.oneOf){assert(schema.oneOf.some(s=>{try{validate(s,value,path);return true;}catch{return false;}}),path+' oneOf');return;}
  if('const' in schema)assert.equal(value,schema.const,path);
  if(schema.enum)assert(schema.enum.includes(value),path+' enum');
  if(schema.type){const types=Array.isArray(schema.type)?schema.type:[schema.type];const isType=t=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='integer'?Number.isInteger(value):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):typeof value===t;assert(types.some(isType),`${path}: expected ${types}`);}
  if(value===null)return;
  if(schema.properties){for(const required of schema.required||[])assert(required in value,`${path}.${required} missing`);for(const [key,v]of Object.entries(value)){if(schema.properties[key])validate(schema.properties[key],v,path+'.'+key);else assert(schema.additionalProperties!==false,path+'.'+key+' undocumented');}}
  if(schema.items)value.forEach((v,i)=>validate(schema.items,v,`${path}[${i}]`));
}
test('actual API responses and pack activity/cycle summaries conform to v1.5 documented shapes',async()=>{
  const f=await fixture();try{
    const t=await f.login('teacher'),s=await f.login('student');validate(spec.components.schemas.Session,(await f.request('/auth/session',{client:s})).data);await f.review(t);
    const a=(await f.request('/attempts',{client:s,method:'POST',body:{studentId:s.id,subject:'math',phase:'diagnostic'}})).data;validate(spec.components.schemas.Attempt,a);
    await f.request(`/attempts/${a.id}/submit`,{client:s,method:'POST',body:{answers:f.correctAnswers(a)}});const p=(await f.request('/packs',{client:s,method:'POST',body:{diagnosticId:a.id}})).data;validate(spec.components.schemas.Pack,p);
    const paper=(await f.request('/papers',{client:t,method:'POST',body:{studentId:s.id,title:'契约核验',subject:'math',kind:'scored_paper',requestId:id()}})).data;validate(spec.components.schemas.Paper,paper);
    const saved=(await f.request(`/papers/${paper.id}`,{client:t,method:'PATCH',body:{revision:paper.revision,title:paper.title,items:[{questionNo:'1',prompt:'1+1=?',qtype:'fill',mappingLevel:'unresolved',maxScore:2,earnedScore:1.5,reviewed:true}]}})).data;validate(spec.components.schemas.Paper,saved);
    const confirmed=(await f.request(`/papers/${paper.id}/confirm`,{client:t,method:'POST',body:{revision:saved.revision,confirmed:true}})).data;validate(spec.components.schemas.Paper,confirmed);
    f.env.OCR={description:{id:'test-double',version:'contract-only'},async recognize(){return {text:'contract output only',confidence:50};}};const upload=(await f.request(`/uploads?studentId=${s.id}`,{client:s,method:'POST',raw:true,body:PNG,headers:{'Content-Type':'image/png'}})).data;validate(spec.components.schemas.Upload,upload);const recognized=(await f.request(`/uploads/${upload.id}/recognize`,{client:s,method:'POST',body:{requestId:id(),language:'eng'}})).data;validate(spec.components.schemas.OcrRun,recognized);
    validate(spec.components.schemas.Growth,(await f.request(`/students/${s.id}/growth`,{client:s})).data);
    for(const record of (await f.request(`/attempts?studentId=${s.id}`,{client:s})).data)validate(spec.components.schemas.AttemptSummary,record);
    const scoped=(await f.request('/attempts',{client:s,method:'POST',body:{studentId:s.id,subject:'english',phase:'diagnostic',knowledgeIds:['english-be']}})).data;validate(spec.components.schemas.Attempt,scoped);assert.equal(scoped.scope.mode,'selected_topics');assert.equal(scoped.scope.topics.length,1);
    validate(spec.components.schemas.PackActivity,(await f.request(`/packs/${p.id}/activity`,{client:s})).data);validate(spec.components.schemas.LearningCycle,(await f.request(`/students/${s.id}/learning-cycle?subject=math`,{client:s})).data);validate(spec.components.schemas.LearningCycle,(await f.request(`/students/${s.id}/learning-cycle?subject=english`,{client:s})).data);
    const hw=(await f.request('/homeworks',{client:t,method:'POST',body:{studentId:s.id,subject:'math',title:'作业契约',items:[{questionId:'math-equation-practice',maxScore:2}],requestId:id()}})).data;validate(spec.components.schemas.Homework,hw);validate(spec.components.schemas.HomeworkSheet,(await f.request(`/homeworks/${hw.id}/sheet`,{client:t})).data);const pub=(await f.request(`/homeworks/${hw.id}/publish`,{client:t,method:'POST',body:{revision:hw.revision,confirmed:true}})).data;const sent=(await f.request(`/homeworks/${hw.id}/submit`,{client:s,method:'POST',body:{revision:pub.revision,requestId:id(),answers:[{questionId:'math-equation-practice',selectedOption:2}]}})).data;validate(spec.components.schemas.Homework,sent);const graded=(await f.request(`/homeworks/${hw.id}/grade`,{client:t,method:'POST',body:{revision:sent.revision,requestId:id(),marks:[{questionId:'math-equation-practice',earnedScore:2}],feedback:'已人工核对',confirmed:true}})).data;validate(spec.components.schemas.Homework,graded);validate(spec.components.schemas.HomeworkSheet,(await f.request(`/homeworks/${hw.id}/sheet`,{client:t})).data);validate(spec.components.schemas.HomeworkSummary,(await f.request(`/students/${s.id}/homework-summaries`,{client:s})).data[0]);
    assert.deepEqual(spec.paths['/papers/{id}/confirm'].post['x-roles'],['teacher']);assert(spec.paths['/uploads/{id}/recognize'].post.responses['503']);assert(spec.paths['/uploads/{id}/recognize'].post.responses['201']);
    assert.equal(spec.paths['/auth/session'].get.responses['200'].headers['X-Actor-Id'].required,true);assert.equal(spec.paths['/uploads/{id}/image'].get.responses['200'].headers['X-Actor-Id'].required,true);assert.equal(spec.paths['/health'].get.responses['200'].headers?.['X-Actor-Id'],undefined);
  }finally{f.close();}
});
