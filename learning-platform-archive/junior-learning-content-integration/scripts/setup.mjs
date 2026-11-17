import { existsSync,mkdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomToken,id,now,passwordHash } from '../src/security.mjs';
import { seedContent } from '../src/content.mjs';
import { openDatabase,migrate } from './local-db.mjs';
import { root } from './environment.mjs';

mkdirSync(join(root,'.local'),{recursive:true});
if(!existsSync(join(root,'.dev.vars'))) writeFileSync(join(root,'.dev.vars'),`SESSION_SECRET=${randomToken()}\nAPP_ORIGIN=http://127.0.0.1:8788\nAPP_ENV=local\n`,{flag:'wx'});
const db=openDatabase(join(root,'.local','learning.sqlite'));migrate(db);await seedContent(db);
const existing=await db.prepare('SELECT id FROM organizations LIMIT 1').first();
if(!existing) {
  const org=id();await db.prepare('INSERT INTO organizations VALUES (?,?)').bind(org,'本地示例机构').run();
  const users=[],secrets=[];
  for(const [username,display,role] of [['admin','管理员','admin'],['teacher','示例老师','teacher'],['student','同学 A','student'],['parent','示例家长','parent'],['student-b','同学 B（未关联）','student'],['teacher-b','另一位老师（未关联）','teacher']]) {
    const uid=id(),password=randomToken();
    users.push({id:uid,role,username});
    await db.prepare('INSERT INTO users (id,org_id,username,display_name,role,password_hash,created_at) VALUES (?,?,?,?,?,?,?)').bind(uid,org,username,display,role,passwordHash(password),now()).run();
    secrets.push(`${username}\t${display}\t${password}`);
  }
  for(const name of ['teacher','parent']) {
    const adult=users.find(u=>u.username===name),student=users.find(u=>u.username==='student');
    await db.prepare('INSERT INTO relationships VALUES (?,?,?,?,?,?,?)').bind(id(),org,adult.id,student.id,adult.role,users[0].id,now()).run();
  }
  writeFileSync(join(root,'.local','accounts.txt'),'本地随机账号，仅用于这台电脑；不要上传或提交。\n登录名\t显示别名\t初始密码\n'+secrets.join('\n')+'\n',{flag:'wx'});
  console.log('已创建本地示例账号；密码保存在 .local/accounts.txt（已忽略），未输出到日志。');
} else console.log('保留现有账号、审核状态和学习记录；没有覆盖数据。');
db.sqlite.close();console.log('本地迁移与示例内容准备完成。运行 node scripts/dev.mjs。');
