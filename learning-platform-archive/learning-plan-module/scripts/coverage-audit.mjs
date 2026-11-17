// Read-only inventory of actual local demo state and original source content. No credentials logged.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {topics} from '../src/content.mjs';
import {capabilities} from '../src/ocr.mjs';
import {root} from './environment.mjs';
const db=new DatabaseSync(join(root,'.local/learning.sqlite'),{readOnly:true});
try{
  const coverage=db.prepare("SELECT k.subject,COUNT(DISTINCT k.id) topics,COUNT(q.id) questions,SUM(q.phase='diagnostic') diagnostic,SUM(q.phase='practice') practice,SUM(q.phase='retest') retest FROM knowledge k JOIN questions q ON q.knowledge_id=k.id GROUP BY k.subject").all();
  const content=db.prepare('SELECT id,subject,title,version,is_example,CASE WHEN length(explanation)>0 THEN 1 ELSE 0 END explanationPresent,CASE WHEN length(memory_card)>0 THEN 1 ELSE 0 END memoryCardPresent FROM knowledge ORDER BY subject,id').all();
  const reviews=db.prepare('SELECT k.subject,COUNT(*) currentVersionReviewRecords FROM content_reviews r JOIN knowledge k ON k.id=r.knowledge_id AND k.version=r.version GROUP BY k.subject').all();
  const recordCounts={};for(const table of ['attempts','answers','packs','paper_assessments','ocr_runs','homeworks'])recordCounts[table]=db.prepare('SELECT COUNT(*) n FROM '+table).get().n;
  const result={observedAt:new Date().toISOString(),database:'local demo, read-only',coverage,content,reviews,recordCounts,roles:db.prepare('SELECT role,active,COUNT(*) n FROM users GROUP BY role,active').all(),relationships:db.prepare('SELECT kind,COUNT(*) n FROM relationships GROUP BY kind').all(),migrations:readdirSync(join(root,'migrations')).filter(n=>n.endsWith('.sql')).sort(),source:{topics:topics.length,explanations:topics.filter(t=>t.explanation).length,memoryCards:topics.filter(t=>t.memory_card).length,questions:topics.reduce((n,t)=>n+t.questions.length,0),rationales:topics.flatMap(t=>t.questions).filter(q=>q[4]).length,automatedCheckNotes:topics.flatMap(t=>t.questions).filter(q=>q[5]).length},defaultCapabilities:capabilities({}),notice:'Review records are account actions, not independent proof of human teaching verification. All source content is a small original example bank, not a full curriculum. DeepTutor runtime is not connected.'};
  mkdirSync(join(root,'test-results/stage5'),{recursive:true});writeFileSync(join(root,'test-results/stage5/coverage.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({coverage,currentReviewRecords:reviews,recordCounts,source:result.source}));
}finally{db.close();}
