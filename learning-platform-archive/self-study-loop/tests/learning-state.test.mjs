import test from 'node:test';
import assert from 'node:assert/strict';
import {learningCycle} from '../public/learning-state.js';
test('UI cycle never claims progress from absent data or an older unrelated retest',()=>{
  const empty=learningCycle([],[],'math');assert(empty.steps.every(s=>!s.done));assert.match(empty.steps[2].text,/尚未复测/);
  const attempts=[{id:'new',subject:'math',phase:'diagnostic',status:'submitted'},{id:'old-retest',subject:'math',phase:'retest',status:'submitted',packId:'old-pack'},{id:'old',subject:'math',phase:'diagnostic',status:'submitted'}];
  const cycle=learningCycle(attempts,[{id:'old-pack',diagnosticId:'old',status:'completed'}],'math');assert.equal(cycle.diagnostic.id,'new');assert.equal(cycle.pack,null);assert.equal(cycle.steps[2].done,false);
});
