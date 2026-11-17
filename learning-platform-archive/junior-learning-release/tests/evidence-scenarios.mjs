// Isolated original sample content only. No invented full-category question bank.
import assert from 'node:assert/strict';
export async function missingEvidenceScenario(f,{teacher,student}){
  const call=async(path,client,method='GET',body,status=200)=>{const r=await f.request(path,{client,method,body});assert.equal(r.status,status,`${method} ${path}: ${r.error?.code||''}`);return r.data;};
  await f.review(teacher);
  const englishOpen=await call('/attempts',student,'POST',{studentId:student.id,subject:'english',phase:'diagnostic'},201);
  const diagnostic=await call('/attempts',student,'POST',{studentId:student.id,subject:'math',phase:'diagnostic'},201);
  const answers=f.correctAnswers(diagnostic).map(a=>a.questionId==='math-equation-diagnostic'?{...a,selectedOption:(a.selectedOption+1)%4}:a);
  const diagnosticResult=await call(`/attempts/${diagnostic.id}/submit`,student,'POST',{answers});
  const pack=await call('/packs',student,'POST',{diagnosticId:diagnostic.id},201);
  const approved=await call(`/packs/${pack.id}`,teacher,'PATCH',{revision:pack.revision,knowledgeIds:pack.knowledgeIds,teacherNote:'合成测试，仅依据实际错题复习。',approve:true});
  const practice=await call('/attempts',student,'POST',{studentId:student.id,subject:'math',phase:'practice',packId:pack.id},201);
  const practiceResult=await call(`/attempts/${practice.id}/submit`,student,'POST',{answers:f.correctAnswers(practice).map(a=>({...a,selectedOption:(a.selectedOption+1)%4}))});
  const createPaper=title=>call('/papers',teacher,'POST',{studentId:student.id,subject:'math',title,kind:'scored_paper',requestId:crypto.randomUUID()},201);
  const zeroItem={questionNo:'1',prompt:'合成原卷：方程题实际得0分。',qtype:'solution',mappingLevel:'knowledge',knowledgeId:'math-equation',maxScore:4,earnedScore:0,reviewed:true};
  const missingItem={questionNo:'2',prompt:'合成待核对：尚无可确认的满分和实际分。',qtype:'solution',mappingLevel:'knowledge',knowledgeId:'math-fraction',maxScore:null,earnedScore:null,reviewed:true};
  const unknown=await createPaper('合成样例：真实零分与缺失分值');
  const unknownDraft=await call(`/papers/${unknown.id}`,teacher,'PATCH',{revision:unknown.revision,title:unknown.title,items:[zeroItem,missingItem]});
  const confirmation=await f.request(`/papers/${unknown.id}/confirm`,{client:teacher,method:'POST',body:{revision:unknownDraft.revision,confirmed:true}});assert.equal(confirmation.error.code,'SCORE_INCOMPLETE');
  const zero=await createPaper('合成样例：已确认真实零分');
  const zeroSaved=await call(`/papers/${zero.id}`,teacher,'PATCH',{revision:zero.revision,title:zero.title,items:[zeroItem]});
  const zeroReport=await call(`/papers/${zero.id}/confirm`,teacher,'POST',{revision:zeroSaved.revision,confirmed:true});
  const growth=await call(`/students/${student.id}/growth`,student);
  const knowledge=[...await call('/knowledge?subject=math',student),...await call('/knowledge?subject=english',student)];
  return {englishOpen,diagnostic:diagnosticResult,pack:approved,practice:practiceResult,unknownDraft,zeroReport,growth,knowledge};
}
