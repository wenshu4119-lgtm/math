/** Standalone encrypted SQLite + private-file backups. No network or service control. */
import {createHash,createCipheriv,createDecipheriv,createPublicKey,createPrivateKey,publicEncrypt,privateDecrypt,randomBytes,randomUUID,constants} from 'node:crypto';
import {DatabaseSync,backup as sqliteBackup} from 'node:sqlite';
import {createReadStream} from 'node:fs';
import {open,mkdir,mkdtemp,readFile,writeFile,readdir,lstat,stat,realpath,rename,rm,unlink} from 'node:fs/promises';
import {resolve,dirname,join,relative,parse,sep,isAbsolute,posix,basename} from 'node:path';
import {Readable,Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const ENC=Buffer.from('LPBACKUP-ENC-1\n'),DATA=Buffer.from('LPBACKUP-DATA-1\n');
const FORMAT='learning-platform-backup',MAX_HEADER=16384,MAX_MANIFEST=8*1024*1024,MAX_TOTAL=8*1024**3,MAX_FILES=25000;
const ARCHIVE=/^learning-platform-(\d{8}T\d{9}Z)-[a-f0-9-]{36}\.lpbak$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const uint=value=>{const b=Buffer.alloc(4);b.writeUInt32BE(value);return b;};
const fail=message=>{throw new Error(message);};
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const inside=(child,parent)=>{const r=relative(parent,child);return r!==''&&!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r);};

export function validateEntryPath(name){
 if(typeof name!=='string'||!name||name.length>1000||name!==posix.normalize(name)||name.startsWith('/')||/[\\:\x00-\x1f<>|?*]/u.test(name))fail('Unsafe backup entry path');
 const parts=name.split('/');
 if(parts.some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))fail('Unsafe backup entry path');
 if(name!=='learning.sqlite'&&!name.startsWith('papers/'))fail('Backup entry is outside the supported data layout');
 return name;
}

async function safeExistingPath(value,{directory=false,file=false}={}){
 const full=resolve(value),root=parse(full).root,parts=full.slice(root.length).split(sep).filter(Boolean);let at=root;
 for(const part of parts){at=join(at,part);const s=await lstat(at);if(s.isSymbolicLink())fail('Symbolic links are not allowed in backup paths');}
 const s=await lstat(full);if(directory&&!s.isDirectory()||file&&!s.isFile())fail('Unexpected backup path type');
 if(file&&s.nlink!==1)fail('Hard-linked files are not allowed');
 return full;
}

async function safeDirectory(value){
 const target=resolve(value);
 try{return await safeExistingPath(target,{directory:true});}catch(e){if(e.code!=='ENOENT')throw e;}
 await safeDirectory(dirname(target));await mkdir(target,{mode:0o700});return safeExistingPath(target,{directory:true});
}

async function removeOwnedDirectory(target,parent){
 const full=resolve(target),base=await realpath(parent);
 if(!inside(full,base))fail('Refusing cleanup outside owned parent');
 let s;try{s=await lstat(full);}catch(e){if(e.code==='ENOENT')return;throw e;}
 if(!s.isDirectory()||s.isSymbolicLink())fail('Refusing cleanup of non-owned directory');
 if(!inside(await realpath(full),base))fail('Cleanup target escaped parent');
 await rm(full,{recursive:true,force:false});
}

