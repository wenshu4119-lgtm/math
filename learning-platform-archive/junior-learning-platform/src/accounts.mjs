import { audit,allowStudent,authenticate,cookie,digest,fail,hmac,id,jsonBody,now,passwordHash,passwordValid,randomToken,rateLimit,requireRole,textField } from './security.mjs';

export async function login(request,env) {
  const b=await jsonBody(request,['username','password']);
  const username=textField(b.username,'登录名',3,32).toLowerCase();
  const password=textField(b.password,'密码',1,128);
  await rateLimit(env,`login-ip:${request.headers.get('cf-connecting-ip')||'local'}`,60,900000);
  await rateLimit(env,`login-user:${username}`,10,900000);
  const user=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
  const dummy=`scrypt:16384:8:5:${'0'.repeat(32)}:${'0'.repeat(64)}`;
  const valid=passwordValid(password,user?.password_hash||dummy);
  if(!user || !valid || !user.active) fail(401,'LOGIN_FAILED','登录名或密码不正确');
  const token=randomToken();
  const issued=await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at<=? OR (user_id=? AND EXISTS (SELECT 1 FROM users WHERE id=? AND active=1 AND password_hash=?))').bind(Date.now(),user.id,user.id,user.password_hash),
    env.DB.prepare('INSERT INTO sessions SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND active=1 AND password_hash=?)').bind(digest(token),user.id,Date.now()+28800000,user.id,user.password_hash),
    env.DB.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),user.org_id,user.id,'login',user.id,now())
  ]);
  if(issued[1].meta.changes!==1)fail(401,'LOGIN_FAILED','登录名或密码不正确');
  return {data:{user:publicUser(user),csrfToken:hmac(env.SESSION_SECRET,`csrf:${token}`)},headers:{'Set-Cookie':cookie(token,env)}};
}
export const publicUser = u => ({id:u.id,username:u.username,displayName:u.display_name,role:u.role});
export async function accountRoutes(request,env,path,user,session) {
  const db=env.DB,method=request.method;
  if(path==='/auth/session' && method==='GET') return {data:{user:publicUser(user),csrfToken:session.csrfToken}};
  if(path==='/auth/logout' && method==='POST') {
    await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.token_hash).run();
    return {data:{loggedOut:true},headers:{'Set-Cookie':cookie('',env,true)}};
  }
  if(path==='/auth/password' && method==='POST') {
    const b=await jsonBody(request,['currentPassword','newPassword']);
    const current=textField(b.currentPassword,'当前密码',1,128), next=textField(b.newPassword,'新密码',12,128);
    await rateLimit(env,`password:${user.id}`,5,900000);
    const record=await db.prepare('SELECT password_hash FROM users WHERE id=?').bind(user.id).first();
    if(!passwordValid(current,record.password_hash)) fail(401,'LOGIN_FAILED','当前密码不正确');
    const updated=await db.batch([db.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=? AND active=1').bind(passwordHash(next),user.id,record.password_hash),db.prepare('DELETE FROM sessions WHERE user_id=? AND changes()=1').bind(user.id)]);
    if(updated[0].meta.changes!==1)fail(409,'VERSION_CONFLICT','账号状态已变化，请重新登录');
    await audit(db,user,'password_changed',user.id).run();
    return {data:{loginRequired:true},headers:{'Set-Cookie':cookie('',env,true)}};
  }
  if(path==='/students' && method==='GET') {
    if(user.role==='admin') return {data:[]};
    const result=user.role==='student'
      ? await db.prepare("SELECT id,display_name FROM users WHERE id=? AND active=1").bind(user.id).all()
      : await db.prepare("SELECT u.id,u.display_name FROM relationships r JOIN users u ON u.id=r.student_id WHERE r.adult_id=? AND r.kind=? AND r.org_id=? AND u.active=1 ORDER BY u.display_name").bind(user.id,user.role,user.org_id).all();
    return {data:result.results.map(s=>({id:s.id,displayName:s.display_name}))};
  }
  if(!path.startsWith('/admin/')) return null;
  requireRole(user,'admin');
  if(path==='/admin/users' && method==='GET') {
    const {results}=await db.prepare('SELECT id,username,display_name,role,active FROM users WHERE org_id=? ORDER BY created_at LIMIT 200').bind(user.org_id).all();
    return {data:results.map(u=>({...publicUser(u),active:Boolean(u.active)}))};
  }
  if(path==='/admin/users' && method==='POST') {
    const b=await jsonBody(request,['username','displayName','role']);
    const username=textField(b.username,'登录名',3,32).toLowerCase(),displayName=textField(b.displayName,'显示别名',1,32);
    if(!/^[a-z0-9_-]+$/.test(username)||!['teacher','student','parent'].includes(b.role)) fail(400,'INVALID_INPUT','登录名或角色不正确');
    const password=randomToken(),uid=id();
    await db.batch([db.prepare('INSERT INTO users (id,org_id,username,display_name,role,password_hash,created_at) VALUES (?,?,?,?,?,?,?)').bind(uid,user.org_id,username,displayName,b.role,passwordHash(password),now()),audit(db,user,'user_created',uid)]);
    return {status:201,data:{id:uid,username,displayName,role:b.role,initialPassword:password,notice:'初始密码仅本次返回，请安全交付并修改。'}};
  }
  let match=path.match(/^\/admin\/users\/([^/]+)$/);
  if(match && method==='PATCH') {
    const b=await jsonBody(request,['active']);
    if(typeof b.active!=='boolean') fail(400,'INVALID_INPUT','active 必须为布尔值');
    const target=await db.prepare("SELECT id FROM users WHERE id=? AND org_id=? AND role!='admin'").bind(match[1],user.org_id).first();
    if(!target) fail(404,'NOT_FOUND','账号不存在或不可修改');
    await db.batch([db.prepare('UPDATE users SET active=? WHERE id=?').bind(b.active?1:0,target.id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(target.id),audit(db,user,b.active?'user_enabled':'user_disabled',target.id)]);
    return {data:{id:target.id,active:b.active}};
  }
  if(path==='/admin/relationships' && method==='GET') return {data:(await db.prepare('SELECT id,adult_id AS adultId,student_id AS studentId,kind FROM relationships WHERE org_id=? ORDER BY created_at LIMIT 200').bind(user.org_id).all()).results};
  if(path==='/admin/relationships' && method==='POST') {
    const b=await jsonBody(request,['adultId','studentId']);
    const adult=await db.prepare("SELECT id,role FROM users WHERE id=? AND org_id=? AND active=1 AND role IN ('teacher','parent')").bind(textField(b.adultId,'成人账号'),user.org_id).first();
    const student=await db.prepare("SELECT id FROM users WHERE id=? AND org_id=? AND active=1 AND role='student'").bind(textField(b.studentId,'学生账号'),user.org_id).first();
    if(!adult || !student) fail(400,'INVALID_RELATIONSHIP','只能绑定本机构有效老师/家长与学生');
    const rid=id();
    await db.batch([db.prepare('INSERT INTO relationships VALUES (?,?,?,?,?,?,?)').bind(rid,user.org_id,adult.id,student.id,adult.role,user.id,now()),audit(db,user,'relationship_created',rid)]);
    return {status:201,data:{id:rid,adultId:adult.id,studentId:student.id,kind:adult.role}};
  }
  match=path.match(/^\/admin\/relationships\/([^/]+)$/);
  if(match && method==='DELETE') {
    const found=await db.prepare('SELECT id FROM relationships WHERE id=? AND org_id=?').bind(match[1],user.org_id).first();
    if(!found) fail(404,'NOT_FOUND','绑定不存在');
    await db.batch([db.prepare('DELETE FROM relationships WHERE id=?').bind(found.id),audit(db,user,'relationship_revoked',found.id)]);
    return {data:{revoked:true}};
  }
  if(path==='/admin/audit' && method==='GET') return {data:(await db.prepare('SELECT action,actor_id AS actorId,resource_id AS resourceId,created_at AS createdAt FROM audit_events WHERE org_id=? ORDER BY created_at DESC LIMIT 100').bind(user.org_id).all()).results};
  return null;
}
