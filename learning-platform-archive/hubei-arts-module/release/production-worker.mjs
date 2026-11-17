import{securityHeaders}from'../src/security.mjs';
const unavailable=()=>Response.json({error:{code:'SERVICE_UNAVAILABLE',message:'学习规划暂时维护，请稍后再试。'}},{status:503,headers:securityHeaders});
export default{async fetch(request,env){
 const url=new URL(request.url);if(env.MAINTENANCE==='true')return unavailable();
 if(![env.APP_ORIGIN,env.PREVIEW_ORIGIN].includes(url.origin))return new Response('Forbidden',{status:403,headers:securityHeaders});
 if(url.pathname.startsWith('/api/')){
  if(!env.BRIDGE_SECRET||env.BACKEND_ORIGIN!=='https://earning-origin.mrxu.uk')return unavailable();
  const headers=new Headers(request.headers);headers.delete('host');headers.set('X-Trial-Bridge',env.BRIDGE_SECRET);headers.set('X-Trial-Client-IP',request.headers.get('cf-connecting-ip')||'missing');headers.set('X-Learning-Origin',url.origin);
  try{const r=await fetch(env.BACKEND_ORIGIN+url.pathname+url.search,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual',signal:AbortSignal.timeout(25000)}),type=r.headers.get('content-type')?.split(';')[0];
   const image=request.method==='GET'&&/^\/api\/v1\/uploads\/[\w-]+\/image$/.test(url.pathname)&&['image/png','image/jpeg'].includes(type)&&r.status===200;
   const csv=request.method==='GET'&&(url.pathname==='/api/v1/draft-exports'||/^\/api\/v1\/bank\/questions\/[\w-]+\/export$/.test(url.pathname))&&url.searchParams.get('format')==='csv'&&type==='text/csv'&&r.status===200;
   if(r.status>=300&&r.status<400||type!=='application/json'&&!image&&!csv)return unavailable();const safe=new Headers(r.headers);for(const[k,v]of Object.entries(securityHeaders))safe.set(k,v);safe.set('Strict-Transport-Security','max-age=31536000');return new Response(r.body,{status:r.status,headers:safe});
  }catch{return unavailable();}
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:securityHeaders});
 const r=await env.ASSETS.fetch(request),headers=new Headers(r.headers);for(const[k,v]of Object.entries(securityHeaders))headers.set(k,v);headers.set('Strict-Transport-Security','max-age=31536000');headers.set('X-Robots-Tag','noindex, nofollow');return new Response(r.body,{status:r.status,headers});
}};
