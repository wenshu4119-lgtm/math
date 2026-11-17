import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,createPublicKey,createCipheriv,publicEncrypt,randomBytes,constants} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,mkdir,writeFile,readFile,readdir,lstat,utimes,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {encryptBackup,decryptBackup,verifyBackup,rotateBackups,validateEntryPath} from './production-backup.mjs';

const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
async function fixture(){
 const base=await mkdtemp(join(tmpdir(),'learning-production-backup-test-')),data=join(base,'data'),backups=join(base,'backups');await mkdir(join(data,'papers','中文资料'),{recursive:true});await mkdir(backups);
 const db=new DatabaseSync(join(data,'learning.sqlite'));db.exec('PRAGMA journal_mode=WAL; CREATE TABLE sample(id INTEGER PRIMARY KEY, title TEXT);');db.prepare('INSERT INTO sample(title) VALUES (?)').run('合成学生资料，不是真实个人信息');db.close();
 const png=Buffer.from('89504e470d0a1a0a00010203','hex');await writeFile(join(data,'papers','中文资料','合成图片.png'),png);await writeFile(join(data,'papers','second.jpg'),Buffer.from('synthetic jpeg payload'));
 return {base,data,backups,png,options:{dataDir:data,backupDir:backups,publicKey:keys.publicKey,releaseVersion:'production-test-1',writersStopped:true}};
}
const exists=async path=>{try{await lstat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const backupScript=fileURLToPath(new URL('./production-backup.mjs',import.meta.url));
function cliResult(script,args){
 const result=spawnSync(process.execPath,[script,...args],{encoding:'utf8',windowsHide:true,timeout:20000});
 assert.equal(result.error,undefined,result.error?.message);assert.equal(result.status,0,result.stderr);
 assert.ok(result.stdout.trim(),'CLI must emit a JSON result; exit 0 alone is insufficient');
 const lines=result.stdout.trim().split(/\r?\n/);assert.equal(lines.length,1,'CLI must emit exactly one result');return JSON.parse(lines[0]);
}

test('complete SQLite + Chinese private files survive encryption, verify and independent restore',async()=>{
 const f=await fixture(),result=await encryptBackup(f.options);assert.equal(result.files,3);assert.equal(result.rotation.removed,0);
 const encrypted=await readFile(result.file);assert(!encrypted.includes(Buffer.from('合成学生资料')));assert(!encrypted.includes(f.png));assert(!encrypted.includes(Buffer.from('中文资料')));
 const report=await verifyBackup({input:result.file,privateKey:keys.privateKey});assert.equal(report.verified,true);assert.equal(report.files,3);assert.equal(report.releaseVersion,'production-test-1');
 const restored=join(f.base,'恢复验证');await decryptBackup({input:result.file,privateKey:keys.privateKey,outputDir:restored});const db=new DatabaseSync(join(restored,'learning.sqlite'),{readOnly:true});assert.equal(db.prepare('SELECT title FROM sample').get().title,'合成学生资料，不是真实个人信息');assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();
 assert.deepEqual(await readFile(join(restored,'papers','中文资料','合成图片.png')),f.png);assert.equal(await readFile(join(restored,'papers','second.jpg'),'utf8'),'synthetic jpeg payload');
 const manifest=JSON.parse(await readFile(join(restored,'backup-manifest.json'),'utf8'));assert.equal(manifest.files.length,3);assert(manifest.files.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
 assert(!(await readdir(f.backups)).some(x=>x.startsWith('.learning-')));assert.equal(JSON.parse(await readFile(result.receipt,'utf8')).fullPayloadVerifiedAtCreation,true);
});

test('a database with committed WAL pages is backed up by SQLite, not by raw main-file copying',async()=>{
 const f=await fixture(),db=new DatabaseSync(join(f.data,'learning.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');db.prepare('INSERT INTO sample(title) VALUES (?)').run('已提交WAL合成记录');
 try{const result=await encryptBackup(f.options),output=join(f.base,'wal-restored');await decryptBackup({input:result.file,outputDir:output,privateKey:keys.privateKey});const restored=new DatabaseSync(join(output,'learning.sqlite'),{readOnly:true});assert.equal(restored.prepare('SELECT count(*) n FROM sample').get().n,2);restored.close();}finally{db.close();}
});

test('tampering and truncation reject the backup and remove only the new partial restore directory',async()=>{
 const f=await fixture(),result=await encryptBackup(f.options),original=await readFile(result.file);
 for(const [name,bytes]of [['tampered',Buffer.from(original)],['truncated',original.subarray(0,original.length-7)]]){
  if(name==='tampered')bytes[Math.floor(bytes.length/2)]^=1;
  const input=join(f.base,name+'.lpbak'),target=join(f.base,name+'-restore');await writeFile(input,bytes);await assert.rejects(decryptBackup({input,outputDir:target,privateKey:keys.privateKey}));assert.equal(await exists(target),false);
 }
 const preserved=join(f.base,'preserved');await mkdir(preserved);await writeFile(join(preserved,'keep.txt'),'untouched');await assert.rejects(decryptBackup({input:result.file,outputDir:preserved,privateKey:keys.privateKey}),/EEXIST/);assert.equal(await readFile(join(preserved,'keep.txt'),'utf8'),'untouched');
});

test('wrong recovery key cannot decrypt and does not create a restore directory',async()=>{
 const f=await fixture(),result=await encryptBackup(f.options),wrong=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}),output=join(f.base,'wrong-key');
 await assert.rejects(decryptBackup({input:result.file,outputDir:output,privateKey:wrong.privateKey}),/different recovery key/);assert.equal(await exists(output),false);
});

test('quiescence, overlapping live directories, traversal and portable-name restrictions are enforced',async()=>{
 const f=await fixture();await assert.rejects(encryptBackup({...f.options,writersStopped:false}),/Stop all/);await assert.rejects(encryptBackup({...f.options,backupDir:join(f.data,'backups')}),/must not overlap/);
 for(const value of ['../private','/absolute','papers/../escape','papers\\escape','papers/name:stream','papers/CON.txt','papers/trailing.','papers//file','unknown/file'])assert.throws(()=>validateEntryPath(value));
 assert.equal(validateEntryPath('papers/中文/合成.png'),'papers/中文/合成.png');
});

test('symbolic links are rejected without reading or deleting the external target',async t=>{
 const f=await fixture(),outside=join(f.base,'outside');await mkdir(outside);await writeFile(join(outside,'private.txt'),'outside-preserved');
 try{await symlink(outside,join(f.data,'papers','linked'),'junction');}catch(e){if(e.code==='EPERM'){t.skip('Host does not permit creating a synthetic symlink');return;}throw e;}
 await assert.rejects(encryptBackup(f.options),/symbolic link/i);assert.equal(await readFile(join(outside,'private.txt'),'utf8'),'outside-preserved');assert(!(await readdir(f.backups)).some(x=>x.endsWith('.lpbak')));
});

test('an authenticated malicious archive cannot write a parent path',async()=>{
 const f=await fixture(),db=await readFile(join(f.data,'learning.sqlite')),secret=Buffer.from('must-not-escape'),createdAt=new Date().toISOString(),key=randomBytes(32),iv=randomBytes(12),u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;},digest=b=>createHash('sha256').update(b).digest('hex');
 const manifest={format:'learning-platform-backup',version:1,createdAt,releaseVersion:'malicious-transport-test',totalBytes:db.length+secret.length,files:[{path:'learning.sqlite',size:db.length,sha256:digest(db)},{path:'papers/../../escape.txt',size:secret.length,sha256:digest(secret)}]},manifestBytes=Buffer.from(JSON.stringify(manifest));
 const header={format:'learning-platform-backup',version:1,encryption:'AES-256-GCM',wrapping:'RSA-OAEP-SHA256',createdAt,keyFingerprint:digest(createPublicKey(keys.publicKey).export({type:'spki',format:'der'})),iv:iv.toString('base64'),wrappedKey:publicEncrypt({key:keys.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64')},json=Buffer.from(JSON.stringify(header)),aad=Buffer.concat([Buffer.from('LPBACKUP-ENC-1\n'),u32(json.length),json]),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad);
 const payload=Buffer.concat([Buffer.from('LPBACKUP-DATA-1\n'),u32(manifestBytes.length),manifestBytes,db,secret]),input=join(f.base,'malicious.lpbak'),output=join(f.base,'malicious-restore');await writeFile(input,Buffer.concat([aad,cipher.update(payload),cipher.final(),cipher.getAuthTag()]));
 await assert.rejects(decryptBackup({input,outputDir:output,privateKey:keys.privateKey}),/Unsafe backup entry path/);assert.equal(await exists(join(f.base,'escape.txt')),false);assert.equal(await exists(output),false);
});

test('rotation removes only old verified matching-key archives and preserves modified, unknown and unreceipted files',async()=>{
 const f=await fixture(),old=new Date(Date.now()-40*86400000).toISOString();const original=await encryptBackup({...f.options,createdAt:old,retainDays:365}),modified=await encryptBackup({...f.options,createdAt:old,retainDays:365}),unreceipted=await encryptBackup({...f.options,createdAt:old,retainDays:365});
 const {unlink}=await import('node:fs/promises');await unlink(unreceipted.receipt);const bytes=await readFile(modified.file);bytes[bytes.length-20]^=1;await writeFile(modified.file,bytes);
 const unknown=join(f.backups,'unrelated-old-file.txt');await writeFile(unknown,'preserve');for(const path of[original.file,modified.file,unreceipted.file,unknown])await utimes(path,new Date(old),new Date(old));
 const receipt=JSON.parse(await readFile(original.receipt,'utf8')),result=await rotateBackups({backupDir:f.backups,keyFingerprint:receipt.keyFingerprint,retainDays:30});assert.equal(result.removed,1);assert.equal(result.skipped,2);assert.equal(await exists(original.file),false);assert.equal(await exists(original.receipt),false);assert.equal(await exists(modified.file),true);assert.equal(await exists(unreceipted.file),true);assert.equal(await readFile(unknown,'utf8'),'preserve');
});

test('CLI runs through a deployment directory symlink and emits a verified result',async t=>{
 const f=await fixture(),link=join(f.base,'current'),keyPath=join(f.base,'synthetic-private.pem');await writeFile(keyPath,keys.privateKey,{mode:0o600});
 try{await symlink(dirname(backupScript),link,process.platform==='win32'?'junction':'dir');}catch(e){if(e.code==='EPERM'){t.skip('Host cannot create a directory symlink');return;}throw e;}
 const script=join(link,'production-backup.mjs'),made=await encryptBackup(f.options),verified=cliResult(script,['verify','--input',made.file,'--private-key',keyPath]);
 assert.equal(verified.verified,true);assert.equal(verified.files,3);assert.equal(verified.releaseVersion,'production-test-1');
 // Windows has no systemd check. On Linux the production encrypt command must
 // retain its real service-state gate; verify/decrypt exercise the same CLI entry.
 if(process.platform!=='linux'){
  const publicPath=join(f.base,'synthetic-public.pem');await writeFile(publicPath,keys.publicKey,{mode:0o600});
  const created=cliResult(script,['encrypt','--data-dir',f.data,'--backup-dir',f.backups,'--public-key',publicPath,'--version','symlink-cli-production-test','--writers-stopped']);
  assert.equal(created.files,3);assert.equal(created.releaseVersion,'symlink-cli-production-test');assert(await exists(created.file));assert(await exists(created.receipt));
  const actual=createHash('sha256').update(await readFile(created.file)).digest('hex'),receipt=JSON.parse(await readFile(created.receipt,'utf8'));assert.equal(actual,created.sha256);assert.equal(receipt.sha256,actual);assert.equal(receipt.file,basename(created.file));assert.equal(receipt.fullPayloadVerifiedAtCreation,true);
 }
 const invalid=spawnSync(process.execPath,[script,'not-a-command'],{encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(invalid.status,1);assert.equal(JSON.parse(invalid.stderr.trim()).ok,false);
});

test('CLI runs through a file symlink and creates the verified restore output',async t=>{
 const f=await fixture(),script=join(f.base,'backup-link.mjs'),keyPath=join(f.base,'synthetic-private.pem');await writeFile(keyPath,keys.privateKey,{mode:0o600});
 try{await symlink(backupScript,script,'file');}catch(e){if(e.code==='EPERM'){t.skip('Host cannot create a file symlink');return;}throw e;}
 const made=await encryptBackup(f.options),output=join(f.base,'cli-restored'),restored=cliResult(script,['decrypt','--input',made.file,'--private-key',keyPath,'--output-dir',output]);
 assert.equal(restored.verified,true);assert.equal(restored.outputDir,resolve(output));assert.equal(restored.files,3);assert(await exists(join(output,'learning.sqlite')));assert.deepEqual(await readFile(join(output,'papers','中文资料','合成图片.png')),f.png);
 const invalid=spawnSync(process.execPath,[script,'not-a-command'],{encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(invalid.status,1);assert.equal(JSON.parse(invalid.stderr.trim()).ok,false);
});

test('importing the module through a symlink does not execute its CLI',async t=>{
 const f=await fixture(),link=join(f.base,'import-current');
 try{await symlink(dirname(backupScript),link,process.platform==='win32'?'junction':'dir');}catch(e){if(e.code==='EPERM'){t.skip('Host cannot create a directory symlink');return;}throw e;}
 const imported=pathToFileURL(join(link,'production-backup.mjs')).href;
 const result=spawnSync(process.execPath,['--input-type=module','-e',`const module=await import(${JSON.stringify(imported)});if(typeof module.encryptBackup!=='function')throw Error('Missing API');console.log('IMPORT_ONLY');`],{encoding:'utf8',windowsHide:true,timeout:20000});
 assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'IMPORT_ONLY');assert.equal(result.stderr.trim(),'');
});
