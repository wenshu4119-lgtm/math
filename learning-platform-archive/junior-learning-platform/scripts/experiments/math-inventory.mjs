// Read-only migration audit. This never starts the old app or calls its network endpoints.
// Usage: node scripts/experiments/math-inventory.mjs [absolute-old-repository-path]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const repo=resolve(process.argv[2] || '../cloudflare-deploy');
const tracked=name=>execFileSync('git',['show',`HEAD:${name}`],{cwd:repo,encoding:'utf8',maxBuffer:4*1024*1024});
const source=tracked('app.js'),html=tracked('index.html');
const match=html.match(/window\.SYS_CONFIG\s*=\s*(\{.*\})\s*;/);
assert.ok(match,'Expected inline JSON catalog');
const cfg=JSON.parse(match[1]);
const summary={head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),configVersion:cfg.version,subjects:{},presets:cfg.presets.length};
for(const [subject,modules] of Object.entries(cfg.modules)) {
  const chapters=Object.values(modules).flatMap(m=>Object.values(m.children||{}));
  summary.subjects[subject]={modules:Object.keys(modules).length,chapters:chapters.length,knowledgePoints:chapters.reduce((n,c)=>n+Object.keys(c.kps||{}).length,0),presets:cfg.presets.filter(p=>p.subject===subject).length};
}

function functionSource(name) {
  const start=source.indexOf(`  function ${name}(`);assert.notEqual(start,-1,name);
  const end=source.indexOf('\n  }',start);assert.notEqual(end,-1,name);
  return source.slice(start,end+4);
}
const sandbox=vm.createContext({CFG:cfg,FLOW:{maxQuestions:60,weights:{math:30,physics:18,chem:12}},STATE:{subjects:['math']},paperCatalogCache:null});
const names=['entryKey','diffAt','buildQuestionsForEntry','buildAllQuestions','paperCatalog','paperNorm','paperFindScope','paperPoints','calcReport'];
vm.runInContext(`function subName(s){return CFG.subjects[s].name;}\n${names.map(functionSource).join('\n')}`,sandbox,{timeout:1000});
const entries=[];
for(const [modKey,mod] of Object.entries(cfg.modules.math))for(const [chapKey,chap] of Object.entries(mod.children))entries.push({sub:'math',modKey,chapKey,chapName:chap.name,kps:chap.kps});
sandbox.entries=entries;
const generated=vm.runInContext('buildAllQuestions(entries,function(e){return Object.keys(e.kps);})',sandbox,{timeout:1000});
summary.generatedMathAll={rows:generated.length,chaptersCovered:new Set(generated.map(q=>q.modKey)).size,knowledgePointsCovered:new Set(generated.map(q=>`${q.modKey}|${q.kpKey}`)).size,containsRealQuestionText:generated.some(q=>'prompt' in q || 'question' in q),containsAnswerKey:generated.some(q=>'answer' in q || 'correctOption' in q)};
assert.ok(generated.length<=60);
assert.equal(summary.generatedMathAll.containsRealQuestionText,false);
assert.equal(summary.generatedMathAll.containsAnswerKey,false);
const chapterMatch=vm.runInContext("paperFindScope('全等三角形','math')",sandbox,{timeout:1000});
summary.chapterMappingExample={input:'全等三角形',mappedKnowledgePoint:chapterMatch.kpName,mappedLegacyKey:chapterMatch.value,warning:'A chapter-only label currently resolves to its first knowledge point; migration must keep chapter-level uncertainty.'};
sandbox.STATE={questions:[{qid:'a',subject:'math',modKey:'m|c',modName:'示例章节',diff:'基础',score:4},{qid:'b',subject:'math',modKey:'m|c',modName:'示例章节',diff:'中档',score:6}],answers:{a:3,b:3}};
const report=vm.runInContext('calcReport()',sandbox,{timeout:1000});
assert.equal(report.totalGot,6);assert.equal(report.totalMax,10);assert.equal(report.rateAll,60);assert.equal(report.diffRate['基础'],75);assert.equal(report.diffRate['中档'],50);
summary.reportFixture={totalGot:report.totalGot,totalMax:report.totalMax,rate:report.rateAll,passed:true,evidence:'Synthetic manual marks; not a student result.'};

