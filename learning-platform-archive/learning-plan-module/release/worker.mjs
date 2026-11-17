import {handleApi} from '../src/api.mjs';
import {securityHeaders} from '../src/security.mjs';

export default {
  async fetch(request,env) {
    // A retained maintenance deployment is the immediate rollback target.
    if(env.TRIAL_PAUSED==='true')return new Response('试用站暂时维护，请稍后再试。',{status:503,headers:{...securityHeaders,'Content-Type':'text/plain; charset=utf-8','Retry-After':'300'}});
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/'))return handleApi(request,env);
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:securityHeaders});
    // Static binding contains public/ only. No source, migrations or secrets.
    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);
    for(const [key,value] of Object.entries(securityHeaders))headers.set(key,value);
    headers.set('X-Robots-Tag','noindex, nofollow');
    return new Response(response.body,{status:response.status,headers});
  }
};
