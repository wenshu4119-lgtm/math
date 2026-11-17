import test from 'node:test';
import assert from 'node:assert/strict';
import {fractionSegments} from '../public/math-text.js';
test('basic fractions render but decimals, dates and URL/path fragments remain exact text',()=>{
  assert.deepEqual(fractionSegments('计算1/3 + 1/6。'),[{text:'计算'},{numerator:'1',denominator:'3'},{text:' + '},{numerator:'1',denominator:'6'},{text:'。'}]);
  for(const value of ['1.5/2','1/2.5','2026/11/13','v1/2','https://example.test/1/2','https://example.test/?q=1/2','a/1/2'])assert.deepEqual(fractionSegments(value),[{text:value}],value);
});
test('supported and unsupported mixed math preserve the original character sequence',()=>{
  const original='-1/2 + 1.5/2，得分 2.5 / 4，日期2026/11/13';
  const rebuilt=fractionSegments(original).map(s=>'text' in s?s.text:`${s.numerator}/${s.denominator}`).join('');assert.equal(rebuilt,original);
});