// The module contains no initialization side effects. Importing it does not start a server.
const {normalizeResult,default:worker}=await import(pathToFileURL(join(repo,'paper-worker.mjs')));
const normalized=normalizeResult(JSON.stringify({exam:'Synthetic fixture',questions:[{no:'1',subject:'math',scope:'有理数的加减乘除',qtype:'选择',diff:'基础',maxScore:3,score:3,correct:true,answer:'A'}]}));
assert.equal(normalized.needsReview,true);assert.equal('score' in normalized.questions[0],false);assert.equal('answer' in normalized.questions[0],false);assert.equal('correct' in normalized.questions[0],false);
assert.throws(()=>normalizeResult('{"questions":[{"no":"1"},{"no":"1"}]}'));
assert.throws(()=>normalizeResult('{"questions":[]}'));
const disabled=await worker.fetch(new Request('https://local.invalid/api/paper/analyze',{method:'POST'}),{});
assert.equal(disabled.status,503);
const testEnv={PAPER_AI_ENABLED:'true',PAPER_ACCESS_CODE:'synthetic-test-secret-not-a-real-key',AI:{run(){throw new Error('No AI may be called by this audit');}},PAPER_RATE_LIMITER:{async limit(){return {success:true};}}};
const wrongOrigin=await worker.fetch(new Request('https://local.invalid/api/paper/analyze',{method:'POST',headers:{origin:'https://other.invalid'}}),testEnv);
assert.equal(wrongOrigin.status,403);
const unauthorized=await worker.fetch(new Request('https://local.invalid/api/paper/analyze',{method:'POST',headers:{origin:'https://local.invalid'}}),testEnv);
assert.equal(unauthorized.status,401);
summary.paperChecks={normalizationDropsModelMarks:true,rejectDuplicateNumbers:true,rejectEmptyQuestions:true,disabledStatus:disabled.status,wrongOriginStatus:wrongOrigin.status,unauthorizedStatus:unauthorized.status,liveOcrVerified:false};
summary.originalPersistence={localStorage:/\blocalStorage\b/.test(source),sessionStorage:/\bsessionStorage\b/.test(source),serverLearningWrites:false};

const ui=join(repo,'platform-ui');
try {
  const files=[];
  const walk=p=>{for(const e of readdirSync(p,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const file=join(p,e.name);if(e.isDirectory())walk(file);else files.push(file);}};
  walk(ui);
  const service=readFileSync(join(ui,'services/dataService.js'),'utf8');
  const script=readFileSync(join(ui,'js/app.js'),'utf8');
  summary.concurrentPreview={files:files.length,bytes:files.reduce((n,p)=>n+statSync(p).size,0),fetchCalls:(service.match(/\bfetch\s*\(/g)||[]).length+(script.match(/\bfetch\s*\(/g)||[]).length,usesLocalStorage:/localStorage/.test(service),mockOcr:/simulateMockPaperOcr/.test(service),notice:'Untracked concurrently created preview; read only, never migrated or overwritten.'};
  const preview=vm.createContext({window:{EduPlatform:{}}});
  vm.runInContext(service,preview,{timeout:1000});
  const scoring=vm.runInContext("window.EduPlatform.DataService.computePaperReport([{no:'1',subject:'math',chapter:'Synthetic',kp:'Synthetic',diff:'基础',maxScore:3,judge:2,_isMock:true,reviewed:false}],'Synthetic audit fixture')",preview,{timeout:1000});
  const oldPoints=vm.runInContext('paperPoints({maxScore:3,score:2,actual:null})',sandbox,{timeout:1000});
  assert.equal(oldPoints,2);assert.equal(scoring.totalGot,2.16);assert.equal(scoring._isMock,false);
  summary.previewScoring={legacyManualTwoOfThree:oldPoints,previewManualTwoOfThree:scoring.totalGot,previewReportMockFlag:scoring._isMock,warning:'Preview uses 0.72 for judge=2 rather than 2/3; its report helper drops source/review provenance. Do not import this flag as authoritative student evidence.'};
} catch(e) {if(e.code!=='ENOENT')throw e;}
console.log(JSON.stringify(summary,null,2));
