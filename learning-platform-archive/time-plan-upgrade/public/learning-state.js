// Pure presentation state. Never calculate scores or infer progress from demo baselines.
export function learningCycle(attempts,packs,subject) {
  const diagnostic=attempts.filter(a=>a.subject===subject&&a.phase==='diagnostic')[0]||null;
  const pack=diagnostic?packs.find(p=>p.diagnosticId===diagnostic.id)||null:null;
  const practice=pack?attempts.find(a=>a.packId===pack.id&&a.phase==='practice')||null:null;
  const retest=pack?attempts.find(a=>a.packId===pack.id&&a.phase==='retest')||null:null;
  return {diagnostic,pack,practice,retest,steps:[
    {done:diagnostic?.status==='submitted',text:!diagnostic?'尚未筛查':diagnostic.status==='submitted'?'本轮筛查已提交':'本轮筛查待提交'},
    {done:practice?.status==='submitted',text:!pack?'筛查后匹配学习包':pack.status==='draft'?'待关联老师审核':practice?.status==='submitted'?'本轮练习已提交':'讲解 → 记背 → 练习'},
    {done:retest?.status==='submitted',text:retest?.status==='submitted'?'本轮复测已记录':retest?'本轮复测待提交':'尚未复测，不推断进步'}
  ]};
}
