import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {draftFixture,checks} from './draft-fixture.mjs';
import {isolatedBankGroups} from '../src/draft-import.mjs';
const spec=JSON.parse(readFileSync(new URL('../docs/openapi.json',import.meta.url),'utf8'));
function validate(schema,value){if(schema.$ref)return validate(spec.components.schemas[schema.$ref.split('/').pop()],value);if(schema.oneOf){assert(schema.oneOf.some(s=>{try{validate(s,value);return true;}catch{return false;}}),'oneOf shape');return;}if('const'in schema)assert.deepEqual(value,schema.const);if(schema.enum)assert(schema.enum.includes(value));if(schema.type){const types=[schema.type].flat();assert(types.some(t=>t==='null'?value===null:t==='integer'?Number.isInteger(value):t==='array'?Array.isArray(value):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):typeof value===t));}if(value===null)return;if(schema.properties){for(const k of schema.required||[])assert(k in value,k);for(const [k,v]of Object.entries(value)){if(schema.properties[k])validate(schema.properties[k],v);else assert(schema.additionalProperties!==false,k);}}if(schema.items)value.forEach(v=>validate(schema.items,v));}
test('actual draft source, lifecycle, capability and print API match the versioned machine contract',async()=>{
 const f=await draftFixture();try{validate(spec.components.schemas.DraftSource,f.source);validate(spec.components.schemas.DraftCapability,(await f.request('/draft-provider',{client:f.teacher})).data);const d=(await f.create()).data;validate(spec.components.schemas.QuestionDraft,d);
 const reviewed=(await f.request(`/question-drafts/${d.id}/review`,{client:f.teacher,method:'POST',body:{revision:d.revision,decision:'reject',note:'合成契约测试，解析仍需进一步真人核验。',confirmed:true,checks:checks(d.questions)}})).data;validate(spec.components.schemas.QuestionDraft,reviewed);
 validate(spec.components.schemas.DraftPrintDocument,(await f.request(`/draft-exports?kind=question-draft&id=${d.id}`,{client:f.teacher})).data);
 const disabled=(await f.request('/question-drafts/generate',{client:f.teacher,method:'POST',body:{requestId:crypto.randomUUID(),title:'不可用契约',subject:'math',sourceIds:[f.source.id],count:1,instructions:'合成题',syntheticOnly:true}})).data;validate(spec.components.schemas.QuestionDraft,disabled);assert.equal(spec.info.version,'1.6.1');assert(spec.paths['/question-drafts/generate'].post.responses['202']);
 }finally{f.close();}
});
test('oversized import is explicitly scoped and never evaluates source expressions or silently truncates',()=>{
 const items=Array.from({length:63},(_,i)=>({id:`draft-${i}`,batch:i<3?1:2,knowledgeId:`k${Math.floor(i/3)}`,knowledgeTitle:'合成知识点',subject:'math',grade:7,phase:['diagnostic','practice','retest'][i%3],prompt:`合成题${i}`,options:['1','2','3','4'],correctOption:0,rationale:'仅合成解析',source:'original_authored_cc0',license:'CC0-1.0',reviewStatus:'pending_human',isolationStatus:'isolated_draft_only',automatedCheck:{expr:'throw new Error("must never execute")'}}));
 const raw=JSON.stringify({bankVersion:'test',isolationStatus:'isolated_draft_only',questions:items});assert.throws(()=>isolatedBankGroups(raw),e=>e.code==='IMPORT_SCOPE_TOO_LARGE');const selected=isolatedBankGroups(raw,{batches:[1]});assert.equal(selected.inputQuestionCount,63);assert.equal(selected.questionCount,3);assert.equal(selected.excludedIds.length,60);assert.equal(selected.groups[0].questions.length,3);
});