async function hashFile(file){const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');}
async function writeAt(handle,bytes,position){let written=0;while(written<bytes.length){const r=await handle.write(bytes,written,bytes.length-written,position+written);if(!r.bytesWritten)fail('Backup write made no progress');written+=r.bytesWritten;}}
async function fileInfo(file,path){await safeExistingPath(file,{file:true});const s=await stat(file);return {path:validateEntryPath(path),size:s.size,sha256:await hashFile(file)};}

async function collectPapers(root){
 const files=[];
 async function walk(dir,prefix){
  for(const name of (await readdir(dir)).sort()){
   const path=prefix+'/'+name,file=join(dir,name),s=await lstat(file);validateEntryPath(path);
   if(s.isSymbolicLink())fail('Private image tree contains a symbolic link');
   if(s.isDirectory())await walk(file,path);else if(s.isFile())files.push({...await fileInfo(file,path),file});else fail('Unsupported private image file type');
   if(files.length>MAX_FILES)fail('Too many private files');
  }
 }
 try{await safeExistingPath(root,{directory:true});}catch(e){if(e.code==='ENOENT')return files;throw e;}
 await walk(root,'papers');return files;
}

function keyInfo(key){const publicKey=createPublicKey(key);if(publicKey.asymmetricKeyType!=='rsa'||publicKey.asymmetricKeyDetails.modulusLength<2048)fail('RSA public key of at least 2048 bits required');return {publicKey,fingerprint:sha(publicKey.export({format:'der',type:'spki'}))};}
function checkManifest(m){
 if(m?.format!==FORMAT||m.version!==1||!validDate(m.createdAt)||typeof m.releaseVersion!=='string'||!m.releaseVersion||m.releaseVersion.length>200||!Array.isArray(m.files)||!m.files.length||m.files.length>MAX_FILES)fail('Invalid backup manifest');
 const seen=new Set();let total=0;
 for(const f of m.files){validateEntryPath(f.path);const normalized=f.path.toLowerCase();if(seen.has(normalized))fail('Duplicate or case-colliding backup path');seen.add(normalized);if(!Number.isSafeInteger(f.size)||f.size<0||f.size>MAX_TOTAL||!/^[a-f0-9]{64}$/.test(f.sha256))fail('Invalid backup entry');total+=f.size;}
 if(m.files[0].path!=='learning.sqlite'||total!==m.totalBytes||total>MAX_TOTAL)fail('Invalid backup sizes or database entry');return m;
}
function checkHeader(h){
 if(h?.format!==FORMAT||h.version!==1||h.encryption!=='AES-256-GCM'||h.wrapping!=='RSA-OAEP-SHA256'||!validDate(h.createdAt)||!/^[a-f0-9]{64}$/.test(h.keyFingerprint)||typeof h.iv!=='string'||typeof h.wrappedKey!=='string')fail('Invalid encrypted backup header');
 const iv=Buffer.from(h.iv,'base64'),wrapped=Buffer.from(h.wrappedKey,'base64');if(iv.length!==12||wrapped.length<256||wrapped.length>1024||iv.toString('base64')!==h.iv||wrapped.toString('base64')!==h.wrappedKey)fail('Invalid backup key encoding');return h;
}

async function exactRead(handle,length,position){const out=Buffer.alloc(length);let read=0;while(read<length){const r=await handle.read(out,read,length-read,position+read);if(!r.bytesRead)fail('Truncated encrypted backup');read+=r.bytesRead;}return out;}
async function readHeader(input){
 const path=await safeExistingPath(input,{file:true}),handle=await open(path,'r');
 try{
  const first=await exactRead(handle,ENC.length+4,0);if(!first.subarray(0,ENC.length).equals(ENC))fail('Not a learning platform encrypted backup');const length=first.readUInt32BE(ENC.length);if(length<10||length>MAX_HEADER)fail('Invalid encrypted header size');
  const json=await exactRead(handle,length,first.length),header=checkHeader(JSON.parse(json.toString('utf8'))),aad=Buffer.concat([first,json]),size=(await handle.stat()).size;
  if(size<aad.length+16+DATA.length+4||size>MAX_TOTAL+MAX_MANIFEST+MAX_HEADER+1024)fail('Invalid encrypted archive size');
  return {path,header,aad,size,tag:await exactRead(handle,16,size-16)};
 }finally{await handle.close();}
}

class ByteReader{
 constructor(stream){this.iterator=stream[Symbol.asyncIterator]();this.buffer=Buffer.alloc(0);this.done=false;}
 async next(){const n=await this.iterator.next();this.done=n.done;if(!n.done)this.buffer=Buffer.from(n.value);}
 async read(length){const parts=[];let remain=length;while(remain){if(!this.buffer.length){if(this.done)fail('Truncated backup payload');await this.next();if(this.done)fail('Truncated backup payload');}const n=Math.min(remain,this.buffer.length);parts.push(this.buffer.subarray(0,n));this.buffer=this.buffer.subarray(n);remain-=n;}return Buffer.concat(parts,length);}
 async file(length,handle){const h=createHash('sha256');let remain=length;while(remain){if(!this.buffer.length){if(this.done)fail('Truncated backup file');await this.next();if(this.done)fail('Truncated backup file');}const n=Math.min(remain,this.buffer.length),b=this.buffer.subarray(0,n);h.update(b);let written=0;while(written<b.length){const r=await handle.write(b,written,b.length-written);written+=r.bytesWritten;}this.buffer=this.buffer.subarray(n);remain-=n;}return h.digest('hex');}
 async finish(){if(this.buffer.length)fail('Trailing backup payload');if(!this.done)await this.next();if(!this.done||this.buffer.length)fail('Trailing backup payload');}
}

async function unpackWithKey(input,outputDir,key){
 const archive=await readHeader(input),target=resolve(outputDir),parent=await safeExistingPath(dirname(target),{directory:true});if(!inside(target,parent))fail('Invalid restore directory');
 await mkdir(target,{mode:0o700}); // Exclusive: never restore over a directory that already exists.
 const source=createReadStream(archive.path,{start:archive.aad.length,end:archive.size-17}),decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(archive.header.iv,'base64'));
 decipher.setAAD(archive.aad);decipher.setAuthTag(archive.tag);
 const stream=source.pipe(decipher),reader=new ByteReader(stream);source.on('error',e=>decipher.destroy(e));
 try{
  if(!(await reader.read(DATA.length)).equals(DATA))fail('Invalid decrypted data format');const len=(await reader.read(4)).readUInt32BE();if(len<10||len>MAX_MANIFEST)fail('Invalid manifest length');
  const manifest=checkManifest(JSON.parse((await reader.read(len)).toString('utf8')));if(manifest.createdAt!==archive.header.createdAt)fail('Manifest and encrypted header differ');
  for(const item of manifest.files){const destination=resolve(target,...item.path.split('/'));if(!inside(destination,target))fail('Restore path escape');await safeDirectory(dirname(destination));const handle=await open(destination,'wx',0o600);let actual;try{actual=await reader.file(item.size,handle);await handle.sync();}finally{await handle.close();}if(actual!==item.sha256)fail('Backup file digest mismatch');}
  await reader.finish(); // Consumes AES-GCM final authentication before success.
  const db=new DatabaseSync(join(target,'learning.sqlite'),{readOnly:true});try{const result=db.prepare('PRAGMA integrity_check').all();if(result.length!==1||result[0].integrity_check!=='ok')fail('Restored SQLite integrity check failed');}finally{db.close();}
  await writeFile(join(target,'backup-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
  return {manifest,outputDir:target,keyFingerprint:archive.header.keyFingerprint};
 }catch(e){source.destroy();decipher.destroy();await removeOwnedDirectory(target,parent);throw e;}finally{source.destroy();decipher.destroy();}
}

export async function decryptBackup({input,outputDir,privateKey}){
 const archive=await readHeader(input),keyObject=createPrivateKey(privateKey),publicInfo=keyInfo(keyObject);if(publicInfo.fingerprint!==archive.header.keyFingerprint)fail('Backup belongs to a different recovery key');
 const key=privateDecrypt({key:keyObject,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(archive.header.wrappedKey,'base64'));if(key.length!==32)fail('Invalid backup data key');
 try{return await unpackWithKey(archive.path,outputDir,key);}finally{key.fill(0);}
}

export async function verifyBackup({input,privateKey,scratchDir=dirname(resolve(input))}){
 const base=await safeExistingPath(scratchDir,{directory:true}),target=join(base,'.learning-verify-'+randomUUID());
 try{const result=await decryptBackup({input,privateKey,outputDir:target});return {verified:true,files:result.manifest.files.length,totalBytes:result.manifest.totalBytes,releaseVersion:result.manifest.releaseVersion,createdAt:result.manifest.createdAt};}
 finally{await removeOwnedDirectory(target,base);}
}

export async function encryptBackup({dataDir,backupDir,publicKey,releaseVersion,writersStopped=false,createdAt=new Date().toISOString(),retainDays=30}){
 if(writersStopped!==true)fail('Stop all application and maintenance writers before creating a consistent backup');
 if(!validDate(createdAt)||typeof releaseVersion!=='string'||!releaseVersion||releaseVersion.length>200)fail('A valid timestamp and release version are required');
 const data=await safeExistingPath(dataDir,{directory:true}),destination=await safeDirectory(backupDir);if(data===destination||inside(destination,data)||inside(data,destination))fail('Backup and live data directories must not overlap');
 const sourceDb=await safeExistingPath(join(data,'learning.sqlite'),{file:true}),{publicKey:key,fingerprint}=keyInfo(publicKey);
 const work=await mkdtemp(join(destination,'.learning-backup-work-')),snapshot=join(work,'learning.sqlite');
 const stamp=createdAt.replace(/[-:.]/g,''),name=`learning-platform-${stamp}-${randomUUID()}.lpbak`,final=join(destination,name),partial=join(work,'archive.partial');
 const symmetric=randomBytes(32);let finalized=false;
 try{
  const db=new DatabaseSync(sourceDb,{readOnly:true});try{await sqliteBackup(db,snapshot);}finally{db.close();}
  const files=[{...await fileInfo(snapshot,'learning.sqlite'),file:snapshot},...await collectPapers(join(data,'papers'))];
  const manifest=checkManifest({format:FORMAT,version:1,createdAt,releaseVersion,sourceKind:'sqlite-backup-and-private-files',totalBytes:files.reduce((n,f)=>n+f.size,0),files:files.map(({file,...metadata})=>metadata)}),manifestBytes=Buffer.from(JSON.stringify(manifest));if(manifestBytes.length>MAX_MANIFEST)fail('Manifest is too large');
  const iv=randomBytes(12),wrappedKey=publicEncrypt({key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},symmetric),header={format:FORMAT,version:1,encryption:'AES-256-GCM',wrapping:'RSA-OAEP-SHA256',createdAt,keyFingerprint:fingerprint,iv:iv.toString('base64'),wrappedKey:wrappedKey.toString('base64')};
  const headerBytes=Buffer.from(JSON.stringify(header)),aad=Buffer.concat([ENC,uint(headerBytes.length),headerBytes]),cipher=createCipheriv('aes-256-gcm',symmetric,iv);cipher.setAAD(aad);
  async function* payload(){yield DATA;yield uint(manifestBytes.length);yield manifestBytes;for(const item of files){await safeExistingPath(item.file,{file:true});const h=createHash('sha256');let size=0;for await(const chunk of createReadStream(item.file)){size+=chunk.length;h.update(chunk);yield chunk;}if(size!==item.size||h.digest('hex')!==item.sha256)fail('Source changed while backing up; writers may not have stopped');}}
  const handle=await open(partial,'wx',0o600);try{await writeAt(handle,aad,0);let offset=aad.length;const output=new Writable({write(chunk,encoding,callback){writeAt(handle,chunk,offset).then(()=>{offset+=chunk.length;callback();},callback);}});await pipeline(Readable.from(payload()),cipher,output);await writeAt(handle,cipher.getAuthTag(),offset);await handle.sync();}finally{await handle.close();}
  const verifyDir=join(work,'verification');await unpackWithKey(partial,verifyDir,symmetric);await removeOwnedDirectory(verifyDir,work);
  const digest=await hashFile(partial),bytes=(await stat(partial)).size;await rename(partial,final);finalized=true;
  const receipt={format:FORMAT+'-receipt',version:1,file:name,createdAt,verifiedAt:new Date().toISOString(),fullPayloadVerifiedAtCreation:true,sha256:digest,archiveBytes:bytes,keyFingerprint:fingerprint,manifestSha256:sha(manifestBytes),files:files.length,totalBytes:manifest.totalBytes,releaseVersion};
  await writeFile(final+'.receipt.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  const rotation=await rotateBackups({backupDir:destination,keyFingerprint:fingerprint,retainDays});
  return {file:final,receipt:final+'.receipt.json',sha256:digest,files:files.length,totalBytes:manifest.totalBytes,createdAt,releaseVersion,rotation};
 }catch(e){if(finalized){/* Keep an unreceipted encrypted archive; rotation will never delete it. */}throw e;}
 finally{symmetric.fill(0);await removeOwnedDirectory(work,destination);}
}

export async function rotateBackups({backupDir,keyFingerprint,retainDays=30,now=Date.now()}){
 if(!Number.isInteger(retainDays)||retainDays<1||retainDays>3650||!Number.isFinite(now)||!/^[a-f0-9]{64}$/.test(keyFingerprint))fail('Invalid backup retention configuration');
 const dir=await safeExistingPath(backupDir,{directory:true}),cutoff=now-retainDays*86400000,result={removed:0,skipped:0};
 for(const name of await readdir(dir)){
  if(!ARCHIVE.test(name))continue;
  const file=join(dir,name),receiptPath=file+'.receipt.json';
  try{
   await safeExistingPath(file,{file:true});await safeExistingPath(receiptPath,{file:true});const r=JSON.parse(await readFile(receiptPath,'utf8')),s=await stat(file);
   if(r.format!==FORMAT+'-receipt'||r.version!==1||r.file!==name||r.fullPayloadVerifiedAtCreation!==true||!validDate(r.createdAt)||!validDate(r.verifiedAt)||r.keyFingerprint!==keyFingerprint||r.archiveBytes!==s.size||!/^[a-f0-9]{64}$/.test(r.sha256)||Date.parse(r.createdAt)>cutoff||s.mtimeMs>cutoff){result.skipped++;continue;}
   const header=await readHeader(file);if(header.header.createdAt!==r.createdAt||header.header.keyFingerprint!==keyFingerprint||await hashFile(file)!==r.sha256){result.skipped++;continue;}
   // Both paths were checked to be regular single-link files within this exact directory.
   await unlink(file);await unlink(receiptPath);result.removed++;
  }catch(e){if(e.code==='EACCES'||e.code==='EPERM')throw e;result.skipped++;}
 }
 return result;
}

async function main(){
 const [command,...args]=process.argv.slice(2),options={};for(let i=0;i<args.length;i++){const key=args[i];if(key==='--writers-stopped'){options[key]=true;continue;}if(!key.startsWith('--')||!args[i+1]||args[i+1].startsWith('--')||options[key]!==undefined)fail('Invalid command arguments');options[key]=args[++i];}
 const allowed={encrypt:['--data-dir','--backup-dir','--public-key','--version','--writers-stopped','--retain-days'],decrypt:['--input','--output-dir','--private-key'],verify:['--input','--private-key','--scratch-dir'],rotate:['--backup-dir','--public-key','--retain-days']}[command];
 if(!allowed||Object.keys(options).some(k=>!allowed.includes(k)))fail('Use encrypt, decrypt, verify, or rotate with the documented arguments');
 async function keyFile(name){if(!options[name])fail('Recovery key path is required');return readFile(await safeExistingPath(options[name],{file:true}),'utf8');}
 let result;
 if(command==='encrypt'){if(!options['--data-dir']||!options['--backup-dir'])fail('Data and backup directories required');if(process.platform==='linux'){let serviceState='';try{serviceState=execFileSync('systemctl',['is-active','learning-platform.service'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch(e){serviceState=String(e.stdout||'').trim();}if(!['inactive','failed'].includes(serviceState))fail('learning-platform.service must be stopped by the backup coordinator; unknown service state is not accepted');}result=await encryptBackup({dataDir:options['--data-dir'],backupDir:options['--backup-dir'],publicKey:await keyFile('--public-key'),releaseVersion:options['--version'],writersStopped:options['--writers-stopped']===true,retainDays:Number(options['--retain-days']||30)});}
 else if(command==='decrypt'){if(!options['--input']||!options['--output-dir'])fail('Input and a new output directory required');const r=await decryptBackup({input:options['--input'],outputDir:options['--output-dir'],privateKey:await keyFile('--private-key')});result={verified:true,outputDir:r.outputDir,files:r.manifest.files.length,releaseVersion:r.manifest.releaseVersion};}
 else if(command==='verify'){if(!options['--input'])fail('Input required');result=await verifyBackup({input:options['--input'],privateKey:await keyFile('--private-key'),scratchDir:options['--scratch-dir']});}
 else result=await rotateBackups({backupDir:options['--backup-dir'],keyFingerprint:keyInfo(await keyFile('--public-key')).fingerprint,retainDays:Number(options['--retain-days']||30)});
 console.log(JSON.stringify(result));
}
// Node resolves an ESM entry's import.meta.url through symlinks by default, while
// argv[1] may still name the deployment's "current" symlink. Compare both real
// paths so a CLI invocation cannot silently become a no-op. Imports remain inert.
async function invokedAsCli(){
 if(!process.argv[1])return false;
 try{return await realpath(resolve(process.argv[1]))===await realpath(fileURLToPath(import.meta.url));}
 catch{return false;}
}
if(await invokedAsCli())main().catch(error=>{console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;});
