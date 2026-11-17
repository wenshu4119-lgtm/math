import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
test('legacy review cannot commit after teacher privilege is revoked during content lookup',async()=>{
 const f=await fixture();try{
  const teacher=await f.login('teacher'),original=f.DB.prepare.bind(f.DB);let injected=false;
  f.DB.prepare=sql=>{const s=original(sql);if(sql==='SELECT * FROM knowledge WHERE id=? AND version=?'){const first=s.first;s.first=async()=>{const value=await first.call(s);if(!injected){injected=true;f.DB.sqlite.prepare("UPDATE users SET role='parent' WHERE id=?").run(teacher.id);}return value;};}return s;};
  const result=await f.request('/content/math-equation/review',{client:teacher,method:'POST',body:{version:1,confirmed:true}});
  assert.equal(result.status,409);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM content_reviews').get().n,0);
  assert.equal(f.DB.sqlite.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='content_reviewed'").get().n,0);
 }finally{f.close();}
});
test('legacy review queue rechecks session after assembling answers',async()=>{
 const f=await fixture();try{
  const teacher=await f.login('teacher'),original=f.DB.prepare.bind(f.DB);let injected=false;
  f.DB.prepare=sql=>{const s=original(sql);if(sql==='SELECT * FROM questions WHERE knowledge_id=? ORDER BY phase'){const all=s.all;s.all=async()=>{const value=await all.call(s);if(!injected){injected=true;f.DB.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(teacher.id);}return value;};}return s;};
  const result=await f.request('/content/review-queue',{client:teacher});assert.equal(result.status,404);assert.equal(result.data,undefined);
 }finally{f.close();}
});
