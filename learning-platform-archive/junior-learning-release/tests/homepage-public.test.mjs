import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleApi} from '../src/api.mjs';
import {fixture} from './helpers.mjs';

test('public homepage and examples contain no private workspace bootstrap or live question payload',async()=>{
  const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const alias=await readFile(new URL('../public/homepage.html',import.meta.url),'utf8');
  assert.equal(home,alias);
  for(const id of ['learning-flow','coverage','samples','collaboration','ai-public-status'])assert(home.includes(`id="${id}"`));
  assert(home.includes('超低、低、中等、高、超高'));
  assert(home.includes('未完成定级的内容显示待定级'));
  assert(home.includes('示例／合成数据，非真实学生成绩'));
  assert(!home.includes('src="/app.js"'));
  assert(!/correctOption|studentId|password_hash|lp_session/.test(home));
  const script=await readFile(new URL('../public/public-coverage.js',import.meta.url),'utf8');
  assert(script.includes("credentials:'omit'"));
  assert(!/localStorage|sessionStorage|document\.cookie|innerHTML/.test(script));
  assert.deepEqual([...script.matchAll(/aggregate\('([^']+)'\)/g)].map(m=>m[1]).sort(),['/api/v1/public/ai-status','/api/v1/public/coverage']);
});

test('anonymous visitor remains excluded from private data and answers',async()=>{
  const f=await fixture();
  try{
    for(const path of ['/students','/knowledge','/content/review-queue','/drafts','/attempts','/packs','/homeworks','/uploads','/students/'+f.users.student.id+'/growth']){
      const response=await handleApi(new Request(`${f.env.APP_ORIGIN}/api/v1${path}`),f.env);
      assert.equal(response.status,401,path);
      const body=await response.json();assert(!body.data,path);assert.equal(body.error.code,'UNAUTHENTICATED');
    }
  }finally{f.close();}
});
