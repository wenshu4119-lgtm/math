import {openPaper} from './paper-workspace.js';
const statusText={running:'正在识别',needs_review:'待老师核对',teacher_confirmed:'老师已核对',failed:'识别失败'};
export async function ocrPanel(ctx,upload){
  const {api,el,h,row,btn,notice,exportsFor,user,notify}=ctx;
  const panel=el('section',{class:'card',id:'ocr-panel'},h('h2','本地文字识别 · 教师核对'));
  const caps=await api('/capabilities'),language=el('select',{'aria-label':'OCR识别语言'},el('option',{value:'chi_sim+eng'},'简体中文 + 英语'),el('option',{value:'eng'},'英语'));
  panel.append(notice(caps.ocr.available?'识别仅在本机运行，图片不发往外部服务。结果是待核对文字，不自动识别知识点、答案或分数。':'当前服务未启用OCR，可继续人工核对。完整DeepTutor RAG和AI出题也未接通。'),exportsFor('ocr-runs',{uploadId:upload.id},'本图识别记录'));
  const running=el('p',{class:'busy-note',role:'status','aria-live':'polite'}),details=el('div',{class:'ocr-result',tabindex:-1}),history=el('div',{class:'stack'});
  async function show(runId){
    const r=await api(`/ocr-runs/${runId}`);details.replaceChildren(h('h3',statusText[r.status]),exportsFor('ocr-run',{id:r.id},'识别原文与核对记录'),h('p',`引擎：${r.provider.id} ${r.provider.version}；${r.confidence===null?'未提供置信分':`引擎置信分 ${r.confidence}（不是准确率）`}`,'muted'));
    if(r.status==='failed'){details.append(notice(`识别失败：${r.errorCode}。没有生成替代文字。`));return;}
    if(r.status==='running'){details.append(h('p','识别处理中，请稍后刷新记录。'));return;}
    details.append(h('h3','未经修改的识别原文'),h('pre',r.text||'','ocr-text'));
    if(r.status==='teacher_confirmed'){
      details.append(h('h3','老师核对后的文字'),h('pre',r.reviewedText,'ocr-text'),h('p','文字确认不等于试题审核或评分。阅卷仍须逐题录入与人工复核。','muted'));
      if(user.role==='teacher'){
        const title=el('input',{value:'OCR核对后的人工阅卷',maxlength:100,required:true,'aria-label':'OCR来源阅卷标题'}),subject=el('select',{'aria-label':'OCR来源阅卷科目'},el('option',{value:'math'},'数学'),el('option',{value:'english'},'英语')),requestId=crypto.randomUUID();
        details.append(row(title,subject,btn('引用核对记录，建立阅卷草稿',async()=>{const p=await api('/papers',{method:'POST',body:{studentId:upload.studentId,title:title.value,subject:subject.value,kind:'scored_paper',requestId,uploadId:upload.id,ocrRunId:r.id}});await openPaper(ctx,p.id);})));
      }return;
    }
    if(user.role!=='teacher'){details.append(notice('请关联老师对照原图核对。学生不能确认OCR结果进入正式阅卷来源。'));return;}
    const text=el('textarea',{maxlength:20000,required:true,'aria-label':'老师核对OCR文字'},r.text||''),check=el('input',{type:'checkbox',required:true}),form=el('form',{class:'stack'},el('label',{},'老师核对文字（请检查公式、题号和分值）',text),el('label',{class:'checkline'},check,'我已逐项对照原图核对文字，了解这不会生成标准答案或成绩。'),el('button',{type:'submit'},'确认教师文字核对'));
    form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await api(`/ocr-runs/${r.id}/review`,{method:'PATCH',body:{text:text.value,revision:r.revision,confirmed:check.checked}});await refresh(r.id);}catch(error){notify(error.message,true);b.disabled=false;}});details.append(form);
  }
  async function refresh(selected){const runs=await api(`/uploads/${upload.id}/ocr-runs`);history.replaceChildren(h('h3','已保存的识别记录'),...runs.map(r=>btn(`${statusText[r.status]} · ${new Date(r.createdAt).toLocaleString('zh-CN',{hour12:false})}`,()=>show(r.id),'secondary')));if(!runs.length)history.append(h('p','尚无识别记录。','muted'));if(selected){await show(selected);details.focus({preventScroll:true});}}
  const recognize=btn('开始本机OCR识别',async()=>{running.textContent='正在本机识别，请等待；超时或失败会明确提示，不写入模拟文字。';try{const r=await api(`/uploads/${upload.id}/recognize`,{method:'POST',body:{language:language.value,requestId:crypto.randomUUID()}});running.textContent=r.status==='needs_review'?'识别完成，仍需老师人工核对。':r.status==='teacher_confirmed'?'返回已有教师核对记录。':r.status==='running'?'该请求仍在处理中，请稍后刷新。':`该识别请求已失败：${r.errorCode}`;await refresh(r.id);}catch(error){running.textContent=error.message;await refresh();}});recognize.disabled=!caps.ocr.available;
  panel.append(row(language,recognize,btn('刷新识别记录',()=>refresh(),'secondary')),running,history,details);await refresh(upload.ocrRunId);return panel;
}
