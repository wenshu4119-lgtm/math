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
export const publicUser = u => ({id:u.id,username:u.username,displayName:u.display_name,role:u.role,mustChangePassword:Boolean(u.mustChangePassword??u.must_change_password)});
// Reauthentication is checked again at the atomic write boundary. A stale
// request must not change credentials after logout, disablement or role moves.
const credentialGuard="id=? AND org_id=? AND role=? AND username=? AND password_hash=? AND active=1 AND EXISTS (SELECT 1 FROM sessions WHERE token_hash=? AND user_id=users.id AND expires_at>(julianday('now')-2440587.5)*86400000)";
const credentialGuardValues=(user,record)=>[user.id,user.org_id,user.role,user.username,record.password_hash,user.token_hash];
async function currentCredential(db,user,currentPassword){
  const record=await db.prepare('SELECT password_hash FROM users WHERE id=? AND org_id=? AND role=? AND username=? AND active=1').bind(user.id,user.org_id,user.role,user.username).first();
  if(!record)fail(409,'ACCOUNT_STATE_CHANGED','账号状态已变化，请重新登录');
  if(!passwordValid(currentPassword,record.password_hash))fail(401,'LOGIN_FAILED','当前密码不正确');
  return record;
}
async function changeCredential(db,user,record,column,value,action){
  // column is selected only by the fixed routes below, never by request input.
  const updated=await db.batch([
    db.prepare(`UPDATE users SET ${column}=?${column==='password_hash'?',must_change_password=0':''} WHERE ${credentialGuard}${column==='username'?' AND must_change_password=0':''}`).bind(value,...credentialGuardValues(user,record)),
    db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),user.org_id,user.id,action,user.id,now()),
    db.prepare('DELETE FROM sessions WHERE user_id=? AND changes()=1').bind(user.id)
  ]);
  if(updated[0].meta.changes!==1)fail(409,'ACCOUNT_STATE_CHANGED','账号或会话状态已变化，请重新登录后再修改');
}
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
    const record=await currentCredential(db,user,current);
    await changeCredential(db,user,record,'password_hash',passwordHash(next),'password_changed');
    return {data:{loginRequired:true},headers:{'Set-Cookie':cookie('',env,true)}};
  }
  if(path==='/auth/username' && method==='POST') {
    if(user.mustChangePassword)fail(403,'PASSWORD_CHANGE_REQUIRED','请先修改初始密码');
    const b=await jsonBody(request,['currentPassword','newUsername']);
    const current=textField(b.currentPassword,'当前密码',1,128),next=textField(b.newUsername,'新登录名',3,32).toLowerCase();
    if(!/^[a-z0-9_-]+$/.test(next))fail(400,'INVALID_USERNAME','登录名仅支持3–32位字母、数字、下划线或短横线');
    if(next===user.username)fail(400,'USERNAME_UNCHANGED','新登录名与当前登录名相同');
    await rateLimit(env,`username:${user.id}`,5,900000);
    const record=await currentCredential(db,user,current);
    try{await changeCredential(db,user,record,'username',next,'username_changed');}
    catch(error){if(/UNIQUE constraint failed: users\.username/.test(String(error.message)))fail(409,'USERNAME_UNAVAILABLE','该登录名不可用，请选择其他名称');throw error;}
    return {data:{loginRequired:true,username:next},headers:{'Set-Cookie':cookie('',env,true)}};
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
    const {results}=await db.prepare('SELECT id,username,display_name,role,active,must_change_password FROM users WHERE org_id=? ORDER BY created_at LIMIT 200').bind(user.org_id).all();
    return {data:results.map(u=>({...publicUser(u),active:Boolean(u.active)}))};
  }
  if(path==='/admin/users' && method==='POST') {
    const b=await jsonBody(request,['username','displayName','role']);
    const username=textField(b.username,'登录名',3,32).toLowerCase(),displayName=textField(b.displayName,'显示别名',1,32);
    if(!/^[a-z0-9_-]+$/.test(username)||!['teacher','student','parent'].includes(b.role)) fail(400,'INVALID_INPUT','登录名或角色不正确');
    const password=randomToken(),uid=id();
    await db.batch([db.prepare('INSERT INTO users (id,org_id,username,display_name,role,password_hash,must_change_password,created_at) VALUES (?,?,?,?,?,?,1,?)').bind(uid,user.org_id,username,displayName,b.role,passwordHash(password),now()),audit(db,user,'user_created',uid)]);
    return {status:201,data:{id:uid,username,displayName,role:b.role,mustChangePassword:true,initialPassword:password,notice:'初始密码仅本次返回，请安全交付。首次登录必须修改密码后才能使用业务功能。'}};
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
