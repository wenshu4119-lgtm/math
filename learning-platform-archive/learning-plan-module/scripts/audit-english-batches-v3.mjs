import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {sha,CATALOG_SHA256,CATALOG_JSON_SHA256} from './audit-english-batches.mjs';
export const V2_FILE_SHA256='c255f36f65f99d2e44de1ec7e772bdfbabfa39c3b0b0f2939290f5112b279e1b';
export const CHECKER_V3='english-independent-closed-choice-v3';
export const SHORT_ANSWER_ID='draft-en-g7-be-subject-prep-basics-retest';
const MATERIALS={
 'draft-en-g8-present-perfect-prac':{
  explanation:'本题指定现在完成时，并明确王医生目前仍在北京、尚未返回。在这种表达当前不在场的语境下用has gone to。have/has been to常用于报告到访经历，通常包含已返回的读法。现在完成时还可表达从过去延续至今或与现在有关的经历；since/for本身不决定唯一时态，需结合时间参照和动作意义。borrow可以与for或until说明约定借用期限；若明确报告截至现在持续持有，have/has kept是常用表达，不能把borrow一概判为不能接时间段。',
  memoryCard:'先核对指定时态与当前是否返回；本题仍未回→has gone to。since/for看语境；借用期限可用borrow，持续持有可用keep，不机械替换。'
 },
 'draft-en-g8-indefinite-pronouns-freq-diag':{
  explanation:'anything、something等复合不定代词后可以加形容词补充性质，本题要求的名词短语为anything interesting。some/any的选择与句子意义和说话者预期有关：中性开放询问常用anything，期待肯定回答时也可以用something，不能说所有疑问句都必须用anything。本修订题明确要求一个由形容词修饰不定代词的名词短语，而不是判断说话人的隐含预期。Everything、everyone作主语在通常标准结构中用单数谓语；询问频率用How often。',
  memoryCard:'不定代词后置形容词：anything interesting。some/any看语境与回答预期，不按疑问句机械排除some；询问频率用How often。'
 },
 'draft-en-g8-perfect-adverbs-yet-already-diag':{
  explanation:'yet常用于谈论预期事件的否定句和疑问句，通常位于句末，也可以放在助动词之后等合适位置。already也可以用于疑问句或句末，表达已发生、提前完成或惊讶等意味；它并不因句子是疑问句就自动错误。本题考查标准书面语have not+过去分词+宾语+yet这一完整句结构。A误用原形pack，C否定词次序错误，D把yet插在packed与其直接宾语my raincoat之间；B符合题干。since通常引出过去起点，for通常引出时长；具体时态仍要结合时间参照与语义判断。',
  memoryCard:'尚未完成常说haven’t packed...yet；yet常见于句末，already也可用于疑问句。since/for标示时间关系，时态还要看语境。'
 }
};
export function materialDigestPayload(q){return{questionId:q.id,sourceVersion:q.sourceVersion,explanation:q.explanation,memoryCard:q.memoryCard,prompt:q.prompt,options:q.options,correctOption:q.correctOption,rationale:q.rationale};}
const summaryCount=(records,original=false)=>Object.fromEntries(['passed','needs_review','quarantined'].map(k=>[k,records.filter(r=>(original?r.originalAssessment.decision:r.decision)===k).length]));
const sumCheck=counts=>assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),162);
export function buildEnglishV3(v2,{checkedAt=new Date().toISOString(),v2FileSha256=V2_FILE_SHA256}={}){
 assert.equal(v2FileSha256,V2_FILE_SHA256);assert.equal(v2.sourceCatalogSha256,CATALOG_SHA256);assert.equal(v2.records.length,162);
 const report=structuredClone(v2);report.checkedAt=checkedAt;report.checker=CHECKER_V3;
 report.previousAudit={filename:'english-recheck-v2.json',sha256:V2_FILE_SHA256,checkedAt:v2.checkedAt,checker:v2.checker,summary:v2.summary};
 report.auditRevision=3;
 report.batches=report.batches.map(b=>({...b,id:b.id.replace('english-recheck-','english-recheck-v3-')}));
 for(const r of report.records){
  const update=MATERIALS[r.questionId];if(!update)continue;
  const oldProposalHash=r.proposal.contentHash,q=r.proposal.content;
  assert.equal(r.proposal.contentChanged,true);assert.equal(r.originalAssessment.initialIsolation,true);
  q.explanation=update.explanation;q.memoryCard=update.memoryCard;
  q.originalSourceDigest=q.sourceDigest;q.sourceVersion=2;
  q.sourceDigest=sha(materialDigestPayload(q));
  q.sourceDigestFormat='sha256-utf8-json-learning-material-v1';
  q.sourceDigestScope='SHA256 of JSON.stringify({questionId,sourceVersion,explanation,memoryCard,prompt,options,correctOption,rationale}) in this key order; new corrected original material, not the unchanged Antigravity source';
  q.sourceLabel=q.sourceLabel.replace('独立自动复核修订（未教师审核）','独立自动复核修订v3（题目、讲解和记背卡同步；未教师审核）');
  q.contentRevisionProvenance={...q.contentRevisionProvenance,method:CHECKER_V3,previousAuditSha256:V2_FILE_SHA256,previousProposalContentHash:oldProposalHash,change:'prompt/options/rationale plus explanation/memoryCard corrected; material sourceVersion=2',humanReview:false};
  r.proposal.contentHash=sha(q);r.proposal.validation.validator=CHECKER_V3;r.proposal.validation.checkedAt=checkedAt;r.proposal.validation.proof.checkedContentHash=r.proposal.contentHash;
  r.proposal.reason+=' v3同步修正知识讲解和记背卡的绝对化规则；sourceDigest标识本次修订材料，originalSourceDigest保留原稿依据。';
  r.proposal.previousProposalContentHash=oldProposalHash;
  r.contentChecks.explanationAndMemoryCardChecked=true;
  r.contentChecks.materialConsistency='prompt/options/key/rationale/explanation/memoryCard aligned; contextual qualifiers retained';
  if(r.questionId==='draft-en-g8-present-perfect-prac'&&!r.evidence.some(e=>e.id==='borrow')){const ref=v2.references.find(e=>e.id==='borrow');r.evidence.push({...ref,usage:'Supports that borrow can describe a loan period; no blanket ban on for/until is asserted.'});}
 }
 const short=report.records.find(r=>r.questionId===SHORT_ANSWER_ID);assert(short);assert.equal(short.decision,'passed');
 const reason='it is是给定问题的常规短答；this is在指示或对比语境中可能成立。原题未限定只考常规人称代词短答，未能独立确证A应一律排除，因此保持待教师复核；这里不声称所有this is短答都规范。';
 short.decision='needs_review';short.independentAnswer={optionIndexes:[0,2],answerText:[short.proposal.content.options[0],short.proposal.content.options[2]],method:'model_assisted_independent_language_audit_of_fixed_question',reason,alternativesNotExhaustive:true,certainty:'uniqueness_not_independently_established',optionRoles:{0:'potential_deictic_or_contrastive_context_requires_review',2:'ordinary_short_answer'}};
 short.issues=[];short.warnings=['SHORT_ANSWER_PRAGMATICS_NOT_INDEPENDENTLY_RESOLVED'];
 short.originalAssessment={...short.originalAssessment,decision:'needs_review',independentAnswer:{optionIndexes:[0,2],answerText:short.independentAnswer.answerText,reason},rationaleAssessment:'absolute_pronoun_substitution_rule_requires_contextual_qualification',warnings:[...short.warnings]};
 short.proposal.state='pending';short.proposal.validation={...short.proposal.validation,validator:CHECKER_V3,status:'needs_review',proof:null,issues:[],warnings:[...short.warnings],checkedAt,humanReview:false};short.proposal.reason=reason;
 const refs=[{id:'demonstratives',title:'Cambridge: This, that, these, those',url:'https://dictionary.cambridge.org/us/grammar/british-grammar/this-that-these-and-those'},{id:'shortAnswers',title:'British Council: Short forms',url:'https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/short-forms'}];
 short.evidence.push(...refs.map(e=>({...e,usage:'General demonstrative/short-answer scope only; this source is not claimed to directly adjudicate the exact umbrella sentence.'})));report.references.push(...refs);
 report.summary={...report.summary,original:summaryCount(report.records,true),proposed:summaryCount(report.records),contentChanged:report.records.filter(r=>r.proposal.contentChanged).length,additionalHeldAfterV2:1};sumCheck(report.summary.original);sumCheck(report.summary.proposed);
 assert.deepEqual(report.summary.proposed,{passed:123,needs_review:18,quarantined:21});assert.equal(report.summary.contentChanged,3);
 report.proposalSetChecksum=sha(report.records.map(r=>({questionId:r.questionId,expectedRevision:r.expectedRevision,sourceContentHash:r.sourceContentHash,decision:r.decision,contentHash:r.proposal.contentHash,state:r.proposal.state,validation:r.proposal.validation})));
 report.method={...report.method,revision3Note:'Preserves sealed v2; three corrected questions now have synchronized explanation/memory cards and new material digests; one additional short-answer uniqueness doubt is held pending without textual changes.'};
 report.limitations.push('v3 supersedes v2 for proposed application. Only three question-content payloads change; the additional short-answer record changes audit disposition only.','SourceVersion=2 on the three corrected material bundles is distinct from auditRevision=3 and from the live bank revision. Live CAS still requires original revision=1 and original content hash.');
 return report;
}
async function main(){
 const dir=new URL('../data/question-bank/rechecks/',import.meta.url);await mkdir(dir,{recursive:true});
 const sourceBytes=await readFile(new URL('../data/question-bank/catalog.json',import.meta.url));assert.equal(sha(sourceBytes),CATALOG_SHA256);assert.equal(sha(JSON.parse(sourceBytes)),CATALOG_JSON_SHA256);
 const v2Bytes=await readFile(new URL('english-recheck-v2.json',dir));assert.equal(sha(v2Bytes),V2_FILE_SHA256,'Sealed v2 changed');const v2=JSON.parse(v2Bytes);
 const output=new URL('english-recheck-v3.json',dir);let prior=null;try{prior=JSON.parse(await readFile(output,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const report=buildEnglishV3(v2,{v2FileSha256:sha(v2Bytes),...(prior?{checkedAt:prior.checkedAt}:{})});
 if(prior)assert.equal(sha(prior),sha(report),'Sealed v3 changed; create a new version rather than overwrite');else await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output:output.pathname,summary:report.summary,proposalSetChecksum:report.proposalSetChecksum,sealedArtifactReused:Boolean(prior)}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
