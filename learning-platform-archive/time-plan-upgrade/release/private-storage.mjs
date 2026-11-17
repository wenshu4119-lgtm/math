import {mkdir,open,unlink,readdir,lstat,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';

// Private service-account storage, never a static directory. Preserve the stage
// 7 UUID filename mapping so existing stored objects remain readable. The sole
// underscore is a separator; refusing underscores in either key segment avoids
// ambiguous aliases such as a_b/c and a/b_c mapping to the same physical file.
const objectName=/^[a-zA-Z0-9-]+_[a-zA-Z0-9-]+$/;
export function privateStorage(root,{maxBytes=100*1024*1024,maxFiles=5000}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||!Number.isSafeInteger(maxFiles)||maxFiles<1)throw Error('Invalid private storage capacity');
 const absolute=resolve(root);
 const name=key=>{if(typeof key!=='string'||key.length>200||!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(key))throw Error('Invalid object key');return key.replace('/','_');};
 let mutations=Promise.resolve(),scanCursor='';
 const serialized=job=>{const result=mutations.then(job);mutations=result.catch(()=>{});return result;};
 async function directory(create=false){
  if(create)await mkdir(absolute,{recursive:true,mode:0o700});
  const entry=await lstat(absolute);if(entry.isSymbolicLink()||!entry.isDirectory())throw Error('Unsafe private storage root');return realpath(absolute);
 }
 async function safeEntry(target){const entry=await lstat(target);if(entry.isSymbolicLink()||!entry.isFile()||entry.nlink!==1)throw Error('Unsafe private storage entry');return entry;}
 return {
  put(key,bytes){const filename=name(key);return serialized(async()=>{
   const base=await directory(true),files=await readdir(base);let total=0;
   for(const file of files){const entry=await lstat(join(base,file));if(entry.isFile())total+=entry.size;}
   if(files.length>=maxFiles||total+bytes.byteLength>maxBytes)throw Error('Private storage capacity reached');
   const handle=await open(join(base,filename),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW||0),0o600);
   try{await handle.writeFile(bytes);}finally{await handle.close();}
  });},
  async get(key){const filename=name(key);let handle;
   try{const target=join(await directory(),filename);await safeEntry(target);handle=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW||0));const entry=await handle.stat();if(!entry.isFile()||entry.nlink!==1)throw Error('Unsafe private storage entry');return {body:await handle.readFile()};}
   catch(e){if(e.code==='ENOENT')return null;throw e;}finally{await handle?.close();}
  },
  delete(key){const filename=name(key);return serialized(async()=>{try{const target=join(await directory(),filename);await safeEntry(target);await unlink(target);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}});},
  // Trusted maintenance only. A rotating cursor prevents a bounded scan from
  // repeatedly visiting only its first objects. No keys or content are logged.
  scanForCleanup(inspect,{limit=200}={}){if(typeof inspect!=='function'||!Number.isInteger(limit)||limit<1||limit>5000)throw Error('Invalid private cleanup scan');return serialized(async()=>{
   const result={inspected:0,expiredDeleted:0,orphanDeleted:0,retained:0,unsafe:0,failed:0};let base;
   try{base=await directory();}catch(e){if(e.code==='ENOENT')return result;throw e;}
   const all=(await readdir(base)).sort(),ordered=[...all.filter(n=>n>scanCursor),...all.filter(n=>n<=scanCursor)].slice(0,limit);
   for(const filename of ordered){scanCursor=filename;result.inspected++;const target=join(base,filename);let entry;
    try{if(!objectName.test(filename)||filename.length>200){result.unsafe++;continue;}entry=await safeEntry(target);}catch(e){if(e.code!=='ENOENT')result.unsafe++;continue;}
    let reason;try{reason=await inspect(filename,entry.mtimeMs);}catch{result.failed++;break;}
    if(!['expired','orphan'].includes(reason)){result.retained++;continue;}
    try{const latest=await safeEntry(target);if(latest.ino!==entry.ino||latest.size!==entry.size||latest.mtimeMs!==entry.mtimeMs){result.retained++;continue;}await unlink(target);result[reason==='expired'?'expiredDeleted':'orphanDeleted']++;}catch(e){if(e.code!=='ENOENT')result.failed++;}
   }
   return result;
  });}
 };
}

export async function sweepPrivateImages(db,storage,{at=Date.now(),orphanMinAgeMs=86400000,limit=200,includeOrphans=true}={}){
 if(!Number.isFinite(at)||!Number.isFinite(orphanMinAgeMs)||orphanMinAgeMs<86400000)throw Error('Orphan cleanup requires at least a 24-hour grace period');
 if(typeof storage?.scanForCleanup!=='function')throw Error('Private disk cleanup adapter unavailable');
 return storage.scanForCleanup(async(filename,mtimeMs)=>{
  // Read current references at the deletion decision, not an earlier inventory.
  // Any reference, including a tombstone, protects against orphan deletion.
  const rows=(await db.prepare('SELECT expires_at FROM uploads WHERE object_key=?').bind(filename.replace('_','/')).all()).results;
  if(rows.length)return rows.every(r=>r.expires_at>0&&r.expires_at<=at)?'expired':'referenced';
  return includeOrphans&&mtimeMs<=at-orphanMinAgeMs?'orphan':'recent';
 },{limit});
}
export function clearExpiredImages(db,storage,at=Date.now()){
 return sweepPrivateImages(db,storage,{at,includeOrphans:false});
}
