import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,PNG} from '../tests/helpers.mjs';

const output=new URL('../test-results/production-readiness/upload-revocation.json',import.meta.url);
const report={
  startedAt:new Date().toISOString(),
  scope:'Local isolated SQLite fixture and real API routes; synthetic users and PNG only. Object storage is the fixture in-memory adapter. The storage operation is paused to produce a deterministic authorization interleaving; API success/error responses are not mocked.',
  sourceHashes:{},cases:[],completed:false
};
for(const name of ['src/uploads.mjs','src/accounts.mjs','src/security.mjs'])report.sourceHashes[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
function gate(){
  let enter,release;const entered=new Promise(resolve=>enter=resolve),blocked=new Promise(resolve=>release=resolve);
  return {enter,release,blocked,async wait(){let timer;try{await Promise.race([entered,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Storage pause was not reached within 5 seconds')),5000);})]);}finally{clearTimeout(timer);}}};
}
async function setup(){
  const f=await fixture(),teacher=await f.login('teacher'),admin=await f.login('admin'),student=await f.login('student');
  const links=await f.request('/admin/relationships',{client:admin});assert.equal(links.status,200);
  const relationship=links.data.find(link=>link.adultId===teacher.id&&link.studentId===student.id);assert(relationship);
  const upload=()=>f.request(`/uploads?studentId=${student.id}`,{client:teacher,method:'POST',body:PNG,raw:true,headers:{'Content-Type':'image/png'}});
  async function revoke(){const r=await f.request(`/admin/relationships/${relationship.id}`,{client:admin,method:'DELETE'});assert.equal(r.status,200);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM relationships WHERE id=?').get(relationship.id).n,0);return r.status;}
  const count=()=>f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM uploads WHERE student_id=?').get(student.id).n;
  return {...f,teacher,admin,student,upload,revoke,count};
}

try{
  {
    const f=await setup(),pause=gate();let pending;
    try{
      const originalPut=f.env.PAPERS.put.bind(f.env.PAPERS);
      f.env.PAPERS.put=async(...args)=>{pause.enter();await pause.blocked;return originalPut(...args);};
      pending=f.upload();await pause.wait();
      assert.equal(f.count(),0);assert.equal(f.objects.size,0);
      const revoked=await f.revoke();pause.release();
      const response=await pending;
      const rows=f.count(),objects=f.objects.size;
      const audit=f.DB.sqlite.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='image_uploaded' AND actor_id=?").get(f.teacher.id).n;
      const studentList=await f.request(`/uploads?studentId=${f.student.id}`,{client:f.student});assert.equal(studentList.status,200);
      const teacherList=await f.request(`/uploads?studentId=${f.student.id}`,{client:f.teacher});assert.equal(teacherList.status,404);
      report.cases.push({
        name:'POST upload: revoke after authorization while PAPERS.put is paused',
        ordering:['teacher authorization succeeds','PAPERS.put paused before actual storage write','admin revokes relationship via DELETE API','PAPERS.put resumes','upload route finishes'],
        revocationStatus:revoked,requestStatus:response.status,errorCode:response.error?.code||null,
        databaseUploadsAfter:rows,storageObjectsAfter:objects,successfulUploadAuditEvents:audit,
        studentVisibleUploads:studentList.data.length,revokedTeacherListStatus:teacherList.status,
        reproduced:response.status===404&&rows===1&&objects===1&&audit===1&&studentList.data.length===1,
        conclusion:response.status===404&&rows===1?'The HTTP request reports NOT_FOUND after revocation, but the newly uploaded object, DB record and success audit already persist.':'Observed outcome differs from the original suspected race; inspect recorded values.'
      });
    }finally{pause.release();if(pending)await pending.catch(()=>{});f.close();}
  }
  {
    const f=await setup(),pause=gate();let pending;
    try{
      const created=await f.upload();assert.equal(created.status,201);assert.equal(f.count(),1);assert.equal(f.objects.size,1);
      const originalDelete=f.env.PAPERS.delete.bind(f.env.PAPERS);
      f.env.PAPERS.delete=async(...args)=>{pause.enter();await pause.blocked;return originalDelete(...args);};
      pending=f.request(`/uploads/${created.data.id}`,{client:f.teacher,method:'DELETE'});await pause.wait();
      const revoked=await f.revoke();pause.release();
      const response=await pending;
      const rows=f.count(),objects=f.objects.size;
      const audit=f.DB.sqlite.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='image_deleted' AND actor_id=?").get(f.teacher.id).n;
      const studentList=await f.request(`/uploads?studentId=${f.student.id}`,{client:f.student});assert.equal(studentList.status,200);
      report.cases.push({
        name:'DELETE upload: revoke after authorization while PAPERS.delete is paused',
        ordering:['existing upload is created normally','teacher delete authorization succeeds','PAPERS.delete paused before actual physical deletion','admin revokes relationship via DELETE API','PAPERS.delete resumes','delete route finishes'],
        revocationStatus:revoked,requestStatus:response.status,errorCode:response.error?.code||null,
        databaseUploadsBefore:1,storageObjectsBefore:1,databaseUploadsAfter:rows,storageObjectsAfter:objects,
        successfulDeleteAuditEvents:audit,studentVisibleUploads:studentList.data.length,
        reproduced:response.status===200&&rows===0&&objects===0&&audit===1,
        conclusion:response.status===200&&rows===0&&objects===0?'The revoked teacher operation still removes the stored image and DB record, records a successful deletion, and returns HTTP 200.':'Observed outcome differs from the original suspected race; inspect recorded values.'
      });
    }finally{pause.release();if(pending)await pending.catch(()=>{});f.close();}
  }
  report.completed=true;report.allSuspectedRacesReproduced=report.cases.every(result=>result.reproduced);
  console.log(JSON.stringify({completed:report.completed,cases:report.cases.map(result=>({name:result.name,status:result.requestStatus,rows:result.databaseUploadsAfter,objects:result.storageObjectsAfter,reproduced:result.reproduced}))},null,2));
}finally{
  report.finishedAt=new Date().toISOString();await mkdir(new URL('../test-results/production-readiness/',import.meta.url),{recursive:true});await writeFile(output,JSON.stringify(report,null,2));
}
