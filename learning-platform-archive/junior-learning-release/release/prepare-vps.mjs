import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readSecrets} from './secrets.mjs';
import {openDatabase,migrate} from '../scripts/local-db.mjs';
import {seedContent} from '../src/content.mjs';
import {randomToken,id,passwordHash,now} from '../src/security.mjs';
const secrets=readSecrets();mkdirSync('.local/vps',{recursive:true});
if(!existsSync('.local/vps/runtime.json'))writeFileSync('.local/vps/runtime.json',JSON.stringify({APP_ORIGIN:secrets.origin,APP_ENV:'trial',SESSION_SECRET:secrets.sessionSecret,BRIDGE_SECRET:randomToken()}));
if(!existsSync('.local/vps/learning.sqlite')){
 const db=openDatabase('.local/vps/learning.sqlite');migrate(db);await seedContent(db);
 for(const[key,org]of Object.entries(secrets.organizations))db.sqlite.prepare('INSERT INTO organizations VALUES (?,?)').run(org,key==='trial'?'独立试用机构（空白起点）':`自动化合成数据-${key}`);
 for(const u of secrets.users)db.sqlite.prepare('INSERT INTO users (id,org_id,username,display_name,role,password_hash,created_at) VALUES (?,?,?,?,?,?,?)').run(u.id,u.orgId,u.username,`${u.username.startsWith('qa-')?'合成测试':'试用'}-${u.role}${u.username.endsWith('2')?'B':'A'}`,u.role,passwordHash(u.password),now());
 for(const prefix of ['trial','qa'])for(const role of ['teacher','parent']){const find=r=>secrets.users.find(u=>u.username===`${prefix}-${r}`);db.sqlite.prepare('INSERT INTO relationships VALUES (?,?,?,?,?,?,?)').run(id(),find(role).orgId,find(role).id,find('student').id,role,find('admin').id,now());}db.sqlite.close();
}
let version='v24.22.1';let sums=await fetch(`https://nodejs.org/dist/${version}/SHASUMS256.txt`);if(!sums.ok){version='v24.11.1';sums=await fetch(`https://nodejs.org/dist/${version}/SHASUMS256.txt`);}if(!sums.ok)throw Error('Official Node checksum unavailable');const name=`node-${version}-linux-x64.tar.xz`,hash=(await sums.text()).split('\n').find(x=>x.endsWith('  '+name))?.split(' ')[0];if(!hash)throw Error('Node checksum missing');
const cloud=JSON.parse(readFileSync('.local/tools/cloudflared-meta.json','utf8'));
const files=[{name,url:`https://nodejs.org/dist/${version}/${name}`,hash},{name:'cloudflared-linux-amd64',url:cloud.url,hash:cloud.digest.replace('sha256:','')}];
for(const file of files){const target='.local/tools/'+file.name;if(!existsSync(target)){const r=await fetch(file.url);if(!r.ok)throw Error('Runtime download failed');writeFileSync(target,Buffer.from(await r.arrayBuffer()));}if(createHash('sha256').update(readFileSync(target)).digest('hex')!==file.hash)throw Error('Runtime checksum mismatch');}
writeFileSync('.local/vps/tooling.json',JSON.stringify({nodeArchive:name,nodeVersion:version,files},null,2));console.log('Independent SQLite seed and checksum-verified official runtimes prepared; credentials not output.');
