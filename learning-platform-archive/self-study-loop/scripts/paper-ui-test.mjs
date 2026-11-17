import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {browserHarness} from '../tests/browser-harness.mjs';
import {root} from './environment.mjs';
const out=join(root,'test-results/integration');await mkdir(out,{recursive:true});const results=[];
for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const h=await browserHarness();try{
    const t=await h.openRole('teacher',viewport),s=await h.openRole('student',viewport),p=await h.openRole('parent',viewport);
    async function nav(page,key){const bottom=page.locator(`.bottom-nav [data-nav="${key}"]`);if(await bottom.isVisible())return bottom.click();if(viewport.width<=960)await page.getByRole('button',{name:'☰ 菜单'}).click();await page.locator(`.sidebar [data-nav="${key}"]`).click();}
    await nav(t.page,'papers');await t.page.getByLabel('阅卷记录标题').fill('小题部分分 · 中文与分数核对');await t.page.getByRole('button',{name:'创建人工阅卷记录'}).click();await t.page.getByRole('button',{name:'增加题目 / 小题'}).waitFor();
    for(const [i,[max,earned]]of [[4,2.5],[6,3.5]].entries()){
      await t.page.getByRole('button',{name:'增加题目 / 小题',exact:true}).click();const item=t.page.locator('.paper-item-form').nth(i);
      await item.getByLabel('题号',{exact:true}).fill(`21(${i+1})`);await item.getByLabel('题干或观察任务').fill(i?'证明三角形全等，并写出完整理由。':'计算 1/3 + 1/6，保留过程。');await item.getByLabel('映射层级').selectOption('chapter');await item.getByLabel('章节或范围').fill(i?'全等三角形':'有理数');await item.getByLabel('满分',{exact:true}).fill(String(max));await item.getByLabel('实际得分',{exact:true}).fill(String(earned));await item.getByLabel('核对说明').fill('依据原卷步骤给部分分，不采用 AI 推断。');await item.getByRole('checkbox').check();
    }
    await t.page.getByRole('button',{name:'保存阅卷草稿',exact:true}).click();await t.page.waitForFunction(()=>!document.querySelector('main button:last-child')?.disabled&&document.querySelectorAll('.paper-item-form').length===2);await t.page.getByRole('checkbox',{name:'我确认这些分值/观察来自该学生实际作答或表现，已人工复核。'}).check();
    await t.page.getByRole('button',{name:'确认全部人工复核并生成报告'}).click();await t.page.getByText('6 / 10 分 · 卷面得分率 60%',{exact:true}).waitFor();assert.equal(await t.page.getByRole('button',{name:'保存阅卷草稿'}).count(),0);
    assert(await t.page.getByRole('link',{name:'导出 PDF',exact:true}).count()>=2);await t.page.screenshot({path:join(out,`${profile}-paper-report.png`),fullPage:true});
    for(const format of ['JSON','CSV']){const [download]=await Promise.all([t.page.waitForEvent('download'),t.page.getByRole('button',{name:`导出 ${format}`,exact:true}).click()]);const path=join(out,`${profile}-paper.${format.toLowerCase()}`);await download.saveAs(path);const data=await readFile(path,'utf8');assert(data.includes('teacher_marked'));assert(data.includes('2.5'));assert(data.includes('3.5'));}
    await nav(s.page,'papers');await s.page.getByRole('button',{name:'查看已确认报告',exact:true}).click();await s.page.getByText('6 / 10 分 · 卷面得分率 60%',{exact:true}).waitFor();assert.equal(await s.page.getByRole('button',{name:'创建人工阅卷记录'}).count(),0);
    await nav(p.page,'papers');await p.page.getByText('卷面实际得分 6 / 10，卷面得分率 60%',{exact:true}).waitFor();assert.equal(await p.page.getByText('计算 1/3 + 1/6，保留过程。',{exact:true}).count(),0);assert.equal(await p.page.getByRole('button',{name:'查看已确认报告'}).count(),0);
    await nav(t.page,'papers');await t.page.getByLabel('阅卷记录标题').fill('独立能力观察');await t.page.getByLabel('证据类型').selectOption('ability_observation');await t.page.getByRole('button',{name:'创建人工阅卷记录'}).click();await t.page.getByRole('button',{name:'增加题目 / 小题'}).click();const observation=t.page.locator('.paper-item-form').first();await observation.getByLabel('题号',{exact:true}).fill('1');await observation.getByLabel('题干或观察任务').fill('请讲述通分的方法。');await observation.getByLabel('人工观察档位').selectOption('2');await observation.getByRole('checkbox').check();await t.page.getByRole('button',{name:'保存阅卷草稿',exact:true}).click();await t.page.getByRole('checkbox',{name:'我确认这些分值/观察来自该学生实际作答或表现，已人工复核。'}).check();await t.page.getByRole('button',{name:'确认全部人工复核并生成报告'}).click();await t.page.getByText('0档：0条；1档：0条；2档：1条；3档：0条',{exact:true}).waitFor();assert(!await t.page.locator('main').innerText().then(text=>text.includes('72%')));
    assert.equal(h.DB.sqlite.prepare("SELECT COUNT(*) n FROM paper_assessments WHERE status='confirmed'").get().n,2);assert.equal(h.DB.sqlite.prepare('SELECT COUNT(*) n FROM attempts').get().n,0);
    for(const actor of [t,s,p])assert.equal(await actor.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    results.push({profile,passed:true,checks:['teacher small-question partial-score UI','save and final review','student read only','parent summary only','JSON and CSV actual download','observation remains a band','no synthetic online attempts','no viewport overflow']});
  }finally{await h.cleanup();}
}
await writeFile(join(out,'paper-ui-results.json'),JSON.stringify(results,null,2));console.log('人工阅卷界面：桌面/手机 × 8项检查通过，实际JSON/CSV下载通过。');
