import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
const out=new URL('../test-results/homepage-current/pdf/',import.meta.url);await mkdir(out,{recursive:true});
const h=await browserHarness(),results=[];
try{
 for(const[profile,viewport]of[['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await h.browser.newContext({viewport}),page=await context.newPage(),apiCalls=[];
  page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/api/'))apiCalls.push(req.url());});
  await page.goto(h.origin+'/public-examples.html');await page.locator('#checked').check();assert(await page.locator('#pdf').isEnabled());
  await page.pdf({path:fileURLToPath(new URL(`${profile}-public-examples.pdf`,out)),format:'A4',printBackground:true,preferCSSPageSize:true});
  assert.deepEqual(apiCalls,[]);assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  results.push({profile,pdf:`${profile}-public-examples.pdf`,source:'Static original synthetic examples only; no student data or protected API requests',physicalPrint:false});await context.close();
 }
 await writeFile(new URL('generation.json',out),JSON.stringify(results,null,2));console.log(JSON.stringify({generated:results.length,output:fileURLToPath(out)}));
}finally{await h.cleanup();}
