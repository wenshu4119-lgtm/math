import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const path=new URL('../test-results/stage9/retrieval-generation.json',import.meta.url),available=existsSync(path);
test('saved real model evidence retains the wrong English key instead of claiming full accuracy',{skip:!available},()=>{
 const r=JSON.parse(readFileSync(path,'utf8'));assert.equal(r.candidates.length,2);const en=r.candidates.find(c=>c.subject==='english'),math=r.candidates.find(c=>c.subject==='math');
 assert.equal(en.candidate.options[en.candidate.correctOption],'am');assert.equal(en.simpleAnswerCheck,false);assert.equal(math.candidate.options[math.candidate.correctOption],'3');assert.equal(math.simpleAnswerCheck,true);assert(r.candidates.every(c=>c.reviewStatus==='pending_human'&&c.published===false));
 const off=r.queries.find(q=>q.expected===null);assert(off.citations.length>0);assert.equal(off.top1Hit,null);assert(r.queries.every(q=>q.citations.every(c=>c.nativePageCitation===false)));
});
test('real generated candidates remain isolated and never enter formal learning records',{skip:!available},()=>{
 const summary=JSON.parse(readFileSync(new URL('../test-results/stage9/candidate-import.json',import.meta.url),'utf8'));const db=new DatabaseSync(summary.lab,{readOnly:true});try{
 assert.equal(db.prepare("SELECT COUNT(*) n FROM question_drafts WHERE status='pending_human'").get().n,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM content_reviews').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM questions').get().n,12);assert.equal(db.prepare('SELECT COUNT(*) n FROM attempts').get().n,0);
 }finally{db.close();}
});
