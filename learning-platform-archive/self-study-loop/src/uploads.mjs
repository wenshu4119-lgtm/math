import { allowStudent,fail,id,jsonBody,now,readLimited,requireRole,textField } from './security.mjs';
import { capabilities } from './ocr.mjs';

// Recheck the session and both current account identities at the SQL publication
// point, after any storage/body await. Never trust a previously resolved relation.
const permission=`EXISTS (SELECT 1 FROM users a JOIN users s ON s.org_id=a.org_id
 WHERE a.id=? AND a.org_id=? AND a.role=? AND a.active=1 AND s.id=? AND s.role='student' AND s.active=1
 AND EXISTS (SELECT 1 FROM sessions se WHERE se.user_id=a.id AND se.token_hash=? AND se.expires_at>?)
 AND ((a.role='student' AND a.id=s.id) OR (a.role='teacher' AND EXISTS
 (SELECT 1 FROM relationships r WHERE r.org_id=a.org_id AND r.adult_id=a.id AND r.student_id=s.id AND r.kind='teacher'))))`;
const permissionArgs=(user,studentId)=>[user.id,user.org_id,user.role,studentId,user.token_hash,Date.now()];
const conditionalAudit=(db,user,action,key)=>db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),user.org_id,user.id,action,key,now());
async function guardedUpload(env,user,uid,{pending=false}={}){
 const args=permissionArgs(user,null);args.splice(3,1);
 const row=await env.DB.prepare(`SELECT * FROM uploads WHERE id=? AND org_id=? AND (expires_at>? ${pending?'OR expires_at=0':''}) AND ${permission.replace('s.id=?','s.id=uploads.student_id')}`).bind(uid,user.org_id,Date.now(),...args).first();
 if(!row)fail(404,'NOT_FOUND','图片不存在、已过期或授权已失效');
 return row;
}
async function visibleMetadata(env,user,row){const value=await metadata(env,row);await guardedUpload(env,user,row.id);return value;}

// Trusted maintenance hook, never a public route. expires_at=0 is a committed
// deletion/cleanup intent, not a restorable upload. A failed store delete keeps it.
export async function cleanupPendingUploads(env,{limit=25}={}){
 if(!env.PAPERS) fail(503,'STORAGE_UNAVAILABLE','私有清理存储未配置，未执行清理');
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid cleanup limit');
 const rows=(await env.DB.prepare('SELECT id,object_key FROM uploads WHERE expires_at=0 LIMIT ?').bind(limit).all()).results;
 let deleted=0,pending=0;for(const row of rows){try{await env.PAPERS.delete(row.object_key);const r=await env.DB.prepare('DELETE FROM uploads WHERE id=? AND object_key=? AND expires_at=0').bind(row.id,row.object_key).run();deleted+=r.meta.changes;}catch{pending++;}}
 return {deleted,pending};
}

