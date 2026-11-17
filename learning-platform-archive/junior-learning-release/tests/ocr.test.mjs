import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,PNG} from './helpers.mjs';
import {id} from '../src/security.mjs';
const description={id:'test-double',version:'unit-only',mode:'test-double',languages:['eng','chi_sim+eng'],secret:'must-never-be-returned'};
async function scenario(fn){const f=await fixture();try{const s=await f.login('student'),t=await f.login('teacher');const upload=async()=>(await f.request(`/uploads?studentId=${s.id}`,{client:s,method:'POST',raw:true,body:PNG,headers:{'Content-Type':'image/png'}})).data;const recognize=(u,body={requestId:id(),language:'eng'},client=s)=>f.request(`/uploads/${u.id}/recognize`,{client,method:'POST',body});await fn({...f,s,t,upload,recognize});}finally{f.close();}}
test('OCR unavailable is honest and creates no fake job or text',()=>scenario(async f=>{const u=await f.upload();assert.equal((await f.recognize(u)).error.code,'OCR_UNAVAILABLE');assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM ocr_runs').get().n,0);const c=(await f.request('/capabilities',{client:f.s})).data;assert.equal(c.ocr.available,false);assert.equal(c.rag.available,false);}));
test('OCR output is unreviewed, idempotent and scoped; only teacher confirmation permits paper provenance',()=>scenario(async f=>{
  let calls=0;f.env.OCR={description,async recognize(){calls++;return {text:'<script>not executable</script>\n2x + 3 = 11',confidence:91,elapsedMs:10};}};
  const u=await f.upload(),body={requestId:id(),language:'eng'},result=await f.recognize(u,body);assert.equal(result.status,201);const r=result.data;assert.equal(r.status,'needs_review');assert.equal(r.needsReview,true);assert(!JSON.stringify(r).includes(description.secret));assert.equal((await f.recognize(u,body)).data.id,r.id);assert.equal(calls,1);
  const createBody={studentId:f.s.id,title:'OCR引用',subject:'math',kind:'scored_paper',requestId:id(),ocrRunId:r.id};await f.request(`/uploads/${u.id}/review`,{client:f.s,method:'PATCH',body:{revision:1,text:'学生自行核对，不是教师OCR审批',confirmed:true}});assert.equal((await f.request('/papers',{client:f.t,method:'POST',body:createBody})).error.code,'OCR_REVIEW_REQUIRED');
  assert.equal((await f.request(`/ocr-runs/${r.id}/review`,{client:f.s,method:'PATCH',body:{revision:1,text:'人工修订',confirmed:true}})).status,403);
  const reviewed=await f.request(`/ocr-runs/${r.id}/review`,{client:f.t,method:'PATCH',body:{revision:1,text:'2x + 3 = 11',confirmed:true}});assert.equal(reviewed.data.status,'teacher_confirmed');
  assert.equal((await f.request(`/ocr-runs/${r.id}/review`,{client:f.t,method:'PATCH',body:{revision:1,text:'overwrite',confirmed:true}})).status,409);
  const paper=await f.request('/papers',{client:f.t,method:'POST',body:createBody});assert.equal(paper.status,201);assert.equal(paper.data.contentOrigin,'teacher_reviewed_ocr_text');assert.equal(paper.data.items.length,0);assert.equal(paper.data.report,null);assert.equal(paper.data.ocrProvenance.provider.id,'test-double');assert(!JSON.stringify(paper.data.ocrProvenance).includes('2x + 3'));
  assert.equal((await f.request(`/students/${f.s.id}/growth`,{client:f.s})).data.evidence.length,0);assert.equal((await f.request(`/students/${f.s.id}/growth`,{client:f.s})).data.paperEvidence.length,0);
  const audit=JSON.stringify(f.DB.sqlite.prepare('SELECT * FROM audit_events').all());assert(!audit.includes('script'));assert(!audit.includes('2x + 3'));
}));
test('OCR parent/other-student/other-teacher/admin access and CSRF are rejected',()=>scenario(async f=>{
  f.env.OCR={description,async recognize(){return {text:'example'};}};const u=await f.upload(),r=(await f.recognize(u)).data;
  for(const name of ['parent','student2','teacher2','admin']){const c=await f.login(name);assert([403,404].includes((await f.request(`/ocr-runs/${r.id}`,{client:c})).status));assert([403,404].includes((await f.recognize(u,{requestId:id(),language:'eng'},c)).status));}
  assert.equal((await f.request(`/ocr-runs/${r.id}/review`,{client:f.t,method:'PATCH',headers:{'X-CSRF-Token':'invalid'},body:{revision:1,text:'x',confirmed:true}})).status,403);
}));
test('provider errors, empty text, busy, timeout and malformed output never become successful OCR',()=>scenario(async f=>{
  const u=await f.upload();f.env.OCR={description,busy:true,recognize:async()=>({text:'unused'})};assert.equal((await f.recognize(u)).error.code,'OCR_BUSY');
  for(const [provider,code]of [[async()=>({text:'   '}),'OCR_EMPTY'],[async()=>{throw Object.assign(new Error('secret provider detail'),{code:'OCR_TIMEOUT'});},'OCR_TIMEOUT'],[async()=>({text:'x'.repeat(20001)}),'OCR_OUTPUT_TOO_LARGE'],[async()=>{throw new Error('secret provider detail');},'OCR_FAILED'],[async()=>{throw Object.assign(new Error('secret provider auth'),{status:401});},'OCR_FAILED']]){f.env.OCR={description,recognize:provider};const r=await f.recognize(u);assert.equal(r.status,503);assert.equal(r.error.code,code);assert(!r.error.message.includes('secret provider'));}
  const saved=f.DB.sqlite.prepare('SELECT status,raw_text FROM ocr_runs').all();assert(saved.every(r=>r.status==='failed'&&r.raw_text===null));
}));
test('revocation or image deletion during recognition discards late text',()=>scenario(async f=>{
  const u=await f.upload();f.env.OCR={description,async recognize(){f.DB.sqlite.prepare("DELETE FROM relationships WHERE adult_id=? AND student_id=?").run(f.t.id,f.s.id);return {text:'must be discarded'};}};
  assert.equal((await f.recognize(u,{requestId:id(),language:'eng'},f.t)).status,404);assert.equal(f.DB.sqlite.prepare('SELECT raw_text FROM ocr_runs').get().raw_text,null);
  f.env.OCR={description,async recognize(){f.DB.sqlite.prepare('DELETE FROM uploads WHERE id=?').run(u.id);return {text:'late deleted image'};}};assert.equal((await f.recognize(u)).status,404);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM ocr_runs').get().n,0);
}));
test('only one recognition claim is active and stale interrupted claims are explicitly failed',()=>scenario(async f=>{
  const u=await f.upload();let resolve;const pending=new Promise(r=>resolve=r);let calls=0;f.env.OCR={description,async recognize(){calls++;await pending;return {text:'one result'};}};
  const first=f.recognize(u);while(!calls)await new Promise(r=>setTimeout(r,5));const second=await f.recognize(u);assert.equal(second.status,409);resolve();assert.equal((await first).status,201);assert.equal(calls,1);
  f.DB.sqlite.prepare("UPDATE ocr_runs SET status='running',raw_text=NULL,created_at='2000-01-01T00:00:00.000Z'").run();const list=await f.request(`/uploads/${u.id}/ocr-runs`,{client:f.s});assert.equal(list.data[0].status,'failed');assert.equal(list.data[0].errorCode,'OCR_INTERRUPTED');
}));
test('OCR input is bounded and provenance remains after deleting its source image',()=>scenario(async f=>{
  f.env.OCR={description,async recognize(){return {text:'source text'};}};const u=await f.upload();assert.equal((await f.recognize(u,{requestId:id(),language:'../../private'})).status,400);assert.equal((await f.recognize(u,{requestId:id(),language:'eng',url:'https://outside.invalid'})).status,400);
  const r=(await f.recognize(u)).data;await f.request(`/ocr-runs/${r.id}/review`,{client:f.t,method:'PATCH',body:{revision:1,text:'source text',confirmed:true}});
  const body={studentId:f.s.id,title:'有来源的草稿',subject:'math',kind:'scored_paper',requestId:id(),ocrRunId:r.id};const p=(await f.request('/papers',{client:f.t,method:'POST',body})).data;
  await f.request(`/uploads/${u.id}`,{client:f.s,method:'DELETE'});assert.equal((await f.request(`/ocr-runs/${r.id}`,{client:f.t})).status,404);const v=(await f.request(`/papers/${p.id}`,{client:f.t})).data;assert.equal(v.ocrRunId,null);assert.equal(v.contentOrigin,'teacher_reviewed_ocr_text');assert(v.ocrProvenance.reviewedTextDigest);assert.equal((await f.request('/papers',{client:f.t,method:'POST',body})).data.id,p.id);
}));
