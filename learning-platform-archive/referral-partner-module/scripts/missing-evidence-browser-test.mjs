import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {browserHarness} from '../tests/browser-harness.mjs';
import {missingEvidenceScenario} from '../tests/evidence-scenarios.mjs';
import {root} from './environment.mjs';
import {EXPORTS} from '../public/export-registry.js';
const out=join(root,'test-results/missing-evidence');await mkdir(out,{recursive:true});
const results={completed:false,checks:[],pdfs:[],screenshots:[],profiles:[],notice:'Synthetic isolated users, automated teacher review, real API and Chrome PDF output. No production data or AI calls. Mobile viewport is not a physical device.'};
const check=(name,value,expected=true)=>{assert.deepEqual(value,expected,name);results.checks.push(name);};
async function client(page){const session=(await (await page.request.get(new URL('/api/v1/auth/session',page.url()).href)).json()).data,c=(await page.context().cookies()).find(c=>c.name==='lp_session');return {id:session.user.id,cookie:`lp_session=${c.value}`,csrfToken:session.csrfToken};}
async function nav(page,key){if(!await page.locator(`[data-nav="${key}"]:visible`).count())await page.getByRole('button',{name:'☰ 菜单',exact:true}).click();await page.locator(`[data-nav="${key}"]:visible`).first().click();}
const compact=text=>text.replace(/\s/g,'');
try{
  for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
    const f=await browserHarness();try{
      const roles={};for(const name of ['student','teacher','parent','student2'])roles[name]=await f.openRole(name,viewport);
      const clients={};for(const [name,role]of Object.entries(roles))clients[name]=await client(role.page);
      const sample=await missingEvidenceScenario(f,{teacher:clients.teacher,student:clients.student});
      await writeFile(join(out,`${profile}-api-evidence.json`),JSON.stringify(sample,null,2));
      check(`${profile}: four real sample knowledge points remain`,sample.knowledge.length,4);
      check(`${profile}: only sampled point-phase pairs returned`,sample.growth.topicEvidence.map(r=>[r.knowledgeId,r.phase,r.correct,r.answered]),[['math-equation','diagnostic',0,1],['math-equation','practice',0,1],['math-fraction','diagnostic',1,1]]);
      check(`${profile}: missing categories not targeted as weak`,sample.pack.weakKnowledgeIds,['math-equation']);
      check(`${profile}: open English has no result`,sample.englishOpen.result,null);check(`${profile}: no fictional retest comparison`,sample.growth.comparisons,[]);
      const student=roles.student.page,teacher=roles.teacher.page;
      async function shot(page,name){await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>document.fonts.ready);const file=`${profile}-${name}.png`;await page.screenshot({path:join(out,file),fullPage:true});results.screenshots.push(file);check(`${profile}/${name}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
      await nav(student,'growth');await student.getByRole('heading',{name:'学习时间线',exact:true}).waitFor();
      const table=await student.locator('#main table tbody tr').evaluateAll(rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent)));
      check(`${profile}: UI sample rows, including zero, are exact`,table.map(r=>r[2]),['0 / 1','0 / 1','1 / 1']);
      check(`${profile}: UI has no English or unsampled practice row`,table.map(r=>r[0]),sample.growth.topicEvidence.map(r=>r.title));
      const growthText=await student.locator('#main').innerText();check(`${profile}: omission meaning visible in UI`,growthText.includes('暂无有效作答或未覆盖，不代表0分'));check(`${profile}: no zero denominator or fabricated warning`,!/NaN|Infinity|预警|0\s*\/\s*0/.test(growthText));check(`${profile}: no comparison message retained`,growthText.includes('尚无进步对比依据'));await shot(student,'growth-ui');
      await nav(student,'learning');await student.getByRole('button',{name:'打开通关包',exact:true}).click();await student.getByRole('button',{name:'回看练习',exact:true}).click();await student.getByText('本次答对 0 / 1 题',{exact:true}).waitFor();await shot(student,'zero-practice-ui');
      await nav(student,'learning');await student.getByRole('button',{name:'英语',exact:true}).click();await student.getByRole('button',{name:'继续能力筛查',exact:true}).click();await student.getByRole('button',{name:'提交本次实际作答',exact:true}).waitFor();check(`${profile}: open attempt is not shown as zero`,await student.getByText('本次答对',{exact:false}).count(),0);await shot(student,'unsubmitted-english-ui');
      await nav(teacher,'papers');const draftCard=teacher.locator('#main > .card').filter({hasText:'合成样例：真实零分与缺失分值'});await draftCard.getByRole('button').click();await teacher.getByRole('heading',{name:'逐题 / 小题人工核对',exact:true}).waitFor();await teacher.getByLabel('实际得分',{exact:true}).first().waitFor();
      check(`${profile}: draft inputs distinguish zero and missing`,await teacher.getByLabel('实际得分',{exact:true}).evaluateAll(inputs=>inputs.map(i=>i.value)),['0','']);check(`${profile}: missing full score remains blank`,await teacher.getByLabel('满分',{exact:true}).evaluateAll(inputs=>inputs.map(i=>i.value)),['4','']);await shot(teacher,'draft-null-vs-zero-ui');
      await nav(student,'papers');await student.locator('#main > .card').filter({hasText:'合成样例：已确认真实零分'}).getByRole('button').click();await student.getByRole('heading',{name:'卷面实际得分',exact:true}).waitFor();const zeroUi=compact(await student.locator('#main').innerText());check(`${profile}: confirmed zero score and percent retained in UI`,zeroUi.includes('0/4')&&zeroUi.includes('0%'));await shot(student,'confirmed-zero-ui');

      async function pdf(actor,name,kind,key,id,verify){
        const page=await roles[actor].context.newPage();await page.goto(`${f.origin}/print.html?kind=${kind}&${key}=${id}`);await page.waitForSelector('#document[data-ready="true"]');const text=compact(await page.locator('#document').innerText());
        check(`${profile}/${name}: finite values, no invented warning`,!/NaN|Infinity|预警|0\/0/.test(text));await verify(page,text);
        await page.locator('#confirm').check();check(`${profile}/${name}: authorized preview can print`,await page.locator('#print').isEnabled());
        const file=`${profile}-${name}.pdf`;await page.pdf({path:join(out,file),format:'A4',preferCSSPageSize:true,printBackground:true});results.pdfs.push({profile,actor,name,file,kind});
        if(name==='growth-missing-vs-zero')await shot(page,'growth-print-preview');await page.close();
      }
      const verifyGrowth=async(page,text)=>{
        check(`${profile}: PDF preview defines omission`,text.includes('暂无有效作答或未覆盖，不代表0分'));
        const chart=await page.locator('#document figure svg').evaluateAll(svgs=>svgs.map(svg=>({labels:[...svg.querySelectorAll('text')].map(n=>n.textContent),widths:[...svg.querySelectorAll('rect[fill="#456e57"]')].map(n=>Number(n.getAttribute('width')))})));
        check(`${profile}: chart draws only actual samples and genuine zero bars`,chart.map(x=>x.widths),[[0,0,520]]);check(`${profile}: chart ratios retain positive denominators`,chart[0].labels.filter(t=>t.includes(' / ')),['0 / 1','0 / 1','1 / 1']);check(`${profile}: chart omits unsampled English`,!chart[0].labels.some(t=>t.includes('be动词')||t.includes('第三人称单数')));
        check(`${profile}: actual manual zero remains distinct from no sample`,text.includes('0/4分（卷面得分率0%）'));results.profiles.push({profile,chart,knownPoints:sample.knowledge.map(k=>k.id),returnedPairs:sample.growth.topicEvidence.map(r=>`${r.knowledgeId}/${r.phase}`)});
      };
      await pdf('student','growth-missing-vs-zero','growth','studentId',clients.student.id,verifyGrowth);
      await pdf('student','practice-zero','attempt','id',sample.practice.id,async(page,text)=>{const pairs=await page.locator('#document math mfrac').evaluateAll(nodes=>nodes.map(n=>[...n.querySelectorAll('mn')].map(v=>v.textContent)));check(`${profile}: practice PDF preserves genuine 0 of 1 in MathML`,text.includes('答对')&&pairs.some(p=>p[0]==='0'&&p[1]==='1'));});
      await pdf('student','english-unsubmitted','attempt','id',sample.englishOpen.id,async(_page,text)=>{check(`${profile}: unsubmitted PDF explicitly has no score`,text.includes('尚未提交，不能导出标准答案或成绩'));check(`${profile}: unsubmitted PDF has no answer or invented zero`,!text.includes('正确答案')&&!text.includes('答对0/'));});
      await pdf('teacher','draft-missing-and-zero','paper','id',sample.unknownDraft.id,async(_page,text)=>{check(`${profile}: draft PDF preserves both zero and missing`,text.includes('满分：4；实际得分：0')&&text.includes('满分：待填写；实际得分：待填写'));check(`${profile}: draft is not a formal score`,text.includes('草稿尚未确认')&&!text.includes('卷面得分率'));});
      await pdf('student','confirmed-zero-report','paper-report','id',sample.zeroReport.id,async(page,text)=>{const pairs=await page.locator('#document math mfrac').evaluateAll(nodes=>nodes.map(n=>[...n.querySelectorAll('mn')].map(v=>v.textContent)));check(`${profile}: report PDF preserves true zero percent`,text.includes('卷面得分率0%')&&(text.includes('实际得分0/4')||pairs.some(p=>p[0]==='0'&&p[1]==='4')));check(`${profile}: report does not invent uncovered fraction group`,!text.includes('有理数：分数加减'));});
      await pdf('parent','parent-growth-zero','growth','studentId',clients.student.id,verifyGrowth);
      for(const [name,id,expected]of [['student2',clients.student2.id,'暂无可导出数据'],['student2',clients.student.id,'导出失败']]){const page=await roles[name].context.newPage();await page.goto(`${f.origin}/print.html?kind=growth&studentId=${id}`);await page.waitForFunction(expected=>document.querySelector('#status').textContent.includes(expected),expected);check(`${profile}/${expected}: printing disabled`,await page.locator('#print').isDisabled());check(`${profile}/${expected}: no fake zero chart`,await page.locator('#document svg').count(),0);await page.close();}
      check(`${profile}: no additional export kind introduced`,Object.keys(EXPORTS).length,25);
    }finally{await f.cleanup();}
  }
  results.completed=true;
}catch(error){results.failure=error.message;throw error;}
finally{results.passed=results.checks.length;await writeFile(join(out,'summary.json'),JSON.stringify(results,null,2));}
console.log(`缺失与零分：${results.checks.length}项浏览器/API断言；${results.pdfs.length}份真实PDF；${results.screenshots.length}张截图。`);
