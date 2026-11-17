import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildEnglishRecheck,sha,CATALOG_SHA256,CATALOG_JSON_SHA256} from '../scripts/audit-english-batches.mjs';
const bytes=await readFile(new URL('../data/question-bank/catalog.json',import.meta.url));
const catalog=JSON.parse(bytes.toString('utf8'));
const artifactPath=new URL('../data/question-bank/rechecks/english-recheck-v2.json',import.meta.url);
const artifact=JSON.parse(await readFile(artifactPath,'utf8'));
const byId=new Map(catalog.records.map(r=>[r.question.id,r]));

test('all 162 source English questions have exactly one version-bound conclusion and nine complete batches',()=>{
 assert.equal(sha(bytes),CATALOG_SHA256);assert.equal(sha(catalog),CATALOG_JSON_SHA256);
 assert.equal(artifact.schemaVersion,2);assert.equal(artifact.records.length,162);assert.equal(new Set(artifact.records.map(r=>r.questionId)).size,162);
 assert.equal(artifact.batches.length,9);assert(artifact.batches.every(b=>b.questionIds.length===18));
 const ids=artifact.batches.flatMap(b=>b.questionIds);assert.equal(new Set(ids).size,162);assert.deepEqual([...ids].sort(),artifact.records.map(r=>r.questionId).sort());
 for(const grade of [7,8,9])assert.equal(artifact.records.filter(r=>r.grade===grade).length,54);
 for(const r of artifact.records){const q=byId.get(r.questionId).question;assert.equal(q.subject,'english');assert.equal(r.sourceContentHash,sha(q));assert.equal(r.expectedRevision,1);assert.equal(r.proposal.expectedContentHash,sha(q));assert.equal(r.proposal.expectedRevision,1);assert.equal(r.proposal.contentHash,sha(r.proposal.content));assert(r.independentAnswer.reason.length>20);}
});

test('failed uniqueness is retained even though the original answer is one possible answer',()=>{
 for(const id of ['draft-en-g8-rise-raise-borrow-lend-pairs-prac','draft-en-g8-adverbial-clauses-diag','draft-en-g9-relative-clauses-whose-prep-prac','draft-en-g9-past-perfect-reported-speech-retest','draft-en-g8-too-to-so-that-diag','draft-en-g9-word-formation-affixes-diag','draft-en-g7-do-does-freq-order-retest','draft-en-g7-gerund-subj-double-obj-retest']){
  const r=artifact.records.find(r=>r.questionId===id);assert.equal(r.decision,'quarantined',id);assert.equal(r.proposal.state,'quarantined');assert(r.independentAnswer.optionIndexes.length>=2);assert.equal(r.proposal.validation.proof,null);assert(r.issues.includes('NON_UNIQUE_OR_FALSE_EXCLUSION'));
 }
 const borrow=artifact.records.find(r=>r.questionId==='draft-en-g8-rise-raise-borrow-lend-pairs-prac');assert.deepEqual(borrow.independentAnswer.optionIndexes,[0,1]);assert(borrow.evidence.some(e=>e.url==='https://dictionary.cambridge.org/dictionary/english/borrow'));
 const unpolite=artifact.records.find(r=>r.questionId==='draft-en-g9-word-formation-affixes-diag');assert.deepEqual(unpolite.independentAnswer.optionIndexes,[1,2]);assert(unpolite.evidence.some(e=>e.url==='https://www.merriam-webster.com/dictionary/unpolite'));
});

test('the three originally isolated questions are explicit new content proposals with independently unique target answers',()=>{
 const expected={'draft-en-g8-present-perfect-prac':1,'draft-en-g8-indefinite-pronouns-freq-diag':3,'draft-en-g8-perfect-adverbs-yet-already-diag':1};
 const revised=artifact.records.filter(r=>r.proposal.contentChanged);assert.deepEqual(revised.map(r=>r.questionId).sort(),Object.keys(expected).sort());
 for(const r of revised){const source=byId.get(r.questionId).question;assert.equal(r.originalAssessment.initialIsolation,true);assert.equal(r.originalAssessment.decision,'quarantined');assert.equal(r.decision,'passed');assert.equal(r.proposal.state,'available');assert.equal(r.proposal.validation.status,'passed');assert.equal(r.proposal.content.correctOption,expected[r.questionId]);assert.deepEqual(r.independentAnswer.optionIndexes,[expected[r.questionId]]);assert.notEqual(r.proposal.contentHash,r.sourceContentHash);assert.notEqual(r.proposal.content.prompt,source.prompt);assert.notEqual(r.proposal.content.rationale,source.rationale);assert.equal(r.proposal.rejectedOptions.length,3);assert.equal(r.proposal.content.contentRevisionProvenance.originalContentHash,r.sourceContentHash);}
 const perfect=revised.find(r=>r.questionId==='draft-en-g8-present-perfect-prac').proposal.content;assert(perfect.prompt.includes('present-perfect'));assert(perfect.prompt.includes('has not returned'));
 const indefinite=revised.find(r=>r.questionId==='draft-en-g8-indefinite-pronouns-freq-diag').proposal.content;assert(indefinite.prompt.includes('noun phrase'));assert(!indefinite.options.includes('something interesting'));
 const yet=revised.find(r=>r.questionId==='draft-en-g8-perfect-adverbs-yet-already-diag').proposal.content;assert.equal(yet.options[1],"I haven't packed my raincoat yet.");assert(yet.prompt.includes('standard written English'));
});

