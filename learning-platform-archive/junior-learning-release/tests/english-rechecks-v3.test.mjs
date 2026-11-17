import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sha} from '../scripts/audit-english-batches.mjs';
import {buildEnglishV3,materialDigestPayload,V2_FILE_SHA256,SHORT_ANSWER_ID} from '../scripts/audit-english-batches-v3.mjs';
const dir=new URL('../data/question-bank/rechecks/',import.meta.url),v2Bytes=await readFile(new URL('english-recheck-v2.json',dir)),v2=JSON.parse(v2Bytes),v3Bytes=await readFile(new URL('english-recheck-v3.json',dir)),v3=JSON.parse(v3Bytes);
const oldById=new Map(v2.records.map(r=>[r.questionId,r]));

test('v3 preserves sealed v2 and keeps complete new batches, original CAS, and explicit new proposal checksum',()=>{
 assert.equal(sha(v2Bytes),V2_FILE_SHA256);assert.equal(v3.previousAudit.sha256,V2_FILE_SHA256);assert.equal(v3.records.length,162);assert.equal(v3.batches.length,9);assert(v3.batches.every(b=>b.id.startsWith('english-recheck-v3-')&&b.questionIds.length===18));assert.equal(new Set(v3.batches.flatMap(b=>b.questionIds)).size,162);
 assert.deepEqual(v3.summary.proposed,{passed:123,needs_review:18,quarantined:21});assert.deepEqual(v3.summary.original,{passed:120,needs_review:18,quarantined:24});assert.equal(v3.summary.contentChanged,3);
 for(const r of v3.records){const old=oldById.get(r.questionId);assert.equal(r.sourceContentHash,old.sourceContentHash);assert.equal(r.expectedRevision,1);assert.equal(r.proposal.expectedRevision,1);assert.equal(r.proposal.expectedContentHash,r.sourceContentHash);assert.equal(r.proposal.contentHash,sha(r.proposal.content));assert.equal(r.humanReview,false);assert.equal(r.proposal.teacherReviewed,false);assert.equal(r.proposal.formalScoringAllowed,false);assert.equal(r.proposal.validation.humanReview,false);assert.equal(r.proposal.content.reviewStatus,'pending_human');assert.equal(r.proposal.validation.status,r.decision);assert.equal(r.proposal.state,{passed:'available',needs_review:'pending',quarantined:'quarantined'}[r.decision]);}
 assert.equal(v3.proposalSetChecksum,sha(v3.records.map(r=>({questionId:r.questionId,expectedRevision:r.expectedRevision,sourceContentHash:r.sourceContentHash,decision:r.decision,contentHash:r.proposal.contentHash,state:r.proposal.state,validation:r.proposal.validation}))));
});

test('only three content payloads change; they preserve original source digests and identify new material sourceVersion2',()=>{
 const changed=v3.records.filter(r=>r.proposal.contentHash!==oldById.get(r.questionId).proposal.contentHash);assert.equal(changed.length,3);
 for(const r of v3.records){const old=oldById.get(r.questionId);if(!r.proposal.contentChanged)assert.deepEqual(r.proposal.content,old.proposal.content);else{const q=r.proposal.content;assert.equal(q.sourceVersion,2);assert.equal(q.originalSourceDigest,old.proposal.content.sourceDigest);assert.notEqual(q.sourceDigest,q.originalSourceDigest);assert.equal(q.sourceDigest,sha(materialDigestPayload(q)));assert.equal(q.sourceDigestFormat,'sha256-utf8-json-learning-material-v1');assert(q.sourceDigestScope.includes('new corrected original material'));assert.equal(q.contentRevisionProvenance.originalContentHash,r.sourceContentHash);assert.equal(q.contentRevisionProvenance.previousAuditSha256,V2_FILE_SHA256);assert.equal(q.contentRevisionProvenance.previousProposalContentHash,old.proposal.contentHash);assert.equal(r.proposal.validation.proof.checkedContentHash,r.proposal.contentHash);assert.equal(r.contentChecks.explanationAndMemoryCardChecked,true);assert.notEqual(q.explanation,old.proposal.content.explanation);assert.notEqual(q.memoryCard,old.proposal.content.memoryCard);assert.deepEqual(q.options,old.proposal.content.options);assert.equal(q.prompt,old.proposal.content.prompt);assert.equal(q.rationale,old.proposal.content.rationale);}}
});

test('present-perfect revision aligns the target absence and avoids the false universal ban on borrow with durations',()=>{
 const q=v3.records.find(r=>r.questionId==='draft-en-g8-present-perfect-prac').proposal.content;
 assert(q.prompt.includes('present-perfect')&&q.prompt.includes('has not returned'));assert.equal(q.options[q.correctOption],'has gone');
 assert(q.explanation.includes('本题指定现在完成时'));assert(q.explanation.includes('borrow可以与for或until说明约定借用期限'));assert(q.memoryCard.includes('不机械替换'));
 assert(!q.explanation.includes('短暂性动词 borrow / buy / die 等必须转'));
});

test('indefinite-pronoun revision aligns phrase structure without declaring something impossible in questions',()=>{
 const q=v3.records.find(r=>r.questionId==='draft-en-g8-indefinite-pronouns-freq-diag').proposal.content;
 assert(q.prompt.includes('noun phrase')&&q.prompt.includes('adjective'));assert.equal(q.options[q.correctOption],'anything interesting');assert(q.explanation.includes('期待肯定回答时也可以用something'));assert(q.explanation.includes('而不是判断说话人的隐含预期'));assert(q.memoryCard.includes('不按疑问句机械排除some'));
});

test('yet revision aligns full-sentence errors while qualifying position and acknowledging already questions',()=>{
 const q=v3.records.find(r=>r.questionId==='draft-en-g8-perfect-adverbs-yet-already-diag').proposal.content;
 assert.equal(q.options[q.correctOption],"I haven't packed my raincoat yet.");assert(q.explanation.includes('通常位于句末，也可以放在助动词之后'));assert(q.explanation.includes('already也可以用于疑问句'));assert(q.memoryCard.includes('yet常见于句末'));assert(q.memoryCard.includes('already也可用于疑问句'));
});

test('additional short-answer doubt is pending with no changed content and no assertion that every this-is answer is valid',()=>{
 const r=v3.records.find(r=>r.questionId===SHORT_ANSWER_ID),old=oldById.get(SHORT_ANSWER_ID);assert.equal(r.decision,'needs_review');assert.equal(r.proposal.state,'pending');assert.equal(r.proposal.validation.proof,null);assert.equal(r.proposal.contentHash,old.proposal.contentHash);assert.equal(r.proposal.contentChanged,false);assert(r.independentAnswer.reason.includes('不声称所有this is短答都规范'));assert(r.evidence.some(e=>e.id==='shortAnswers'&&e.usage.includes('not claimed to directly adjudicate')));
});

test('v3 is deterministic and rerunning preserves both sealed artifacts',async()=>{
 assert.deepEqual(buildEnglishV3(v2,{checkedAt:v3.checkedAt}),v3);assert.throws(()=>buildEnglishV3(v2,{v2FileSha256:'0'.repeat(64)}));
 const output=execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/audit-english-batches-v3.mjs',import.meta.url))],{encoding:'utf8'});assert.equal(JSON.parse(output).sealedArtifactReused,true);assert.equal(sha(await readFile(new URL('english-recheck-v2.json',dir))),sha(v2Bytes));assert.equal(sha(await readFile(new URL('english-recheck-v3.json',dir))),sha(v3Bytes));
});
