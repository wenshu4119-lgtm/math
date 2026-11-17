// Isolated audit of pinned, publicly retrieved reference modules.
// Nothing in this experiment imports these modules into the platform runtime.
// No network, deployment, credentials, Cloudflare bindings or user data are used.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base=new URL('../../.local/references/thewyj/',import.meta.url);
const treePath=new URL('tree-audit.json',base);
if(!existsSync(treePath)) throw new Error('Pinned reference cache is missing. See docs/THEWYJ-AUDIT.md; this experiment never downloads code automatically.');
const gitDigest=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const tree=JSON.parse(readFileSync(treePath,'utf8').replace(/^\uFEFF/,''));
const results=[];
for(const entry of tree.tree.filter(e=>e.type==='blob')) {
  const target=new URL(entry.path,base);
  if(!existsSync(target)) continue;
  const raw=readFileSync(target),lf=raw.toString('utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  const candidates=[raw,Buffer.from(lf),...Array.from({length:4},(_,n)=>Buffer.from(lf.trimEnd()+'\n'.repeat(n)))];
  results.push({path:entry.path,verified:candidates.some(v=>gitDigest(v)===entry.sha)});
}
test('cached upstream source matches the pinned Git tree (allowing line-ending normalization)',()=>{
  assert.equal(tree.truncated,false);
  assert.ok(results.length>=30);
  assert.deepEqual(results.filter(r=>!r.verified),[]);
});
const {hashSecret,verifySecret,createSessionToken,sessionStorageKey}=await import(new URL('functions/_lib/task12-crypto.mjs',base));
const {initialMastery,updateMastery,replayMastery,masteryView}=await import(new URL('functions/_lib/task26-mastery.mjs',base));
const pepper='synthetic-audit-only-no-production-secret-2026';
test('upstream KDF verifies synthetic correct and wrong passwords',async()=>{
  const hash=await hashSecret('synthetic-test-password',pepper);
  assert.ok(hash.startsWith('pbkdf2_sha256_cf_v1$310000$'));
  assert.equal((await verifySecret('synthetic-test-password',hash,pepper)).valid,true);
  assert.equal((await verifySecret('incorrect-test-password',hash,pepper)).valid,false);
});
test('upstream KDF rejects an absent pepper',async()=>{await assert.rejects(()=>hashSecret('synthetic-test-password',''));});
test('upstream session token is random and stored as a digest',async()=>{
  const first=createSessionToken(),second=createSessionToken();
  assert.equal(first.length,43);assert.notEqual(first,second);
  const hash=await sessionStorageKey(first);assert.match(hash,/^sha256\$[0-9a-f]{64}$/);assert.notEqual(hash,first);
});
const event={seq:1,correct:true,response_ms:15000,accepted_at:'2026-11-13T02:00:00.000Z',question_id:'audit-q1',family:'audit-family',difficulty:1,timing_verified:true};
test('one correct answer is limited evidence, not mastery',()=>{
  const s=updateMastery(initialMastery(),event);assert.equal(s.attempt_count,1);assert.equal(s.correct_count,1);
  assert.ok(s.score>0&&s.score<80);assert.notEqual(masteryView(s,Date.parse(event.accepted_at)).state,'mastered');
});
test('a repeated event sequence has no extra effect',()=>{
  const s=updateMastery(initialMastery(),event);assert.deepEqual(updateMastery(s,event),s);
});
test('same question within 20 minutes adds no effective evidence',()=>{
  const s=updateMastery(initialMastery(),event),next=updateMastery(s,{...event,seq:2,accepted_at:'2026-11-13T02:01:00.000Z'});
  assert.equal(next.attempt_count,2);assert.equal(next.effective_attempt_count,1);assert.equal(next.score,s.score);
});
test('out-of-order input is deterministically replayed by sequence',()=>{
  const later={...event,seq:2,question_id:'audit-q2',accepted_at:'2026-11-14T02:00:00.000Z'};
  assert.deepEqual(replayMastery([later,event]),updateMastery(updateMastery(initialMastery(),event),later));
});
test('increasing sequence with a reversed clock is rejected',()=>{
  assert.throws(()=>updateMastery(updateMastery(initialMastery(),event),{...event,seq:2,accepted_at:'2026-11-12T02:00:00.000Z'}));
});
test('incompatible mastery algorithm versions are rejected',()=>{
  assert.throws(()=>masteryView({...initialMastery(),algorithm_version:'invalid'}));
});
console.log(JSON.stringify({reference:'WYJ0904/thewyj.uk',commit:'4fc025a044e5e39d742166df9510d488413f7043',treeEntries:tree.tree.length,verifiedFiles:results.filter(r=>r.verified).length,failedFiles:results.filter(r=>!r.verified).map(r=>r.path),cache:fileURLToPath(base),verification:'pure-module synthetic local audit; not live D1/R2/browser/security certification'}));
