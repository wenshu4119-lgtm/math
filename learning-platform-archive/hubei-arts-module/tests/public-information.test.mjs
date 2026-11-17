import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const file=path=>new URL('../'+path,import.meta.url);
test('published changelog date comes from deployment evidence; development has no release date',async()=>{
 const log=JSON.parse(await readFile(file('public/changelog.json'),'utf8'));
 const evidence=JSON.parse(await readFile(file('release/production-deployment.json'),'utf8'));
 assert.equal(log.schemaVersion,1);
 const original=log.entries.find(e=>e.id==='production-20261114.1');assert.equal(original.status,'published');assert.equal(original.publishedAt,evidence.rootSwitchedAt);
 for(const e of log.entries){assert(['development','published','planned'].includes(e.status));if(e.status==='published')assert(!Number.isNaN(new Date(e.publishedAt).valueOf()));else assert.equal(e.publishedAt,null);}
});
test('public information pages retain source links and exclude private metadata',async()=>{
 for(const path of ['index.html','homepage.html','sources.html','changelog.html','licenses.html','about.html']){
  const body=await readFile(file('public/'+path),'utf8');assert(body.includes('/sources.html'));assert(body.includes('/changelog.html'));assert(body.includes('/licenses.html'));
  assert(!/127\.0\.0\.1|\/opt\/|\/var\/lib\/|C:\\Users|BEGIN PRIVATE KEY|password_hash|SESSION_SECRET|DRAFT_BRIDGE_SECRET/.test(body),path);
 }
 const sources=await readFile(file('public/sources.html'),'utf8');for(const expected of ['Antigravity','Codex','WYJ0904/thewyj.uk','HKUDS/DeepTutor','Apache-2.0','商业使用','不用于自动正式评分'])assert(sources.includes(expected));
 const js=await readFile(file('public/public-info.js'),'utf8');assert(!/innerHTML|localStorage|sessionStorage|document\.cookie/.test(js));
 const links=[...js.matchAll(/'([^']*\/licenses\/[^']+)'/g)].map(m=>m[1]);assert(links.length>=5);for(const link of links)await access(file('public'+link));
});
