import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createLocalOcr} from '../local-ocr.mjs';
import {root} from '../environment.mjs';
const out=join(root,'test-results/ocr');await mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),ocr=await createLocalOcr();
const samples=[
  {id:'english-clear',language:'eng',lines:['English Practice','1. She is a student.','2. They are in the classroom.','3. He plays football every Sunday.']},
  {id:'chinese-clear',language:'chi_sim+eng',lines:['初中数学练习','1. 解方程 2x + 3 = 11。','2. 计算 1/3 + 1/6。','等式两边同时减去相同的数。']},
  {id:'mixed-equation',language:'chi_sim+eng',lines:['Math and English','1. 3x - 4 = 8','2. She studies English every day.','3. 分数先通分，再计算。']},
  {id:'formula-limits',language:'chi_sim+eng',lines:['公式识别限制样例','1. √(x² + 1) = 5','2. a₁ + a₂ = 10','3. x ∈ [0, 1]']},
  {id:'blurred',language:'chi_sim+eng',blur:true,lines:['模糊与倾斜样例','1. 解方程 5x + 2 = 17。','2. I am ready.']},
  {id:'blank',language:'eng',lines:[]}
];
const normal=s=>s.normalize('NFKC').replace(/\s/g,'');
function distance(a,b){let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=next;}return prev[b.length];}
const results=[];
try{for(const sample of samples){const page=await browser.newPage({viewport:{width:1200,height:720}});await page.setContent('<html lang="zh-CN"><meta charset="UTF-8"><body style="margin:0;background:white"><div id="sheet" style="padding:65px;font:32px/1.9 Microsoft YaHei,Arial,sans-serif"></div></body></html>');await page.locator('#sheet').evaluate((el,data)=>{for(const line of data.lines){const p=document.createElement('p');p.textContent=line;p.style.margin='0 0 16px';el.append(p);}if(data.blur){el.style.filter='blur(1.3px)';el.style.transform='rotate(-4deg)';}},sample);const bytes=await page.screenshot();await writeFile(join(out,sample.id+'.png'),bytes);await page.close();const r=await ocr.recognize(bytes,{language:sample.language});const expected=normal(sample.lines.join('\n')),observed=normal(r.text),edits=distance(expected,observed);results.push({id:sample.id,language:sample.language,expected:sample.lines.join('\n'),recognized:r.text,engineConfidence:r.confidence,characterErrorRate:expected.length?edits/expected.length:null,blankCorrect:!expected?observed.length===0:null,elapsedMs:r.elapsedMs});console.log(JSON.stringify({sample:sample.id,elapsedMs:r.elapsedMs,characterErrorRate:results.at(-1).characterErrorRate,blankCorrect:results.at(-1).blankCorrect}));}}finally{await browser.close();}
await writeFile(join(out,'evaluation.json'),JSON.stringify({provider:ocr.description,sampleType:'six self-authored synthetic printed images, not student data or a representative benchmark',results,limitations:['No handwriting/real camera document accuracy measured','Engine confidence is not correctness probability','No question structure, answer key or grade generated'],networkImagesSent:false},null,2));
