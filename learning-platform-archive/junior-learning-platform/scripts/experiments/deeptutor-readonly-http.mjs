import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {inspectDeepTutor} from '../../src/deeptutor-readonly.mjs';
import {root} from '../environment.mjs';
const index=process.argv.indexOf('--origin');if(index<0)throw new Error('Provide the explicitly authorized loopback SSH tunnel origin.');
const result=await inspectDeepTutor(process.argv[index+1]);
mkdirSync(join(root,'test-results/stage8'),{recursive:true});writeFileSync(join(root,'test-results/stage8/deeptutor-http-adapter.json'),JSON.stringify({...result,testKind:'actual_deployed_DeepTutor_over_strict_SSH',modelCalls:0},null,2));
console.log(JSON.stringify(result));
