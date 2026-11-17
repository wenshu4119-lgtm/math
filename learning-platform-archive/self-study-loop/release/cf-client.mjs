import {readFileSync} from 'node:fs';
export const account='e790168a5525cfa3180de7a2aea228ab';
export const worker='junior-learning-trial-20261114';
export const origin=`https://${worker}.wenshu4119.workers.dev`;
export async function cfZone(path,{method='GET',body}={}) {
  if(!path.startsWith('/workers/routes'))throw new Error('Only authorized Worker routes are supported here');
  const config=readFileSync('C:/Users/Administrator/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8');
  const token=config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];if(!token)throw new Error('Existing Cloudflare credential unavailable');
  const response=await fetch(`https://api.cloudflare.com/client/v4/zones/595d46f35aabe4c233bd40bfffa00d79${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();if(!response.ok||!result.success)throw new Error(`Cloudflare route request failed: HTTP ${response.status}; codes ${(result.errors||[]).map(e=>e.code).join(',')}`);return result.result;
}
export async function cf(path,{method='GET',body}={}) {
  const config=readFileSync('C:/Users/Administrator/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8');
  const token=config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  if(!token)throw new Error('Existing Cloudflare credential unavailable');
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok||!result.success)throw new Error(`Cloudflare ${method} ${path.split('?')[0]} failed: HTTP ${response.status}; codes ${(result.errors||[]).map(e=>e.code).join(',')}`);
  return result.result;
}
