import test from 'node:test';
import assert from 'node:assert/strict';
import {retrieveScoped} from '../src/retrieval-contract.mjs';
const scope={orgId:'org-a',sources:[{id:'doc-a',orgId:'org-a',status:'completed',digest:'fixed-test-digest',text:'第一行\n通分后相加\n最后约分'}]};
const good={citations:[{sourceId:'doc-a',digest:'fixed-test-digest',lineStart:2,lineEnd:3,text:'通分后相加\n最后约分'}]};
test('RAG internal boundary is honestly unavailable without adapter and keeps citations scoped',async()=>{
  await assert.rejects(retrieveScoped(null,scope,'通分'),e=>e.code==='RAG_UNAVAILABLE');const r=await retrieveScoped({retrieve:async()=>good},scope,'通分');assert.equal(r.answer,null);assert.equal(r.needsTeacherReview,true);assert.equal(r.citations.length,1);
});
test('RAG boundary rejects incomplete/cross-org source, fabricated references and model answers',async()=>{
  for(const source of [{...scope.sources[0],status:'parsing'},{...scope.sources[0],orgId:'other'}])await assert.rejects(retrieveScoped({retrieve:async()=>good},{...scope,sources:[source]},'通分'),e=>e.code==='SOURCE_NOT_READY');
  for(const result of [{citations:[{...good.citations[0],sourceId:'other'}]},{citations:[{...good.citations[0],text:'fabricated'}]},{...good,answer:'pretend model answer'}])await assert.rejects(retrieveScoped({retrieve:async()=>result},scope,'通分'),e=>['RAG_CITATION_INVALID','RAG_OUTPUT_INVALID'].includes(e.code));
  await assert.rejects(retrieveScoped({retrieve:async()=>{throw Error('secret service detail');}},scope,'通分'),e=>e.code==='RAG_PROVIDER_FAILED'&&!e.message.includes('secret'));
});
test('not-ready or failed retrieval is never disguised as a successful empty search',async()=>{
  for(const [status,code]of [['needs_reindex','RAG_NEEDS_REINDEX'],['unavailable','RAG_UNAVAILABLE'],['failed','RAG_PROVIDER_FAILED']])await assert.rejects(retrieveScoped({retrieve:async()=>({status,citations:[]})},scope,'通分'),e=>e.code===code);
  await assert.rejects(retrieveScoped({retrieve:async()=>({citations:[null]})},scope,'通分'),e=>e.code==='RAG_CITATION_INVALID');
  await assert.rejects(retrieveScoped({retrieve:async()=>good},{...scope,orgId:''},'通分'),e=>e.code==='INVALID_RETRIEVAL_SCOPE');
});
