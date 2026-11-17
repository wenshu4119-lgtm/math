import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {browserHarness} from '../tests/browser-harness.mjs';
import {observationCountsText} from '../public/parent-archive.js';

const out=new URL('../test-results/parent-observation/',import.meta.url);
await mkdir(out,{recursive:true});
const checks=[];
const check=(name,actual,expected=true)=>{assert.deepEqual(actual,expected,name);checks.push(name);};
check('missing distribution is unavailable, never fabricated zeros',observationCountsText(undefined),'档位分布未提供；不推定各档为 0。');
check('empty distribution is unavailable',observationCountsText([]),'档位分布未提供；不推定各档为 0。');
check('missing levels remain distinct from explicit zero',observationCountsText([{level:0,count:0},{level:2,count:3}]),'0档：0条；1档：未提供；2档：3条；3档：未提供');
check('invalid or duplicate counts never become facts',observationCountsText([{level:0,count:-1},{level:1,count:'0'},{level:2,count:1},{level:2,count:2},{level:3,count:1.5}]),'0档：未提供；1档：未提供；2档：未提供；3档：未提供');

for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const f=await browserHarness();
  try{
    const teacher=await f.login('teacher'),studentId=f.users.student.id;
    async function save(path,method,body){const result=await f.request(path,{client:teacher,method,body});assert(result.status>=200&&result.status<300,`${method} ${path}: ${result.error?.code||result.status}`);return result.data;}
    let paper=await save('/papers','POST',{studentId,subject:'math',title:'合成观察分档验证',kind:'ability_observation',requestId:crypto.randomUUID()});
    paper=await save(`/papers/${paper.id}`,'PATCH',{revision:paper.revision,title:paper.title,items:[0,2,2,3].map((level,index)=>({questionNo:String(index+1),prompt:'PRIVATE_OBSERVATION_PROMPT：合成测试人工观察项',qtype:'observation',mappingLevel:'unresolved',knowledgeId:null,scopeText:'未映射',maxScore:null,earnedScore:null,observationLevel:level,note:'PRIVATE_OBSERVATION_NOTE：仅供教师和学生的合成测试说明',reviewed:true}))});
    paper=await save(`/papers/${paper.id}/confirm`,'POST',{revision:paper.revision,confirmed:true});
    check(`${profile}: confirmed observation remains independent of score`,paper.report.score,null);
    check(`${profile}: backend computes actual levels`,paper.report.observationCounts,[{level:0,count:1},{level:1,count:0},{level:2,count:2},{level:3,count:1}]);
    const {page,context}=await f.openRole('parent',viewport),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const nav=async key=>{if(!await page.locator(`[data-nav="${key}"]:visible`).count())await page.getByRole('button',{name:'☰ 菜单',exact:true}).click();await page.locator(`[data-nav="${key}"]:visible`).first().click();};
    for(const key of ['archive','papers']){
      await nav(key);
      const distribution=page.locator('#main .observation-distribution');
      await distribution.waitFor();
      check(`${profile}/${key}: actual summary distribution visible`,await distribution.innerText(),'0档：1条；1档：0条；2档：2条；3档：1条');
      const text=await page.locator('#main').innerText();
      check(`${profile}/${key}: private detail excluded`,!text.includes('PRIVATE_OBSERVATION'));
      check(`${profile}/${key}: no invented observation percentage`,!text.includes('%'));
      check(`${profile}/${key}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const links=page.locator('#main a[href*="kind=paper-summaries"]');
      check(`${profile}/${key}: both PDF and print entries kept`,await links.count(),2);
      const href=await links.first().getAttribute('href'),print=await context.newPage();
      await print.goto(new URL(href,f.origin).href);
      await print.waitForSelector('#document[data-ready="true"]');
      const printed=(await print.locator('#document').innerText()).replace(/\s/g,'');
      check(`${profile}/${key}: authorized print contains every true level`,['0档:1条','1档:0条','2档:2条','3档:1条'].every(value=>printed.includes(value)));
      check(`${profile}/${key}: print excludes private detail`,!printed.includes('PRIVATE_OBSERVATION'));
      await print.evaluate(()=>{window.__observationPrintCalls=0;window.print=()=>window.__observationPrintCalls++;});
      await print.locator('#confirm').check();
      await print.locator('#print').click();
      await print.waitForFunction(()=>window.__observationPrintCalls===1);
      check(`${profile}/${key}: authorized print action revalidates`,await print.evaluate(()=>window.__observationPrintCalls),1);
      await print.close();
    }
    check(`${profile}: parent cannot read raw observation`,(await page.request.get(`${f.origin}/api/v1/papers/${paper.id}`)).status(),403);
    check(`${profile}: no uncaught page errors`,errors.length,0);
  }finally{await f.cleanup();}
}
await writeFile(new URL('results.json',out),JSON.stringify({passed:checks.length,checks,realApi:true,syntheticOnly:true,physicalDevice:false,physicalPrinting:false,notice:'Teacher confirmation is automated synthetic test input, not real human review. Browser print is intercepted only after authorization checks.'},null,2));
console.log(`Parent observation distribution: ${checks.length} checks passed.`);
