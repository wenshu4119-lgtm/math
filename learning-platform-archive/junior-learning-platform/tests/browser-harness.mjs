import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {fixture,TEST_PASSWORD} from './helpers.mjs';
import {handleApi} from '../src/api.mjs';
import {securityHeaders} from '../src/security.mjs';
import {root} from '../scripts/environment.mjs';
export async function browserHarness({ocr=null}={}){
  const f=await fixture(),publicRoot=resolve(root,'public');
  if(ocr)f.env.OCR=ocr;
  const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
  const server=createServer(async(req,res)=>{try{const url=new URL(req.url,f.env.APP_ORIGIN);let response;if(url.pathname.startsWith('/api/'))response=await handleApi(new Request(url,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body:Readable.toWeb(req),duplex:'half'})}),f.env);else{const file=resolve(publicRoot,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(publicRoot+sep))response=new Response('Not found',{status:404});else try{response=new Response(await readFile(file),{headers:{...securityHeaders,'Content-Type':types[extname(file)]||'application/octet-stream'}});}catch{response=new Response('Not found',{status:404});}}res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));f.env.APP_ORIGIN=`http://127.0.0.1:${server.address().port}`;
  const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  async function openRole(name,viewport){const context=await browser.newContext({viewport});const page=await context.newPage();await page.goto(f.env.APP_ORIGIN);await page.getByLabel('登录名',{exact:true}).fill(name);await page.getByLabel('密码',{exact:true}).fill(TEST_PASSWORD);await page.getByRole('button',{name:'进入工作台 →',exact:true}).click();await page.waitForSelector('.integrated-app');await page.locator('#main .intro').waitFor();return {context,page};}
  return {...f,browser,openRole,origin:f.env.APP_ORIGIN,async cleanup(){await browser.close();await new Promise(r=>server.close(r));f.close();}};
}
