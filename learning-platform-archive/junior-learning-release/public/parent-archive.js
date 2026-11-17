// Adapted from Antigravity's parent archive concept; uses the verified v1 API and
// this application's DOM helpers. Backend authorization remains authoritative.
export function observationCountsText(counts) {
  if(!Array.isArray(counts)||!counts.length)return '档位分布未提供；不推定各档为 0。';
  return [0,1,2,3].map(level=>{
    const matching=counts.filter(item=>item?.level===level);
    // A missing, invalid or ambiguous entry is not evidence of zero observations.
    const count=matching.length===1?matching[0].count:undefined;
    return `${level}档：${Number.isSafeInteger(count)&&count>=0?`${count}条`:'未提供'}`;
  }).join('；');
}

export async function renderParentArchive(ctx) {
  const {main,user,studentId,api,h,card,notice,exportsFor,heading,empty,isActive}=ctx;
  if(user.role!=='parent')throw new Error('此档案仅供已授权家长查看。');
  main.replaceChildren(heading('家校摘要档案','只读查看当前关联孩子的已保存记录。'),notice('正在核验授权并读取摘要…'));
  const [g,papers,tasks]=await Promise.all([
    api(`/students/${encodeURIComponent(studentId)}/growth?summary=true`),
    api(`/students/${encodeURIComponent(studentId)}/paper-summaries`),
    api(`/students/${encodeURIComponent(studentId)}/homework-summaries`)
  ]);
  if(!isActive())return;
  // Explicit fields only: no raw answer text, image, teacherNote or private feedback.
  const growth=card(h('h2','筛查与复测'),exportsFor('growth',{studentId},'成长摘要'),
    notice('未测知识点不补零；同一学习包的记录也不代表等值测量，不换算能力提升率。'),
    ...(g.comparisons.length?g.comparisons.map(c=>h('p',`筛查 ${c.diagnosticCorrect}/${c.diagnosticTotal}；复测 ${c.retestCorrect}/${c.retestTotal}。`)):[empty('暂无对应复测记录，不推断进步。')]),
    ...g.topicEvidence.map(t=>h('p',`${t.title} · ${t.phase==='diagnostic'?'筛查':t.phase==='practice'?'练习':'复测'}：答对 ${t.correct} / 作答 ${t.answered}`)));
  const homework=card(h('h2','独立作业与家长寄语'),exportsFor('homework-summaries',{studentId},'公开作业摘要'),
    ...(tasks.length?tasks.map(t=>card(h('h3',t.title),h('p',t.score?`教师人工分数 ${t.score.earned}/${t.score.max}`:'已提交，待人工批改'),h('p',t.familySummary||'尚无公开寄语。'))):[empty('暂无已提交的独立作业。')]));
  const offline=card(h('h2','线下辅导记录'),exportsFor('paper-summaries',{studentId},'已确认线下摘要'),
    notice('卷面分与 0–3 能力观察分开保存，不与线上作答相加。'),
    ...(papers.length?papers.map(p=>card(h('h3',p.title),h('p',p.score?`实际卷面分 ${p.score.earned}/${p.score.max}`:`能力观察记录 ${p.itemCount} 条；0–3 档不折算分数。`),!p.score?h('p',observationCountsText(p.observationCounts),'observation-distribution'):null)):[empty('暂无已确认的线下辅导记录。')]));
  main.replaceChildren(heading('家校摘要档案','只读授权摘要；不包含学生原图、作答正文和教师私密批改。'),growth,homework,offline);
}
