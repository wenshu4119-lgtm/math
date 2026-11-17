import { randomBytes, createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const fail = (status, code, message) => { throw new ApiError(status, code, message); };
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const randomToken = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const hmac = (secret,value) => createHmac('sha256',secret).update(value).digest('hex');
export const equal = (a,b) => {
  if(typeof a!=='string'||typeof b!=='string')return false;
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length && timingSafeEqual(left,right);
};
export function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `scrypt:16384:8:5:${salt}:${scryptSync(password,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024}).toString('hex')}`;
}
export function passwordValid(password, encoded) {
  if (!encoded?.startsWith('scrypt:16384:8:5:')) return false;
  return equal(passwordHash(password,encoded.split(':')[4]),encoded);
}
export function textField(value, name, min = 1, max = 120) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) fail(400,'INVALID_INPUT',`${name} 格式或长度不正确`);
  return value.trim();
}
export function exactKeys(body, allowed) {
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(k=>!allowed.includes(k))) fail(400,'INVALID_INPUT','请求字段不正确');
}
export async function readLimited(request, max = 65536) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > max) fail(413,'BODY_TOO_LARGE','请求内容过大');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let total = 0; const parts = [];
  for (;;) {
    const {value,done} = await reader.read(); if (done) break;
    total += value.length;
    if (total > max) { await reader.cancel(); fail(413,'BODY_TOO_LARGE','请求内容过大'); }
    parts.push(value);
  }
  const result = new Uint8Array(total); let offset=0;
  for(const part of parts) { result.set(part,offset); offset+=part.length; }
  return result;
}
export async function jsonBody(request,allowed) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') fail(415,'JSON_REQUIRED','需要 application/json');
  let body;
  try { body=JSON.parse(new TextDecoder().decode(await readLimited(request))); }
  catch(e) { if (e instanceof ApiError) throw e; fail(400,'INVALID_JSON','JSON 格式不正确'); }
  exactKeys(body,allowed); return body;
}
export function checkOrigin(request,env) {
  if (request.headers.get('origin') !== env.APP_ORIGIN) fail(403,'ORIGIN_REJECTED','请求来源不允许');
}
export function cookieName(env) { return env.APP_ENV === 'local' ? 'lp_session' : '__Host-lp_session'; }
export function cookie(token,env,logout=false) {
  return `${cookieName(env)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${logout?0:28800}${env.APP_ENV==='local'?'':'; Secure'}`;
}
export async function authenticate(request,env) {
  const token=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${cookieName(env)}=`))?.split('=')[1];
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) fail(401,'UNAUTHENTICATED','请先登录');
  const user = await env.DB.prepare('SELECT u.id,u.org_id,u.role,u.display_name,u.username,u.must_change_password AS mustChangePassword,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(digest(token),Date.now()).first();
  if (!user) fail(401,'UNAUTHENTICATED','登录已失效，请重新登录');
  user.mustChangePassword=Boolean(user.mustChangePassword);
  if (!['GET','HEAD'].includes(request.method) && !equal(request.headers.get('x-csrf-token'),hmac(env.SESSION_SECRET,`csrf:${token}`))) fail(403,'CSRF_REJECTED','会话校验失败，请刷新后重试');
  return {user,csrfToken:hmac(env.SESSION_SECRET,`csrf:${token}`)};
}
export function requireRole(user,...roles) { if (!roles.includes(user.role)) fail(403,'FORBIDDEN','当前角色没有此权限'); }
export async function allowStudent(env,user,studentId,summary=false) {
  const student=await env.DB.prepare("SELECT id,display_name FROM users WHERE id=? AND org_id=? AND role='student' AND active=1").bind(studentId,user.org_id).first();
  const own = user.role==='student' && user.id===studentId;
  const canLink = user.role==='teacher' || (summary && user.role==='parent');
  const link = canLink && await env.DB.prepare('SELECT id FROM relationships WHERE org_id=? AND adult_id=? AND student_id=? AND kind=?').bind(user.org_id,user.id,studentId,user.role).first();
  if (!student || !(own || link)) fail(404,'NOT_FOUND','记录不存在或无权访问');
  return student;
}
export async function rateLimit(env,key,max=30,windowMs=60000) {
  const at=Date.now(); const hashed=hmac(env.SESSION_SECRET,key);
  const row=await env.DB.prepare('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING count')
    .bind(hashed,at+windowMs,at,at,at+windowMs).first();
  if (row.count>max) fail(429,'RATE_LIMITED','操作过于频繁，请稍后重试');
}
export function audit(db,user,action,resourceId) {
  return db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?)').bind(id(),user.org_id,user.id,action,resourceId,now());
}
export const securityHeaders = {
  'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
};
