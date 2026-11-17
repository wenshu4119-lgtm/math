import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SUBJECTS,TIERS,validateTargets,buildSchedule,priorityFromEvidence,escapeHtml} from '../public/arts/model.js';
import DATA from '../public/arts/demo-content.js';
import content from '../data/arts-content.json' with {type:'json'};

test('four published target examples sum exactly and enforce subject caps including a below-400 custom target',()=>{
  for(const [total,a] of Object.entries(TIERS))assert.equal(validateTargets(Number(total),Object.fromEntries(SUBJECTS.map(([id],i)=>[id,a[i]]))),null);
  const values={chinese:60,math:40,english:50,history:50,geography:50,politics:50};
  assert.equal(validateTargets(300,values),null);assert.match(validateTargets(301,values),/不一致/);
  assert.match(validateTargets(300,{...values,math:151}),/数学/);assert.match(validateTargets(300,{...values,history:101}),/历史/);
  assert.match(validateTargets(300,{...values,geography:-1}),/地理/);assert.match(validateTargets(300.5,values),/整数/);
});
test('public schedules reject invalid dates, infeasible loads and never generate negative study blocks',()=>{
  const base={start:'2027-01-11',exam:'2027-06-08',minutes:120,rest:1,offline:120,reserved:60};
  const s=buildSchedule(base);assert(s.days>0);assert(s.self>=0);assert.equal(s.available,s.offline+s.review+s.self);
  for(const values of [{exam:'2027-01-11'},{exam:'2027-01-10'},{exam:'2027-02-30'},{exam:''},{minutes:0},{rest:0},{rest:7},{offline:900},{reserved:1000}])assert.throws(()=>buildSchedule({...base,...values}));
  for(const offline of [0,600,690,720]){try{const v=buildSchedule({...base,offline,reserved:0});assert(v.self>=0&&v.blocks>=0,'negative study minutes/blocks must be rejected');assert.equal(v.available,v.offline+v.review+v.self);}catch(e){assert(!e.message.includes('negative study'),'Invalid schedules must fail before returning negative values');}}
});
test('uncovered evidence remains unknown and recommendations never imply a total-score prediction',()=>{
  const p=DATA.subjects[0].point;assert.match(priorityFromEvidence(p).reason,/没有.*证据|未覆盖/);
  assert.equal(priorityFromEvidence(p,{diagnostic:false}).label,'优先拿稳');assert.match(priorityFromEvidence(p,{retest:true}).reason,/仅一题/);
  assert.equal(escapeHtml('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
});
test('public demo has six complete independent loops and contains no private item identifiers or prompts',async()=>{
  const text=await readFile(new URL('../public/arts/demo-content.js',import.meta.url),'utf8');
  const privateItems=content.points.flatMap(p=>p.questions);assert.equal(DATA.subjects.length,6);
  for(const q of privateItems){assert(!text.includes(JSON.stringify(q.id)));assert(!text.includes(JSON.stringify(q.prompt)));}
  for(const s of DATA.subjects){assert.deepEqual(s.point.questions.map(q=>q.phase),['diagnostic','practice','retest']);assert.equal(s.point.reviewStatus,'pending_human');for(const q of s.point.questions){assert(q.id.startsWith('demo-'));assert.equal(q.options.length,4);assert(q.correctOption>=0&&q.correctOption<4);}}
});
test('anonymous public script only fetches safe metadata and does not persist identifying data',async()=>{
  const source=await readFile(new URL('../public/arts/public.js',import.meta.url),'utf8');
  assert.deepEqual([...source.matchAll(/fetch\(['"]([^'"]+)/g)].map(m=>m[1]),['/api/v1/public/arts/catalog']);
  assert(!/localStorage|sessionStorage|document\.cookie|indexedDB|navigator\.sendBeacon/.test(source));
  assert(source.includes("credentials:'omit'"));
});