test('all other source content remains byte-equivalent and unresolved items cannot become available',()=>{
 for(const r of artifact.records){
  if(!r.proposal.contentChanged)assert.equal(r.proposal.contentHash,r.sourceContentHash);
  assert.equal(r.proposal.validation.status,r.decision);assert.equal(r.proposal.state,{passed:'available',needs_review:'pending',quarantined:'quarantined'}[r.decision]);
  if(r.decision!=='passed')assert.equal(r.proposal.validation.proof,null);
  else{assert.equal(r.independentAnswer.optionIndexes.length,1);assert.equal(r.proposal.content.correctOption,r.independentAnswer.optionIndexes[0]);assert.equal(r.proposal.validation.proof.checkedContentHash,r.proposal.contentHash);assert.equal(r.proposal.validation.proof.sourceKeyUsedToDeriveAnswer,false);}
  const q=byId.get(r.questionId).question;assert.equal(r.proposal.content.difficulty,q.difficulty);assert.equal(r.proposal.content.knowledgeDifficulty,q.knowledgeDifficulty);
 }
 assert.deepEqual(artifact.summary.original,{passed:121,needs_review:17,quarantined:24});assert.deepEqual(artifact.summary.proposed,{passed:124,needs_review:17,quarantined:21});
 assert.equal(Object.values(artifact.summary.proposed).reduce((a,b)=>a+b,0),162);
});

test('no teacher review, curriculum certification, or formal grading is created by this audit',()=>{
 assert.equal(artifact.method.teacherReviewCount,0);assert.equal(artifact.method.productionWrites,false);assert.equal(artifact.method.formalScoringAllowed,false);assert.equal(artifact.summary.humanReviewsCreated,0);
 for(const r of artifact.records){assert.equal(r.humanReview,false);assert.equal(r.proposal.teacherReviewed,false);assert.equal(r.proposal.formalScoringAllowed,false);assert.equal(r.proposal.validation.humanReview,false);assert.equal(r.proposal.content.reviewStatus,'pending_human');assert.equal(r.contentChecks.grade.independentlyCurriculumCertified,false);assert(!('reviewedBy'in r.proposal.content));}
});

test('altered source text, source answer, grade or declared source hash cannot reuse the pinned audit',()=>{
 for(const field of ['prompt','correctOption','grade']){const changed=structuredClone(catalog);const r=changed.records.find(r=>r.question.subject==='english');r.question[field]=field==='prompt'?r.question.prompt+' changed':field==='correctOption'?(r.question.correctOption+1)%4:9;assert.throws(()=>buildEnglishRecheck(changed),/Catalog object changed/);}
 assert.throws(()=>buildEnglishRecheck(catalog,{catalogSha256:'0'.repeat(64)}),/Catalog changed/);
});

test('sealed artifact is deterministic and rerunning the compiler does not overwrite its timestamp or contents',async()=>{
 const before=await readFile(artifactPath);const computed=buildEnglishRecheck(catalog,{checkedAt:artifact.checkedAt,catalogSha256:sha(bytes)});assert.equal(sha(computed),sha(artifact));
 const output=execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/audit-english-batches.mjs',import.meta.url))],{encoding:'utf8'});assert.equal(JSON.parse(output).sealedArtifactReused,true);
 assert.equal(sha(await readFile(artifactPath)),sha(before));assert.equal(sha(await readFile(new URL('../data/question-bank/catalog.json',import.meta.url))),CATALOG_SHA256);
});
