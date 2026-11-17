import {securityHeaders} from '../src/security.mjs';
const unavailable=()=>Response.json({error:{code:'TRIAL_UNAVAILABLE',message:'试用服务暂时不可用，请稍后再试。'}},{status:503,headers:securityHeaders});
export default {async fetch(request,env){
 if(env.TRIAL_PAUSED==='true')return unavailable();
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/')){
  if(url.origin!==env.APP_ORIGIN)return new Response('Forbidden',{status:403,headers:securityHeaders});
  if(!env.BRIDGE_SECRET||!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(env.TRIAL_BACKEND_ORIGIN||''))return unavailable();
  const headers=new Headers(request.headers);headers.delete('host');headers.set('X-Trial-Bridge',env.BRIDGE_SECRET);headers.set('X-Trial-Client-IP',request.headers.get('cf-connecting-ip')||'missing');
  try{
   const upstream=await fetch(env.TRIAL_BACKEND_ORIGIN+url.pathname+url.search,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual',signal:AbortSignal.timeout(25000)});
   // Never follow redirects with cookies or the private bridge credential.
   const type=upstream.headers.get('content-type')?.split(';')[0];
   const image=request.method==='GET'&&/^\/api\/v1\/uploads\/[\w-]+\/image$/.test(url.pathname)&&['image/png','image/jpeg'].includes(type)&&upstream.status===200;
   const csv=request.method==='GET'&&url.pathname==='/api/v1/draft-exports'&&url.searchParams.get('format')==='csv'&&type==='text/csv'&&upstream.status===200;
   if(upstream.status>=300&&upstream.status<400||type!=='application/json'&&!image&&!csv)return unavailable();
   const safe=new Headers(upstream.headers);for(const[k,v]of Object.entries(securityHeaders))safe.set(k,v);safe.delete('server');safe.delete('x-trial-bridge');return new Response(upstream.body,{status:upstream.status,headers:safe});
  }catch{return unavailable();}
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:securityHeaders});
 const r=await env.ASSETS.fetch(request),headers=new Headers(r.headers);for(const[k,v]of Object.entries(securityHeaders))headers.set(k,v);headers.set('X-Robots-Tag','noindex, nofollow');return new Response(r.body,{status:r.status,headers});
}};
