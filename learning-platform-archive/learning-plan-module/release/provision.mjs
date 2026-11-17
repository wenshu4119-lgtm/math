import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {cf,origin,worker} from './cf-client.mjs';
import {saveSecrets,readSecrets} from './secrets.mjs';
import {randomToken,id,passwordHash,now} from '../src/security.mjs';
import {seedContent} from '../src/content.mjs';

if(process.argv[2]!=='--create-isolated-trial')throw new Error('Explicit isolated trial action required');
const configPath=new URL('../wrangler.jsonc',import.meta.url),config=JSON.parse(readFileSync(configPath,'utf8'));
if(config.name!==worker||config.routes||config.r2_buckets)throw new Error('Isolation guard failed');
let state=existsSync(new URL('deployment.json',import.meta.url))?JSON.parse(readFileSync(new URL('deployment.json',import.meta.url),'utf8')):null;
if(!state){
 const list=await cf('/d1/database');if(list.some(x=>x.name===worker))throw new Error('Resource already exists; inspect before reuse');
 const db=await cf('/d1/database',{method:'POST',body:{name:worker}});
 state={worker,origin,databaseId:db.uuid,databaseName:db.name,createdAt:now(),migrations:[],seeded:false};
 writeFileSync(new URL('deployment.json',import.meta.url),JSON.stringify(state,null,2));
}
const persist=()=>writeFileSync(new URL('deployment.json',import.meta.url),JSON.stringify(state,null,2));
config.d1_databases=[{binding:'DB',database_name:worker,database_id:state.databaseId,migrations_dir:'migrations'}];writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
const query=async(sql,params=[])=>{const r=await cf(`/d1/database/${state.databaseId}/query`,{method:'POST',body:{sql,params}});if(r.some(x=>x.success===false))throw new Error('D1 query failed');return r;};
for(const name of ['0001_initial.sql','0002_manual_papers.sql','0003_ocr_runs.sql','0004_homeworks.sql'])if(!state.migrations.includes(name)){await query(readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8'));state.migrations.push(name);persist();}
const DB={prepare(sql){return {bind(...params){return {async run(){return query(sql,params);}}},async run(){return query(sql);}}},async batch(statements){const result=[];for(const statement of statements)result.push(await statement.run());return result;}};
if(!state.seeded){
 const count=await query('SELECT COUNT(*) AS n FROM organizations');if(count[0].results[0].n!==0)throw new Error('Database is not empty; no automatic reseeding');
 await seedContent(DB);
 let secrets;
 if(existsSync(new URL('../.local/trial-credentials.dpapi',import.meta.url)))secrets=readSecrets();
 else {secrets={origin,sessionSecret:randomToken(),organizations:{trial:id(),qa:id(),foreign:id()},users:[]};for(const prefix of ['trial','qa'])for(const role of ['admin','teacher','student','parent','student2','teacher2'])secrets.users.push({id:id(),username:`${prefix}-${role}`,role:role.replace('2',''),password:randomToken(),orgId:secrets.organizations[prefix]});secrets.users.push({id:id(),username:'qa-foreign',role:'student',password:randomToken(),orgId:secrets.organizations.foreign});saveSecrets(secrets);}
 for(const [key,org] of Object.entries(secrets.organizations))await query('INSERT INTO organizations VALUES (?,?)',[org,key==='trial'?'独立试用机构（空白起点）':`自动化合成数据-${key}`]);
 for(const u of secrets.users)await query('INSERT INTO users (id,org_id,username,display_name,role,password_hash,created_at) VALUES (?,?,?,?,?,?,?)',[u.id,u.orgId,u.username,`${u.username.startsWith('qa-')?'合成测试':'试用'}-${u.role}${u.username.endsWith('2')?'B':'A'}`,u.role,passwordHash(u.password),now()]);
 for(const prefix of ['trial','qa'])for(const role of ['teacher','parent']){const find=r=>secrets.users.find(u=>u.username===`${prefix}-${r}`);await query('INSERT INTO relationships VALUES (?,?,?,?,?,?,?)',[id(),find(role).orgId,find(role).id,find('student').id,role,find('admin').id,now()]);}
 state.seeded=true;persist();
}
console.log(JSON.stringify({worker,origin,databaseId:state.databaseId,migrations:state.migrations,seeded:state.seeded,credentials:'Windows DPAPI protected; no password output'}));
