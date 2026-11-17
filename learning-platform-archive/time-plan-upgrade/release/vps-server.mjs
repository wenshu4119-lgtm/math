import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {Readable} from 'node:stream';
import {handleApi} from '../src/api.mjs';
import {equal,securityHeaders} from '../src/security.mjs';
import {openDatabase} from '../scripts/local-db.mjs';
import {privateStorage,sweepPrivateImages} from './private-storage.mjs';
import {cleanupPendingUploads} from '../src/uploads.mjs';

const env=JSON.parse(readFileSync(new URL('../private/runtime.json',import.meta.url),'utf8'));
env.DB=openDatabase(new URL('../data/learning.sqlite',import.meta.url).pathname);
if(env.ENABLE_PRIVATE_UPLOADS==='true')env.PAPERS=privateStorage(new URL('../data/papers/',import.meta.url).pathname);
let maintenanceTask=null;
function maintainUploads(){
 if(!env.PAPERS||maintenanceTask)return maintenanceTask||Promise.resolve();
 maintenanceTask=(async()=>{
  const result={event:'private_upload_maintenance',pendingDeleted:0,pendingFailed:0,pendingRemaining:null,scan:null,failedStages:0};
  try{const cleaned=await cleanupPendingUploads(env,{limit:25});result.pendingDeleted=cleaned.deleted;result.pendingFailed=cleaned.pending;result.pendingRemaining=(await env.DB.prepare('SELECT COUNT(*) AS count FROM uploads WHERE expires_at=0').first()).count;}catch{result.failedStages++;}
  try{result.scan=await sweepPrivateImages(env.DB,env.PAPERS,{limit:200});}catch{result.failedStages++;}
  const failed=result.failedStages||result.pendingFailed||result.scan?.failed||result.scan?.unsafe;
  (failed?console.error:console.log)(JSON.stringify(result));
 })().finally(()=>{maintenanceTask=null;});
 return maintenanceTask;
}
await maintainUploads();const expiryTimer=setInterval(maintainUploads,300000);expiryTimer.unref();
const server=createServer(async(req,res)=>{
 try{
  if(!equal(req.headers['x-trial-bridge'],env.BRIDGE_SECRET)||!req.url.startsWith('/api/v1/')){res.writeHead(404,securityHeaders);res.end('Not found');return;}
  const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  headers.delete('x-trial-bridge');headers.delete('host');
  headers.set('cf-connecting-ip',req.headers['x-trial-client-ip']||'missing');headers.delete('x-trial-client-ip');
  const request=new Request(new URL(req.url,env.APP_ORIGIN),{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})});
  const response=await handleApi(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(503,{...securityHeaders,'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'BRIDGE_UNAVAILABLE',message:'服务暂时不可用，请稍后重试'}}));}
});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(8791,'127.0.0.1',()=>console.log('Isolated trial backend listening on loopback'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(expiryTimer);server.close(async()=>{await maintenanceTask;env.DB.sqlite.close();process.exit(0);});});