// Bounded structural validation and metadata removal; not a general image decoder.
export function cleanImage(bytes,mime) {
  const bad=()=>fail(415,'INVALID_IMAGE','仅支持结构完整、尺寸受限的 PNG 或 JPEG 图片');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const dim=(w,h)=>{if(w<1||h<1||w>6000||h>6000||w*h>12000000) bad();};
  const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
  if(mime==='image/png') {
    if(bytes.length<45 || ![137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)) bad();
    let pos=8,header=false,data=false,end=false; const parts=[bytes.slice(0,8)];
    while(pos+12<=bytes.length) {
      const len=view.getUint32(pos),type=String.fromCharCode(...bytes.slice(pos+4,pos+8));
      if(len>bytes.length-pos-12) bad();
      if(!header && type!=='IHDR') bad();
      if(type==='IHDR') {if(header||len!==13) bad();header=true;dim(view.getUint32(pos+8),view.getUint32(pos+12));}
      if(type==='IDAT') data=true;
      if(['IHDR','PLTE','IDAT','IEND','tRNS'].includes(type)) parts.push(bytes.slice(pos,pos+12+len));
      if(type==='IEND') {if(len!==0||!data||pos+12!==bytes.length) bad();end=true;break;}
      pos+=12+len;
    }
    if(!header||!data||!end) bad();return concat(parts);
  }
  if(mime==='image/jpeg') {
    if(bytes.length<10||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217) bad();
    const parts=[bytes.slice(0,2)];let pos=2,dimensions=false,scan=false;
    while(pos+4<=bytes.length) {
      if(bytes[pos]!==255) bad();const marker=bytes[pos+1];
      if(marker===0xda) {if(!dimensions) bad();const len=view.getUint16(pos+2);if(len<2||pos+2+len>=bytes.length-2) bad();parts.push(bytes.slice(pos));scan=true;break;}
      const len=view.getUint16(pos+2);if(len<2||pos+2+len>bytes.length) bad();
      if([0xc0,0xc1,0xc2].includes(marker)) {if(len<8) bad();dim(view.getUint16(pos+7),view.getUint16(pos+5));dimensions=true;}
      // Strip APP1..APP15 and comments, which may contain EXIF/GPS/user data.
      if(!(marker>=0xe1&&marker<=0xef)&&marker!==0xfe) parts.push(bytes.slice(pos,pos+2+len));
      pos+=2+len;
    }
    if(!scan) bad();return concat(parts);
  }
  bad();
}
async function metadata(env,row) {const latest=await env.DB.prepare('SELECT id,status FROM ocr_runs WHERE upload_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').bind(row.id).first(),available=capabilities(env).ocr.available;return {id:row.id,studentId:row.student_id,status:row.status,ocrStatus:latest?.status||(available?'ready':'unavailable'),ocrRunId:latest?.id||null,correctedText:row.corrected_text,revision:row.revision,expiresAt:row.expires_at,notice:available?'本地OCR仅提供待核对文字，必须经教师确认；不会自动生成题目或成绩。':'当前OCR未接通；已有识别记录仍须教师核对，或继续人工录入。不会自动成为已审核题目或学习成绩。'};}
async function getUpload(env,user,uid) {
  return guardedUpload(env,user,uid);
}
export async function uploadRoutes(request,env,path,user,url) {
  const db=env.DB,method=request.method;
  if(path==='/uploads' && method==='GET') {
    const studentId=textField(url.searchParams.get('studentId'),'学生');await allowStudent(env,user,studentId);
    const records=await Promise.all((await db.prepare('SELECT * FROM uploads WHERE student_id=? AND org_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 30').bind(studentId,user.org_id,Date.now()).all()).results.map(row=>metadata(env,row)));
    if(!await db.prepare(`SELECT 1 AS allowed WHERE ${permission}`).bind(...permissionArgs(user,studentId)).first())fail(404,'NOT_FOUND','当前授权已失效');
    const visible=(await db.prepare(`SELECT id FROM uploads WHERE student_id=? AND org_id=? AND expires_at>? AND ${permission}`).bind(studentId,user.org_id,Date.now(),...permissionArgs(user,studentId)).all()).results;
    const ids=new Set(visible.map(r=>r.id));return {data:records.filter(r=>ids.has(r.id))};
  }
  if(path==='/uploads' && method==='POST') {
    requireRole(user,'student','teacher');
    const studentId=textField(url.searchParams.get('studentId'),'学生');await allowStudent(env,user,studentId);
    if(!env.PAPERS) fail(503,'STORAGE_UNAVAILABLE','图片存储未配置，请稍后再试');
    const mime=request.headers.get('content-type')?.split(';')[0];
    if(!['image/png','image/jpeg'].includes(mime)) fail(415,'INVALID_IMAGE','只接受 PNG 或 JPEG，不接受 SVG/PDF');
    const bytes=cleanImage(await readLimited(request,2*1024*1024),mime);
    const uid=id(),key=`${user.org_id}/${uid}`,created=now(),expires=Date.now()+86400000;
    async function discardUnpublished(){
      try{await env.PAPERS.delete(key);}catch{
        // Record inaccessible cleanup work, not a published student upload. This
        // also covers a put that wrote bytes before its acknowledgement failed.
        await db.prepare("INSERT OR IGNORE INTO uploads (id,org_id,student_id,object_key,mime,size,status,ocr_status,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,'needs_review','unavailable',?,?,0)").bind(uid,user.org_id,studentId,key,mime,bytes.length,user.id,created).run();
      }
    }
    try {await env.PAPERS.put(key,bytes,{httpMetadata:{contentType:mime}});}
    catch {await discardUnpublished();fail(503,'STORAGE_UNAVAILABLE','图片存储暂不可用，未发布上传；私有残留将由清理任务重试');}
    try {
      const saved=await db.batch([db.prepare(`INSERT INTO uploads (id,org_id,student_id,object_key,mime,size,status,ocr_status,created_by,created_at,expires_at) SELECT ?,?,?,?,?,?,'needs_review','unavailable',?,?,? WHERE ${permission}`).bind(uid,user.org_id,studentId,key,mime,bytes.length,user.id,created,expires,...permissionArgs(user,studentId)),conditionalAudit(db,user,'image_uploaded',uid)]);
      if(saved[0].meta.changes!==1)fail(404,'NOT_FOUND','上传前授权已失效，没有发布图片');
    } catch(e) {
      // A database acknowledgement can fail after commit. Never remove a blob
      // already referenced by a committed row; an indeterminate DB read also
      // must not trigger destructive compensation.
      let existing;try{existing=await db.prepare('SELECT id FROM uploads WHERE id=? AND object_key=?').bind(uid,key).first();}catch{throw e;}
      if(!existing)await discardUnpublished();throw e;
    }
    return {status:201,data:await visibleMetadata(env,user,await getUpload(env,user,uid))};
  }
  const match=path.match(/^\/uploads\/([^/]+)(?:\/(image|recognize|review))?$/);
  if(!match) return null;
  const row=await guardedUpload(env,user,match[1],{pending:!match[2]&&method==='DELETE'});
  if(!match[2] && method==='GET') return {data:await visibleMetadata(env,user,row)};
  if(match[2]==='image' && method==='GET') {
    const object=await env.PAPERS?.get(row.object_key);
    if(!object) fail(404,'NOT_FOUND','图片不存在');
    try{await getUpload(env,user,row.id);}catch(error){try{await object.body?.cancel?.();}catch{}throw error;}
    return {raw:object.body,headers:{'Content-Type':row.mime,'Content-Disposition':`attachment; filename="paper.${row.mime==='image/png'?'png':'jpg'}"`}};
  }
  if(match[2]==='review' && method==='PATCH') {
    requireRole(user,'student','teacher');
    const b=await jsonBody(request,['text','confirmed','revision']);
    const text=textField(b.text,'核对文本',1,10000);
    if(b.confirmed!==true) fail(400,'REVIEW_REQUIRED','请确认已对照原图人工核对');
    if(!Number.isInteger(b.revision)) fail(400,'INVALID_INPUT','需要 revision');
    const result=await db.batch([db.prepare(`UPDATE uploads SET corrected_text=?,status='confirmed',confirmed_by=?,revision=revision+1 WHERE id=? AND org_id=? AND revision=? AND expires_at>? AND ${permission}`).bind(text,user.id,row.id,user.org_id,b.revision,Date.now(),...permissionArgs(user,row.student_id)),conditionalAudit(db,user,'image_manually_confirmed',row.id)]);
    if(result[0].meta.changes!==1){await getUpload(env,user,row.id);fail(409,'VERSION_CONFLICT','核对记录已更新，请重新加载');}
    return {data:await visibleMetadata(env,user,await getUpload(env,user,row.id))};
  }
  if(!match[2] && method==='DELETE') {
    if(!env.PAPERS) fail(503,'STORAGE_UNAVAILABLE','图片存储未配置');
    // The guarded tombstone transaction is the deletion authorization/commit
    // point. Revocation afterwards cannot undo an already accepted deletion.
    const claimed=await db.batch([db.prepare(`UPDATE uploads SET expires_at=0,revision=revision+1 WHERE id=? AND org_id=? AND revision=? AND (expires_at>? OR expires_at=0) AND ${permission}`).bind(row.id,user.org_id,row.revision,Date.now(),...permissionArgs(user,row.student_id)),conditionalAudit(db,user,'image_delete_requested',row.id)]);
    if(claimed[0].meta.changes!==1){await guardedUpload(env,user,row.id,{pending:true});fail(409,'VERSION_CONFLICT','图片状态已更新，请重新读取');}
    try{await env.PAPERS.delete(row.object_key);}catch{fail(503,'DELETE_PENDING','图片已停止访问，物理清理尚未确认完成，请重试删除或由私有清理任务处理');}
    await db.batch([db.prepare('DELETE FROM uploads WHERE id=? AND object_key=? AND expires_at=0').bind(row.id,row.object_key),conditionalAudit(db,user,'image_deleted',row.id)]);
    return {data:{deleted:true}};
  }
  return null;
}
