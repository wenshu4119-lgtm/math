export function scopeSummary(scope){
  if(!scope)return '范围标签不可用，请查看保存的测评题目。';
  const labels={subject_examples:'本科目示例筛查',selected_topics:'专项筛查',pack_topics:'学习包范围',legacy:'历史题目范围（未保存选择模式）'};
  const topics=scope.topics.map(t=>`${t.title||t.id}${t.version===null?'':` v${t.version}`}`).join('；');
  return `${labels[scope.mode]||labels.legacy}：${topics||'以保存题目为准'}`;
}
export const scopeDescription=scope=>`${scopeSummary(scope)}。未覆盖知识点不作诊断，不补0分。`;
