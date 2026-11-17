import {observationCountsText} from './parent-archive.js';
export const kindLabels={scored_paper:'卷面实际成绩',ability_observation:'人工能力观察'};
const subjectLabels={math:'数学',english:'英语'};
const statusLabels={draft:'草稿 · 未确认',confirmed:'已人工复核确认'};
export function safeCsvCell(value){let text=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function paperCsv(p){
  const rows=[['记录标题','证据类型','状态','题号','所属大题','题干','范围层级','范围','满分','实际得分','观察档位','核对说明','来源','算法版本','题干来源'],...p.items.map(i=>[p.title,kindLabels[p.kind],statusLabels[p.status],i.questionNo,i.parentNo,i.prompt,i.mappingLevel,i.scopeText,i.maxScore,i.earnedScore,i.observationLevel,i.note,p.source,p.report?.algorithmVersion||'未确认',p.contentOrigin])];
  return '\ufeff'+rows.map(r=>r.map(safeCsvCell).join(',')).join('\r\n');
}
export async function renderPaperWorkspace(ctx){
  const {main,user,studentId,api,el,h,card,row,btn,notice,exportsFor,notify}=ctx;
  main.replaceChildren(ctx.heading(user.role==='teacher'?'线下人工阅卷工作台':'线下辅导记录','逐题与小题保留实际得分；能力观察单独记录，AI 推断不进入成绩。'));
  window.scrollTo(0,0);main.focus({preventScroll:true});
  const capability=await api('/capabilities');main.append(notice(capability.ocr.available?'本机OCR可提供待核对文字；DeepTutor RAG与AI出题未接通。题目和实际分值仍须逐题人工复核。':'OCR、DeepTutor RAG 与 AI 出题尚未接通。请依据原卷和学生实际表现人工录入；未复核草稿不进入成长档案。'));
  if(user.role==='parent'){
    main.append(exportsFor('paper-summaries',{studentId},'已确认的辅导摘要'));
    const summaries=await api(`/students/${studentId}/paper-summaries`);if(!summaries.length)main.append(ctx.empty('暂时没有老师已确认的线下辅导记录。'));
    for(const p of summaries)main.append(card(h('span',kindLabels[p.kind],'record-kind'),h('h3',p.title),h('p',p.score?`卷面实际得分 ${p.score.earned} / ${p.score.max}，卷面得分率 ${p.score.percent}%`:`能力观察 ${p.itemCount} 条；保留0–3档，不折算成绩。`),!p.score?h('p',observationCountsText(p.observationCounts),'observation-distribution'):null,h('small','家长仅查看已确认摘要，不读取原图、逐题评分或核对说明。')));return;
  }
  main.append(row(exportsFor('papers',{studentId},'阅卷记录清单'),exportsFor('paper-summaries',{studentId},'已确认的辅导摘要')));
  if(user.role==='teacher'){
    const title=el('input',{required:true,maxlength:100,placeholder:'例如：第3周数学随堂练习','aria-label':'阅卷记录标题'}),subject=el('select',{'aria-label':'阅卷科目'},...Object.entries(subjectLabels).map(([v,t])=>el('option',{value:v},t))),kind=el('select',{'aria-label':'证据类型'},...Object.entries(kindLabels).map(([v,t])=>el('option',{value:v},t)));
    const uploads=await api(`/uploads?studentId=${studentId}`),attachment=el('select',{'aria-label':'关联试卷图片'},el('option',{value:''},'不关联图片（可直接依据纸卷录入）'),...uploads.map(u=>el('option',{value:u.id},`图片 ${u.id.slice(0,8)} · ${u.status==='confirmed'?'文本已核对':'文本待核对'}`)));
    const requestId=crypto.randomUUID(),form=el('form',{class:'card stack'},h('h3','新建线下记录'),el('label',{},'记录标题',title),row(el('label',{},'科目',subject),el('label',{},'证据类型',kind)),el('label',{},'原图（可选）',attachment),h('p','卷面成绩：填写满分与实际得分，支持部分分。能力观察：保留0–3档，不与试卷分数相加。','muted'),el('button',{type:'submit'},'创建人工阅卷记录'));
    form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const p=await api('/papers',{method:'POST',body:{studentId,title:title.value,subject:subject.value,kind:kind.value,requestId,uploadId:attachment.value||null}});await openPaper(ctx,p.id);}catch(error){notify(error.message,true);button.disabled=false;}});main.append(form);
  }
  const records=await api(`/papers?studentId=${studentId}`);main.append(h('h2','已保存的线下记录'));
  if(!records.length)main.append(ctx.empty(user.role==='teacher'?'还没有阅卷记录。可以先建立草稿，逐题核对后确认。':'暂时没有已人工复核确认的阅卷记录。'));
  for(const p of records)main.append(card(h('span',`${kindLabels[p.kind]} · ${statusLabels[p.status]}`,'record-kind'),h('h3',p.title),h('p',`${subjectLabels[p.subject]} · 版本 ${p.revision}`,'muted'),btn(p.status==='draft'?'继续人工阅卷':'查看已确认报告',()=>openPaper(ctx,p.id))));
}
export async function openPaper(ctx,pid){
  const {main,user,api,el,h,card,row,btn,notice,exportsFor,notify}=ctx,p=await api(`/papers/${pid}`);
  main.replaceChildren(ctx.heading(p.title,`${subjectLabels[p.subject]} · ${kindLabels[p.kind]} · ${statusLabels[p.status]}`,btn('返回阅卷列表',()=>renderPaperWorkspace(ctx),'secondary')),notice(p.notice),row(exportsFor('paper',{id:p.id},'已保存明细'),p.status==='confirmed'?exportsFor('paper-report',{id:p.id},'人工阅卷报告'):h('span','草稿尚未生成正式报告','muted')));
  window.scrollTo(0,0);main.focus({preventScroll:true});
  async function download(format){const current=await api(`/papers/${p.id}`);const blob=new Blob([format==='csv'?paperCsv(current):JSON.stringify({formatVersion:'1',...current},null,2)],{type:format==='csv'?'text/csv;charset=utf-8':'application/json;charset=utf-8'});const url=URL.createObjectURL(blob),a=el('a',{href:url,download:`paper-${p.id}.${format}`});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  main.append(row(btn('导出 JSON',()=>download('json'),'secondary'),btn('导出 CSV',()=>download('csv'),'secondary')));
  if(p.ocrProvenance){main.append(notice(`题干来源含老师核对过的OCR文字（${p.ocrProvenance.provider.id}）；分值仍由老师逐题录入和复核。OCR不评分。`));if(user.role==='teacher'&&p.ocrRunId){try{const r=await api(`/ocr-runs/${p.ocrRunId}`);main.append(el('details',{},h('summary','查看OCR核对文字，按原卷手工拆分题目'),h('pre',r.reviewedText,'ocr-text')));}catch{main.append(h('p','源识别记录已过期或无法读取，已保存最小来源摘要。','muted'));}}}
  if(p.attachment){if(p.attachment.available)main.append(el('details',{},h('summary','查看关联原图'),el('img',{src:`/api/v1/uploads/${p.attachment.id}/image`,alt:'关联的私有试卷原图',class:'paper-preview'})));else main.append(h('p','关联原图已过期；已确认的人工评分证据仍保留。','muted'));}
  if(p.status==='confirmed'){
    const r=p.report;main.append(card(h('h2',p.kind==='scored_paper'?'卷面实际得分':'人工能力观察'),r.score?h('p',`${r.score.earned} / ${r.score.max} 分 · 卷面得分率 ${r.score.percent}%`,'number'):h('p',r.observationCounts.map(x=>`${x.level}档：${x.count}条`).join('；')),h('p',`共 ${r.itemCount} 个叶子题目/观察；${r.unresolvedCount} 项未映射，${r.chapterOnlyCount} 项仅确认到章节。`),h('small',`来源：${p.source}；算法：${r.algorithmVersion}；没有采用AI评分。`)));
    for(const i of p.items)main.append(card(h('h3',`${i.questionNo}. ${i.prompt}`),h('p',`范围：${i.scopeText}（${i.mappingLevel==='knowledge'?'知识点':i.mappingLevel==='chapter'?'章节':'未映射'}）`),h('p',p.kind==='scored_paper'?`满分 ${i.maxScore}，实际得分 ${i.earnedScore}${i.earnedScore>0&&i.earnedScore<i.maxScore?'（部分分）':''}`:`人工观察：${i.observationLevel}档`),h('p',`核对说明：${i.note||'无补充说明'}`),h('small','教师已人工复核；确认后只读。')));return;
  }
  if(user.role!=='teacher')return;
  const knowledge=await api(`/knowledge?subject=${p.subject}`),form=el('form',{class:'card'},h('h2','逐题 / 小题人工核对'));
  const title=el('input',{required:true,maxlength:100,value:p.title,'aria-label':'修改阅卷标题'}),container=el('div',{});form.append(el('label',{},'标题',title),h('p','题号支持 1、21(1)、21(2)。大题总分与小题分不能同时录入。更改题目后须重新勾选该题核对。','muted'),container);
  let dirty=false;const editors=[];
  const confirmCheck=el('input',{type:'checkbox'}),confirmButton=btn('确认全部人工复核并生成报告',async()=>{if(dirty)throw new Error('请先保存修改，再确认。');if(!confirmCheck.checked)throw new Error('请勾选整份人工复核确认。');await api(`/papers/${p.id}/confirm`,{method:'POST',body:{revision:p.revision,confirmed:true}});await openPaper(ctx,p.id);});
  function markDirty(){dirty=true;confirmButton.disabled=true;confirmCheck.checked=false;}
  form.addEventListener('input',markDirty);form.addEventListener('change',markDirty);
  function addItem(item={}){
    const no=el('input',{required:true,maxlength:16,value:item.questionNo||'','aria-label':'题号',placeholder:'例如21(1)'}),prompt=el('textarea',{required:true,maxlength:1000,'aria-label':'题干或观察任务'},item.prompt||''),qtype=el('select',{'aria-label':'题型'},...(p.kind==='ability_observation'?[['observation','能力观察']]:[['choice','选择题'],['fill','填空题'],['solution','解答题']]).map(([v,t])=>el('option',{value:v,...(v===item.qtype?{selected:true}:{})},t))),mapping=el('select',{'aria-label':'映射层级'},...[['unresolved','未映射'],['chapter','仅确认到章节'],['knowledge','具体知识点']].map(([v,t])=>el('option',{value:v,...(v===item.mappingLevel?{selected:true}:{})},t))),scope=el('input',{maxlength:120,value:item.scopeText==='未映射'?'':item.scopeText||'','aria-label':'章节或范围',placeholder:'例如全等三角形；不自动映成首个知识点'}),kid=el('select',{'aria-label':'知识点'},el('option',{value:''},'请选择同科目知识点'),...knowledge.map(k=>el('option',{value:k.id,...(k.id===item.knowledgeId?{selected:true}:{})},k.title)));
    const max=el('input',{type:'number',min:'0.01',max:1000,step:'0.01',value:item.maxScore??'','aria-label':'满分'}),earned=el('input',{type:'number',min:0,max:1000,step:'0.01',value:item.earnedScore??'','aria-label':'实际得分'}),level=el('select',{'aria-label':'人工观察档位'},el('option',{value:''},'暂未观察'),...[0,1,2,3].map(n=>el('option',{value:n,...(item.observationLevel===n?{selected:true}:{})},`${n}档`))),note=el('textarea',{maxlength:500,'aria-label':'核对说明'},item.note||''),reviewed=el('input',{type:'checkbox',checked:!!item.reviewed});
    const field=(label,input,wide=false)=>el('label',wide?{class:'wide'}:{},label,input);
    const section=el('section',{class:'paper-item-form'},el('div',{class:'fields'},field('题号 / 小题号',no),field('题型',qtype),field('映射层级',mapping),field('题干或观察任务',prompt,true),field('章节或范围',scope),field('具体知识点',kid),...(p.kind==='scored_paper'?[field('满分（可暂留空）',max),field('实际得分（支持部分分）',earned)]:[field('人工能力观察档位',level)]),field('核对说明（可选）',note,true)),el('label',{class:'checkline'},reviewed,'我已核对本题题干、范围与实际分值/档位。'));
    const entry={node:section,get(){return {questionNo:no.value,prompt:prompt.value,qtype:qtype.value,mappingLevel:mapping.value,scopeText:scope.value,knowledgeId:mapping.value==='knowledge'?kid.value:null,maxScore:p.kind==='scored_paper'&&max.value!==''?Number(max.value):null,earnedScore:p.kind==='scored_paper'&&earned.value!==''?Number(earned.value):null,observationLevel:p.kind==='ability_observation'&&level.value!==''?Number(level.value):null,note:note.value,reviewed:reviewed.checked};}};
    const sync=()=>{kid.disabled=mapping.value!=='knowledge';scope.disabled=mapping.value==='knowledge';};sync();mapping.addEventListener('change',sync);
    for(const event of ['input','change'])section.addEventListener(event,e=>{if(e.target!==reviewed)reviewed.checked=false;});
    section.append(btn('移除此题',()=>{editors.splice(editors.indexOf(entry),1);section.remove();markDirty();},'danger'));editors.push(entry);container.append(section);
  }
  for(const item of p.items)addItem(item);
  form.append(row(btn('增加题目 / 小题',()=>{if(editors.length>=60)throw new Error('每份最多60题，请拆分记录');addItem();markDirty();},'secondary'),el('button',{type:'submit'},'保存阅卷草稿')));
  form.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('button[type=submit]');submit.disabled=true;try{await api(`/papers/${p.id}`,{method:'PATCH',body:{revision:p.revision,title:title.value,items:editors.map(e=>e.get())}});await openPaper(ctx,p.id);}catch(error){notify(error.message,true);submit.disabled=false;}});
  main.append(form,card(h('h3','整份确认'),h('p','必须先保存并逐题勾选核对。确认后冻结实际分值和报告，不重复计入成长档案。'),el('label',{class:'checkline'},confirmCheck,'我确认这些分值/观察来自该学生实际作答或表现，已人工复核。'),confirmButton));
  confirmButton.disabled=p.items.length===0;
}
