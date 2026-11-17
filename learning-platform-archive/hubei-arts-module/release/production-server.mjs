import{createServer}from'node:http';import{readFileSync}from'node:fs';import{join}from'node:path';import{Readable}from'node:stream';
import{handleApi}from'../src/api.mjs';import{equal,securityHeaders}from'../src/security.mjs';import{cleanupPendingUploads}from'../src/uploads.mjs';import{openDatabase}from'../scripts/local-db.mjs';import{privateStorage,sweepPrivateImages}from'./private-storage.mjs';
const config=JSON.parse(readFileSync(process.env.LEARNING_CONFIG_PATH||'/etc/learning-platform/runtime.json','utf8'));
const env={...config,DB:openDatabase(join(config.DATA_DIRECTORY,'learning.sqlite'))};
if(config.ENABLE_PRIVATE_UPLOADS==='true')env.PAPERS=privateStorage(join(config.DATA_DIRECTORY,'papers'));
let maintenance=null;
async function clean(){if(!env.PAPERS||maintenance)return;maintenance=(async()=>{const pending=await cleanupPendingUploads(env,{limit:25});const scan=await sweepPrivateImages(env.DB,env.PAPERS,{limit:200});const result={event:'private_storage_maintenance',pending:pending.pending??0,deleted:pending.deleted??0,scan,at:new Date().toISOString()};(result.pending||scan.failed||scan.unsafe?console.error:console.log)(JSON.stringify(result));})().catch(()=>console.error(JSON.stringify({event:'private_storage_maintenance_failed',at:new Date().toISOString()}))).finally(()=>maintenance=null);await maintenance;}
await clean();const timer=setInterval(clean,300000);timer.unref();
const allowed=new Set([config.APP_ORIGIN,config.PREVIEW_ORIGIN].filter(Boolean));
const server=createServer(async(req,res)=>{try{
 if(!equal(req.headers['x-trial-bridge'],config.BRIDGE_SECRET)||!req.url.startsWith('/api/v1/')){res.writeHead(404,securityHeaders);res.end('Not found');return;}
 const requestOrigin=req.headers['x-learning-origin']||config.APP_ORIGIN;if(!allowed.has(requestOrigin)){res.writeHead(403,securityHeaders);res.end('Forbidden');return;}
 const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);headers.delete('host');headers.delete('x-trial-bridge');headers.delete('x-learning-origin');headers.set('cf-connecting-ip',req.headers['x-trial-client-ip']||'missing');headers.delete('x-trial-client-ip');
 const response=await handleApi(new Request(new URL(req.url,requestOrigin),{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})}),{...env,APP_ORIGIN:requestOrigin});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(503,{...securityHeaders,'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'SERVICE_UNAVAILABLE',message:'服务暂时不可用，请稍后重试'}}));}});
server.requestTimeout=30000;server.headersTimeout=15000;server.listen(config.PORT||8792,'127.0.0.1',()=>console.log('Learning platform listening on loopback'));
for(const s of['SIGINT','SIGTERM'])process.on(s,()=>{clearInterval(timer);server.close(async()=>{await maintenance;env.DB.sqlite.close();process.exit(0);});});
