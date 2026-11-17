import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,join,extname,sep } from 'node:path';
import { Readable } from 'node:stream';
import { handleApi } from '../src/api.mjs';
import { securityHeaders } from '../src/security.mjs';
import { openDatabase,migrate } from './local-db.mjs';
import { localStorage } from './local-storage.mjs';
import { root,readEnvironment } from './environment.mjs';

const env=readEnvironment();
if(env.APP_ENV!=='local'||env.APP_ORIGIN!=='http://127.0.0.1:8788') throw new Error('Local dev only supports http://127.0.0.1:8788');
env.DB=openDatabase(join(root,'.local','learning.sqlite'));migrate(env.DB);
env.PAPERS=localStorage(join(root,'.local','papers'));
if(process.argv.includes('--ocr')){try{const {createLocalOcr}=await import('./local-ocr.mjs');env.OCR=await createLocalOcr();console.log('Local OCR enabled: Tesseract 7.0.0, fixed local language files, no image network requests.');}catch{console.log('Local OCR unavailable: verify engine and language files with node scripts/setup-ocr.mjs.');}}
const publicRoot=resolve(root,'public'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,env.APP_ORIGIN);
    let response;
    if(url.pathname.startsWith('/api/')) {
      const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
      // Do not trust a caller-supplied Cloudflare IP header on the local server.
      headers.set('cf-connecting-ip',req.socket.remoteAddress||'local');
      const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
      response=await handleApi(request,env);
    } else {
      const name=decodeURIComponent(url.pathname)==='/'?'/index.html':decodeURIComponent(url.pathname);
      const target=resolve(publicRoot,'.'+name);
      if(!target.startsWith(publicRoot+sep)||name.includes('\\')||name.split('/').some(p=>p.startsWith('.')&&p.length>0)||!['GET','HEAD'].includes(req.method)) response=new Response('Not found',{status:404});
      else {
        try {response=new Response(req.method==='HEAD'?null:await readFile(target),{headers:{...securityHeaders,'Content-Type':types[extname(target)]||'application/octet-stream'}});}
        catch {response=new Response('Not found',{status:404});}
      }
    }
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  } catch {res.writeHead(500,securityHeaders);res.end('Local server error');}
});
server.listen(8788,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8788 (SQLite + private files; no remote services)'));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{env.DB.sqlite.close();process.exit(0);}));
