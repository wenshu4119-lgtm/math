import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,unlink,rmdir,utimes} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {fixture,PNG} from '../tests/helpers.mjs';
import {cleanupPendingUploads} from '../src/uploads.mjs';
import {privateStorage,sweepPrivateImages} from './private-storage.mjs';

async function scenario(fn){
 const f=await fixture(),dir=await mkdtemp(join(tmpdir(),'learning-disk-api-')),disk=privateStorage(dir);f.env.PAPERS=disk;
 const t=await f.login('teacher'),s=await f.login('student'),a=await f.login('admin'),link=(await f.request('/admin/relationships',{client:a})).data.find(r=>r.adultId===t.id);
 const revoke=async()=>assert.equal((await f.request(`/admin/relationships/${link.id}`,{client:a,method:'DELETE'})).status,200);
 const upload=()=>f.request(`/uploads?studentId=${s.id}`,{client:t,method:'POST',raw:true,body:PNG,headers:{'Content-Type':'image/png'}});
 const audit=action=>f.DB.sqlite.prepare('SELECT COUNT(*) n FROM audit_events WHERE action=?').get(action).n;
 try{await fn({...f,dir,disk,t,s,a,upload,revoke,audit});}finally{f.close();for(const name of await readdir(dir))await unlink(join(dir,name));await rmdir(dir);}
}
test('real disk POST revoked during write compensates bytes and publishes no record/audit',()=>scenario(async f=>{
 f.env.PAPERS={...f.disk,put:async(...args)=>{await f.disk.put(...args);assert.equal((await readdir(f.dir)).length,1);await f.revoke();}};
 const r=await f.upload();assert.equal(r.status,404);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM uploads').get().n,0);assert.deepEqual(await readdir(f.dir),[]);assert.equal(f.audit('image_uploaded'),0);
}));
test('real disk GET withholds already-read bytes after permission changes',()=>scenario(async f=>{
 const u=(await f.upload()).data;let once=true;f.env.PAPERS={...f.disk,get:async key=>{const data=await f.disk.get(key);assert.deepEqual(data.body,PNG);if(once){once=false;await f.revoke();}return data;}};
 const r=await f.request(`/uploads/${u.id}/image`,{client:f.t});assert.equal(r.status,404);assert.equal(r.res.headers.get('Content-Type'),'application/json');assert.equal((await readdir(f.dir)).length,1);
 assert.equal((await f.request(`/uploads/${u.id}/image`,{client:f.s})).status,200);
}));
test('real disk DELETE before authorization commit is refused without storage mutation',()=>scenario(async f=>{
 const u=(await f.upload()).data,batch=f.DB.batch.bind(f.DB);let once=true,calls=0;f.env.PAPERS={...f.disk,delete:async key=>{calls++;return f.disk.delete(key);}};
 f.DB.batch=async statements=>{if(once){once=false;await f.revoke();}return batch(statements);};
 assert.equal((await f.request(`/uploads/${u.id}`,{client:f.t,method:'DELETE'})).status,404);assert.equal(calls,0);assert.equal((await readdir(f.dir)).length,1);assert(f.DB.sqlite.prepare('SELECT expires_at FROM uploads').get().expires_at>0);assert.equal(f.audit('image_delete_requested'),0);
}));
test('real disk DELETE after authorization commit remains a completed authorized operation',()=>scenario(async f=>{
 const u=(await f.upload()).data;f.env.PAPERS={...f.disk,delete:async key=>{assert.equal(f.DB.sqlite.prepare('SELECT expires_at FROM uploads').get().expires_at,0);assert.equal((await f.request(`/uploads/${u.id}/image`,{client:f.s})).status,404);await f.revoke();return f.disk.delete(key);}};
 assert.equal((await f.request(`/uploads/${u.id}`,{client:f.t,method:'DELETE'})).status,200);assert.deepEqual(await readdir(f.dir),[]);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM uploads').get().n,0);assert.equal(f.audit('image_delete_requested'),1);assert.equal(f.audit('image_deleted'),1);
}));
test('real disk cleanup failure leaves a private tombstone; authorized retry or maintenance completes',()=>scenario(async f=>{
 const first=(await f.upload()).data,second=(await f.upload()).data;f.env.PAPERS={...f.disk,delete:async()=>{throw Error('synthetic disk outage');}};
 for(const u of[first,second]){const r=await f.request(`/uploads/${u.id}`,{client:f.t,method:'DELETE'});assert.equal(r.status,503);assert.equal(r.error.code,'DELETE_PENDING');assert.equal((await f.request(`/uploads/${u.id}/image`,{client:f.s})).status,404);}
 assert.equal((await readdir(f.dir)).length,2);assert.deepEqual(await cleanupPendingUploads(f.env),{deleted:0,pending:2});await f.revoke();
 assert.equal((await f.request(`/uploads/${first.id}`,{client:f.t,method:'DELETE'})).status,404);
 f.env.PAPERS=f.disk;assert.equal((await f.request(`/uploads/${first.id}`,{client:f.s,method:'DELETE'})).status,200);assert.deepEqual(await cleanupPendingUploads(f.env),{deleted:1,pending:0});assert.deepEqual(await readdir(f.dir),[]);
}));
test('disk write acknowledgement and failed compensation leave inaccessible work for private cleanup',()=>scenario(async f=>{
 f.env.PAPERS={...f.disk,put:async(...args)=>{await f.disk.put(...args);throw Error('synthetic write acknowledgement lost');},delete:async()=>{throw Error('synthetic deletion failure');}};
 assert.equal((await f.upload()).status,503);const row=f.DB.sqlite.prepare('SELECT * FROM uploads').get();assert.equal(row.expires_at,0);assert.equal(f.audit('image_uploaded'),0);assert.equal((await readdir(f.dir)).length,1);assert.deepEqual((await f.request(`/uploads?studentId=${f.s.id}`,{client:f.s})).data,[]);
 f.env.PAPERS=f.disk;assert.deepEqual(await cleanupPendingUploads(f.env),{deleted:1,pending:0});assert.deepEqual(await readdir(f.dir),[]);
}));
test('expired objects and stale orphans are cleaned while active uploads and recent writes survive',()=>scenario(async f=>{
 const live=(await f.upload()).data,expired=(await f.upload()).data;const records=f.DB.sqlite.prepare('SELECT * FROM uploads').all(),at=Date.now(),old=new Date(at-86400001);
 f.DB.sqlite.prepare('UPDATE uploads SET expires_at=? WHERE id=?').run(at-1,expired.id);
 for(const row of records)await utimes(join(f.dir,row.object_key.replace('/','_')),old,old);
 await f.disk.put('orphan/stale',PNG);await utimes(join(f.dir,'orphan_stale'),old,old);await f.disk.put('orphan/recent',PNG);
 const result=await sweepPrivateImages(f.DB,f.disk,{at});assert.equal(result.expiredDeleted,1);assert.equal(result.orphanDeleted,1);assert.equal(result.failed,0);assert.equal((await readdir(f.dir)).length,2);
 assert.equal((await f.request(`/uploads/${expired.id}/image`,{client:f.s})).status,404);assert.equal((await f.request(`/uploads/${live.id}/image`,{client:f.s})).status,200);assert(await f.disk.get('orphan/recent'));
 // This maintenance is deliberately not a student-record retention/deletion policy.
 assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) n FROM uploads').get().n,2);
}));
