import test from 'node:test';
import assert from 'node:assert/strict';
import { topics } from '../src/content.mjs';
test('original math sample answers independently satisfy equations and exact fractions',()=>{
  const t=topics.find(t=>t.id==='math-equation');
  [[2,3,11],[3,-4,8],[5,2,17]].forEach(([a,b,c],i)=>assert.equal(a*Number(t.questions[i][2][t.questions[i][3]])+b,c));
  const f=topics.find(t=>t.id==='math-fraction');
  [[1,3,1,6,1],[3,4,1,2,-1],[2,5,1,10,1]].forEach(([a,b,c,d,sign],i)=>{const [n,m]=f.questions[i][2][f.questions[i][3]].split('/').map(Number);assert.equal((a*d+sign*c*b)*m,n*b*d);});
});
test('English samples state present tense and match independently listed grammar answers',()=>{
  const expected={'english-be':['is','are','am'],'english-present':['plays','studies','reads']};
  for(const t of topics.filter(t=>t.subject==='english')) t.questions.forEach((q,i)=>{assert.equal(q[2][q[3]],expected[t.id][i]);assert.match(q[1],/一般现在时/);assert.equal(new Set(q[2]).size,4);});
});
