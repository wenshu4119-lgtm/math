import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readdir,writeFile,utimes,readFile,symlink,link,unlink,rmdir}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{privateStorage,sweepPrivateImages,clearExpiredImages}from'./private-storage.mjs';
const fakeDb=rows=>({prepare(sql){assert(sql.includes('object_key=?'));return{bind(key){return{all:()=>({results:rows.get(key.replace('/','_'))||[]})}}}}});
async function sandbox(fn){const dir=await mkdtemp(join(tmpdir(),'learning-synthetic-storage-'));try{await fn(dir);}finally{for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory()&&!entry.isSymbolicLink())await rmdir(join(dir,entry.name));else await unlink(join(dir,entry.name));}await rmdir(dir);}}
test('private storage blocks traversal, overwrites and concurrent byte/file quota excess',()=>sandbox(async dir=>{
 const store=privateStorage(dir,{maxBytes:4,maxFiles:1});assert.throws(()=>store.put('../outside',Buffer.from('x')));assert.throws(()=>store.put('org/../../outside',Buffer.from('x')));
 assert.throws(()=>store.put('org_part/image',Buffer.from('x')));assert.throws(()=>store.put('org/part_image',Buffer.from('x')));
 const writes=await Promise.allSettled([store.put('org/first',Buffer.from('abc')),store.put('org/second',Buffer.from('def'))]);assert.equal(writes.filter(x=>x.status==='fulfilled').length,1);
 await assert.rejects(store.put('org/first',Buffer.from('x')));assert.equal((await store.get('org/first')).body.toString(),'abc');await store.delete('org/first');assert.equal(await store.get('org/first'),null);
}));
test('expiry and orphan cleanup retain active references, tombstones and recent uncommitted files',()=>sandbox(async dir=>{
 const store=privateStorage(dir),at=Date.now(),old=new Date(at-86400001),rows=new Map();
 for(const key of ['org/active','org/pending','org/expired','org/orphan','org/recent']){await store.put(key,Buffer.from(key));if(!key.endsWith('recent'))await utimes(join(dir,key.replace('/','_')),old,old);}
 rows.set('org_active',[{expires_at:at+10000}]);rows.set('org_pending',[{expires_at:0}]);rows.set('org_expired',[{expires_at:at-1}]);
 const r=await sweepPrivateImages(fakeDb(rows),store,{at});assert.deepEqual(r,{inspected:5,expiredDeleted:1,orphanDeleted:1,retained:3,unsafe:0,failed:0});
 assert.deepEqual((await readdir(dir)).sort(),['org_active','org_pending','org_recent']);assert.equal((await store.get('org/active')).body.toString(),'org/active');
 const expiryOnly=await clearExpiredImages(fakeDb(rows),store,at+86400002);assert.equal(expiryOnly.orphanDeleted,0);assert(await store.get('org/recent'));
}));
test('bounded scans rotate and database failures retain files and surface a count',()=>sandbox(async dir=>{
 const store=privateStorage(dir),at=Date.now(),old=new Date(at-86400001);for(const name of ['a','b','c']){await store.put('org/'+name,Buffer.from(name));await utimes(join(dir,'org_'+name),old,old);}
 const rows=new Map([['org_a',[{expires_at:at+1000}]],['org_b',[{expires_at:at+1000}]]]);
 assert.equal((await sweepPrivateImages(fakeDb(rows),store,{at,limit:1})).orphanDeleted,0);assert.equal((await sweepPrivateImages(fakeDb(rows),store,{at,limit:1})).orphanDeleted,0);assert.equal((await sweepPrivateImages(fakeDb(rows),store,{at,limit:1})).orphanDeleted,1);
 const failed=await sweepPrivateImages({prepare(){throw Error('synthetic DB unavailable');}},store,{at});assert.equal(failed.failed,1);assert.equal((await readdir(dir)).length,2);
}));
test('disk entries pointing outside storage are never read or followed by cleanup',()=>sandbox(async dir=>{
 const target=await mkdtemp(join(tmpdir(),'learning-outside-synthetic-')),outside=join(target,'proof.txt'),linked=join(dir,'org_link');
 try{await writeFile(outside,'synthetic outside content');await symlink(target,linked,process.platform==='win32'?'junction':'dir');
  const store=privateStorage(dir);await assert.rejects(store.get('org/link'));await assert.rejects(store.delete('org/link'));
  const r=await sweepPrivateImages(fakeDb(new Map()),store,{at:Date.now()+86400001});assert.equal(r.unsafe,1);assert.equal(await readFile(outside,'utf8'),'synthetic outside content');
 }finally{await unlink(linked);await unlink(outside);await rmdir(target);}
}));
test('hard-linked external bytes are not readable or deletable as a private image',()=>sandbox(async dir=>{
 const target=await mkdtemp(join(tmpdir(),'learning-outside-synthetic-')),outside=join(target,'proof.txt'),linked=join(dir,'org_link');
 try{await writeFile(outside,'synthetic outside content');await link(outside,linked);const store=privateStorage(dir);await assert.rejects(store.get('org/link'));await assert.rejects(store.delete('org/link'));const r=await sweepPrivateImages(fakeDb(new Map()),store,{at:Date.now()+86400001});assert.equal(r.unsafe,1);assert.equal(await readFile(outside,'utf8'),'synthetic outside content');}
 finally{await unlink(linked);await unlink(outside);await rmdir(target);}
}));
