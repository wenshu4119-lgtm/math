import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
test('teacher plan update rechecks relation atomically after request validation',async()=>{
  const f=await fixture();try{const t=await f.login('teacher'),s=await f.login('student'),admin=await f.login('admin');await f.review(t);
    const a=(await f.request('/attempts',{client:s,method:'POST',body:{studentId:s.id,subject:'math',phase:'diagnostic'}})).data;await f.request(`/attempts/${a.id}/submit`,{client:s,method:'POST',body:{answers:f.correctAnswers(a)}});const p=(await f.request('/packs',{client:s,method:'POST',body:{diagnosticId:a.id}})).data;
    const link=(await f.request('/admin/relationships',{client:admin})).data.find(r=>r.kind==='teacher');const original=f.DB.batch.bind(f.DB);let revoked=false;
    f.DB.batch=async statements=>{if(!revoked){revoked=true;assert.equal((await f.request(`/admin/relationships/${link.id}`,{client:admin,method:'DELETE'})).status,200);}return original(statements);};
    const denied=await f.request(`/packs/${p.id}`,{client:t,method:'PATCH',body:{revision:p.revision,knowledgeIds:p.knowledgeIds,teacherNote:'must not be saved after revocation',approve:true}});assert.equal(denied.status,404);
    const actual=(await f.request(`/packs/${p.id}`,{client:s})).data;assert.equal(actual.revision,1);assert.equal(actual.status,'draft');assert.equal(actual.teacherNote,'');assert.equal(f.DB.sqlite.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='pack_reviewed'").get().n,0);
  }finally{f.close();}
});
