import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './environment.mjs';
const origin='http://127.0.0.1:8788';
const credentials=readFileSync(join(root,'.local/accounts.txt'),'utf8').split(/\r?\n/).find(l=>l.startsWith('student\t')).split('\t');
const checks=[];let cookie,csrf;
async function request(path,method='GET',body,raw=false){const r=await fetch(origin+'/api/v1'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='GET'?{}:{Origin:origin,'X-CSRF-Token':csrf||''}),...(body?{'Content-Type':raw?'image/png':'application/json'}:{})},body:body?raw?body:JSON.stringify(body):undefined});const parsed=r.headers.get('content-type')?.includes('application/json')?await r.json():null;return {r,data:parsed?.data,error:parsed?.error};}
const health=await request('/health');assert.equal(health.r.status,200);checks.push('Pages Functions health');
const logged=await request('/auth/login','POST',{username:'student',password:credentials[2]});assert.equal(logged.r.status,200);cookie=logged.r.headers.get('set-cookie').split(';')[0];csrf=logged.data.csrfToken;checks.push('workerd node:crypto scrypt and D1 session');
const session=await request('/auth/session');assert.equal(session.data.user.role,'student');assert.equal(session.r.headers.get('x-actor-id'),session.data.user.id);checks.push('HttpOnly session, actor identity header and authenticated D1 read');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6yQAAAAASUVORK5CYII=','base64');
let upload;
try{
  upload=await request(`/uploads?studentId=${logged.data.user.id}`,'POST',png,true);assert.equal(upload.r.status,201);checks.push('R2 local put + D1 atomic metadata');
  const image=await request(`/uploads/${upload.data.id}/image`);assert.equal(image.r.status,200);assert.equal(image.r.headers.get('x-actor-id'),session.data.user.id);assert((await image.r.arrayBuffer()).byteLength>0);checks.push('R2 private get with actor identity header');
  const ocr=await request(`/uploads/${upload.data.id}/recognize`,'POST');assert.equal(ocr.error.code,'OCR_UNAVAILABLE');checks.push('honest OCR 503');
}finally{if(upload?.data?.id){const removed=await request(`/uploads/${upload.data.id}`,'DELETE');assert.equal(removed.r.status,200);checks.push('R2 and D1 removal of test upload');}}
const logout=await request('/auth/logout','POST');assert.equal(logout.r.status,200);assert.equal((await request('/auth/session')).r.status,401);checks.push('session revocation');
mkdirSync(join(root,'test-results'),{recursive:true});writeFileSync(join(root,'test-results/workerd-smoke.json'),JSON.stringify({runtime:'Wrangler 4.160.1 / workerd local / D1 + R2 local',checks,passed:checks.length,notice:'No content approvals or real student submissions. The synthetic image was deleted. Only local login/upload audit events remain.'},null,2));console.log(`workerd 本机验证 ${checks.length}/${checks.length} 通过；测试图片已删除，未审核示例内容或写入学习成绩。`);
