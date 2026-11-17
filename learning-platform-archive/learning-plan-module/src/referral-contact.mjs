import {Buffer} from 'node:buffer';
import {ApiError,fail,id,now,readLimited,textField,exactKeys,securityHeaders} from './security.mjs';

const MAX_PNG_BYTES=256*1024,MAX_BODY_BYTES=400*1024;
const FIELDS=['enterpriseDisplayName','officialContactUrl','qrPngBase64','description','manualChecks','reason'];
export const REFERRAL_CONTACT_LINK_RULES=Object.freeze({
 hosts:['work.weixin.qq.com'],
 paths:['/ca/{id}','/kf/{id}'],
 sources:[
  {url:'https://developer.work.weixin.qq.com/document/path/97297',title:'获客链接管理',updatedAt:'2025-11-17'},
  {url:'https://developer.work.weixin.qq.com/document/path/94665',title:'获取客服账号链接',updatedAt:'2026-10-14'}
 ],
 checkedAt:'2026-11-15'
});
const FUTURE_NEEDS=Object.freeze([
 '人工核对企业显示名称、链接或二维码确属本机构，确认可正常使用；本次没有认证或扫码验证。',
 '确认全国线上工具测评、任务定制的实际交付和收费属性；不能仅凭线上或工具名称认定豁免培训监管。',
 '分别核对企业微信主体、管理员权限、客户联系或客服/获客能力及费用；当前未接API。',
 '确认微信传播规则、联系信息用途、隐私告知、保存期限和客户授权；不以state认证身份或成交。',
 '未来公开咨询、客户数据同步、自动归因或支付须另行核验、实现并获授权启用；保存草稿不会开启。'
]);
// Hard closed in code. Environment variables and submitted fields cannot enable it.
const CLOSED=Object.freeze({apiConnected:false,automaticAttribution:false,publicConsultationEnabled:false,liveIntegrationEnabled:false});
export function publicReferralContactStatus(){return {state:'preparing',label:'咨询方式准备中',...CLOSED};}

const ADMIN_GUARD="EXISTS(SELECT 1 FROM users rc_admin JOIN sessions rc_session ON rc_session.user_id=rc_admin.id WHERE rc_admin.id=? AND rc_admin.org_id=? AND rc_admin.role='admin' AND rc_admin.active=1 AND rc_admin.must_change_password=0 AND rc_session.token_hash=? AND rc_session.expires_at>(julianday('now')-2440587.5)*86400000)";
const guardArgs=u=>[u.id,u.org_id,u.token_hash];
function requireAdmin(u){if(!u)fail(401,'UNAUTHENTICATED','请先登录');if(u.role!=='admin')fail(403,'FORBIDDEN','仅本机构管理员可管理联系配置草稿');}
async function finalAdmin(db,u){if(!await db.prepare(`SELECT 1 AS ok WHERE ${ADMIN_GUARD}`).bind(...guardArgs(u)).first())fail(409,'ACCESS_OR_VERSION_CHANGED','账号、角色、机构或会话已变化，请重新验证');}
const privateHeaders=u=>({...securityHeaders,'X-Actor-Id':u.id});
const changedAudit=(db,u,action,resource)=>db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(),u.org_id,u.id,action,resource,now());
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function nonSecretText(value,label,min,max){const result=textField(value,label,min,max);if(/(?:corp[_\s-]?secret|api[_\s-]?v?3?[_\s-]?key|private[_\s-]?key|-----BEGIN|支付密钥|商户密钥|企业密钥|secret\s*[:=])/i.test(result))fail(400,'SECRETS_NOT_ACCEPTED','此入口不接收企业密钥、支付密钥或私钥');return result;}
export function validateOfficialContactUrl(value){
 if(value===null)return null;
 const input=nonSecretText(value,'官方联系链接',1,2048);
 if(/[\u0000-\u0020\u007f\\]/u.test(input)||!/^https:\/\/work\.weixin\.qq\.com\/(?:ca|kf)\/[A-Za-z0-9_-]{1,256}(?:\?[^#]*)?$/.test(input))fail(400,'INVALID_CONTACT_URL','仅接受官方生成的企业微信获客或客服 HTTPS 链接');
 let u;try{u=new URL(input);}catch{fail(400,'INVALID_CONTACT_URL','联系链接格式不正确');}
 if(u.protocol!=='https:'||u.hostname!=='work.weixin.qq.com'||u.port||u.username||u.password||u.hash)fail(400,'INVALID_CONTACT_URL','联系链接来源不允许');
 const kind=u.pathname.split('/')[1],allowed=kind==='ca'?['customer_channel']:kind==='kf'?['enc_scene','scene_param']:[];
 const seen=new Set();for(const [key,v] of u.searchParams){if(!allowed.includes(key)||seen.has(key)||!v||/[\u0000-\u001f\u007f]/u.test(v))fail(400,'INVALID_CONTACT_URL','联系链接参数不受支持');seen.add(key);if((key==='customer_channel'&&Buffer.byteLength(v,'utf8')>64)||(key==='scene_param'&&Buffer.byteLength(v,'utf8')>128))fail(400,'INVALID_CONTACT_URL','渠道参数超过官方长度限制');}
 // Do not fetch, expand, resolve redirects, decode QR content or rewrite signatures.
 return input;
}
const crc32=bytes=>{let crc=0xffffffff;for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
export function validateContactPng(value){
 if(value===null)return null;
 if(typeof value!=='string'||value.length>Math.ceil(MAX_PNG_BYTES/3)*4||!value.length||value.length%4!==0||!/(?:^[A-Za-z0-9+/]+={0,2}$)/.test(value))fail(400,'INVALID_PNG','请上传256KB以内的PNG原文件');
 const bytes=Buffer.from(value,'base64');
 if(bytes.length>MAX_PNG_BYTES||bytes.toString('base64')!==value||bytes.length<57||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail(400,'INVALID_PNG','PNG文件签名或编码不正确');
 if(bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')fail(400,'INVALID_PNG','缺少合法PNG图像头');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),depth=bytes[24],color=bytes[25];
 const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
 if(width<64||height<64||width>2048||height>2048||!depths[color]?.includes(depth)||bytes[26]!==0||bytes[27]!==0||bytes[28]>1)fail(400,'INVALID_PNG','PNG尺寸须为64–2048像素，且图像头格式有效');
 let offset=8,chunks=0,seenData=false,seenEnd=false;
 while(offset<bytes.length){if(++chunks>1000||offset+12>bytes.length)fail(400,'INVALID_PNG','PNG数据块不完整');const len=bytes.readUInt32BE(offset),end=offset+12+len;if(end>bytes.length)fail(400,'INVALID_PNG','PNG数据块长度不正确');const type=bytes.toString('ascii',offset+4,offset+8);if(!/^[A-Za-z]{4}$/.test(type)||crc32(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))fail(400,'INVALID_PNG','PNG数据块校验失败');if(type==='IHDR'&&offset!==8)fail(400,'INVALID_PNG','PNG图像头重复');if(type==='IDAT'){if(len)seenData=true;}if(type==='IEND'){if(len!==0||end!==bytes.length||!seenData)fail(400,'INVALID_PNG','PNG结束标记不正确');seenEnd=true;}offset=end;}
 if(!seenEnd)fail(400,'INVALID_PNG','PNG缺少结束标记');
 return {base64:value,width,height,bytes:bytes.length};
}
async function body(request,allowed){
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')fail(415,'JSON_REQUIRED','需要 application/json');
 let b;try{b=JSON.parse(new TextDecoder().decode(await readLimited(request,MAX_BODY_BYTES)));}catch(e){if(e instanceof ApiError)throw e;fail(400,'INVALID_JSON','JSON格式不正确');}
 exactKeys(b,allowed);return b;
}
function validatePayload(b,previous=null){
 const merged={...previous,...b};
 const enterpriseDisplayName=nonSecretText(merged.enterpriseDisplayName,'企业显示名称',1,100);
 const officialContactUrl=validateOfficialContactUrl(merged.officialContactUrl??null);
 const qr=has(b,'qrPngBase64')?validateContactPng(b.qrPngBase64):previous?.qr??null;
 if(!officialContactUrl&&!qr)fail(400,'CONTACT_REQUIRED','请填写官方联系链接或上传本机构真实PNG二维码，至少一项');
 const description=nonSecretText(merged.description??'','说明',0,2000),checks=merged.manualChecks??[];
 if(!Array.isArray(checks)||checks.length>20)fail(400,'INVALID_INPUT','人工核验待办须为最多20项文字清单');
 const manualChecks=checks.map(v=>nonSecretText(v,'核验待办',1,300));
 return {enterpriseDisplayName,officialContactUrl,description,manualChecks,qr};
}
function view(row){if(!row)return {id:null,version:0,state:'not_configured',enterpriseDisplayName:'',officialContactUrl:null,description:'',manualChecks:[],reason:'',hasQr:false,qr:null,...CLOSED,futureNeeds:[...FUTURE_NEEDS],allowedContactLinks:REFERRAL_CONTACT_LINK_RULES};const p=JSON.parse(row.payload_json);return {id:row.id,version:row.version,state:'draft_pending_review',enterpriseDisplayName:p.enterpriseDisplayName,officialContactUrl:p.officialContactUrl,description:p.description,manualChecks:p.manualChecks,reason:row.reason,hasQr:!!p.qr,qr:p.qr?{width:p.qr.width,height:p.qr.height,bytes:p.qr.bytes,previewUrl:`/api/v1/referral/contact-config/qr.png?v=${row.version}`} :null,...CLOSED,futureNeeds:[...FUTURE_NEEDS],allowedContactLinks:REFERRAL_CONTACT_LINK_RULES,createdAt:row.created_at,updatedAt:row.updated_at};}
async function readCurrent(db,u){const row=await db.prepare('SELECT * FROM referral_contact_drafts WHERE org_id=?').bind(u.org_id).first();const history=row?(await db.prepare('SELECT version,reason,actor_id AS actorId,created_at AS createdAt FROM referral_contact_draft_versions WHERE draft_id=? AND org_id=? ORDER BY version DESC LIMIT 100').bind(row.id,u.org_id).all()).results:[];await finalAdmin(db,u);return {row,data:{...view(row),history}};}
function queryKeys(url,allowed=[]){for(const key of url.searchParams.keys())if(!allowed.includes(key))fail(400,'INVALID_INPUT','请求参数不受支持');}

export async function referralContactRoutes(request,env,path,user,url=new URL(request.url)){
 if(!path.startsWith('/referral/contact-config'))return null;
 requireAdmin(user);
 const method=request.method,db=env.DB;
 if(path==='/referral/contact-config/qr.png'){
  if(method!=='GET')fail(405,'METHOD_NOT_ALLOWED','此入口只接受读取');queryKeys(url,['v']);
  const row=await db.prepare('SELECT * FROM referral_contact_drafts WHERE org_id=?').bind(user.org_id).first(),qr=row?JSON.parse(row.payload_json).qr:null;
  await finalAdmin(db,user);
  if(!qr)fail(404,'NOT_FOUND','本机构没有二维码草稿');
  if(url.searchParams.has('v')&&(!/^\d+$/.test(url.searchParams.get('v'))||Number(url.searchParams.get('v'))!==row.version))fail(409,'VERSION_CONFLICT','二维码版本已变化，请刷新配置');
  return {raw:Buffer.from(qr.base64,'base64'),headers:{...privateHeaders(user),'Content-Type':'image/png','Content-Disposition':'inline; filename="referral-contact-draft.png"'}};
 }
 if(path==='/referral/contact-config/print'){
  if(method!=='GET')fail(405,'METHOD_NOT_ALLOWED','此入口只接受读取');queryKeys(url);const {data}=await readCurrent(db,user);return {data:{...data,print:{label:'管理员联系配置草稿 · 未启用',scope:'本机构管理员',generatedAt:now()}},headers:privateHeaders(user)};
 }
 if(path!=='/referral/contact-config')return null;
 queryKeys(url);
 if(method==='GET'){const {data}=await readCurrent(db,user);return {data,headers:privateHeaders(user)};}
 if(!['POST','PATCH'].includes(method))fail(405,'METHOD_NOT_ALLOWED','此入口仅支持读取、创建或修订草稿');
 const b=await body(request,method==='PATCH'?[...FIELDS,'expectedVersion']:FIELDS),reason=nonSecretText(b.reason,'保存或修改原因',3,1000);
 const existing=await db.prepare('SELECT * FROM referral_contact_drafts WHERE org_id=?').bind(user.org_id).first();
 if(method==='POST'&&existing)fail(409,'VERSION_CONFLICT','已有草稿，请读取后按版本修订');
 if(method==='PATCH'&&!existing)fail(404,'NOT_FOUND','本机构尚未创建草稿');
 if(method==='PATCH'&&(!Number.isInteger(b.expectedVersion)||b.expectedVersion!==existing.version))fail(409,'VERSION_CONFLICT','草稿版本已变化，请刷新后重试');
 const payload=validatePayload(b,existing?JSON.parse(existing.payload_json):null),serialized=JSON.stringify(payload),at=now(),draftId=existing?.id??id();
 const change=method==='POST'?db.prepare(`INSERT INTO referral_contact_drafts (id,org_id,version,state,payload_json,reason,created_by,created_at,updated_at) SELECT ?,?,1,'draft_pending_review',?,?,?,?,? WHERE ${ADMIN_GUARD}`).bind(draftId,user.org_id,serialized,reason,user.id,at,at,...guardArgs(user)):db.prepare(`UPDATE referral_contact_drafts SET version=version+1,payload_json=?,reason=?,updated_at=? WHERE id=? AND org_id=? AND version=? AND ${ADMIN_GUARD}`).bind(serialized,reason,at,draftId,user.org_id,existing.version,...guardArgs(user));
 const results=await db.batch([change,db.prepare('INSERT INTO referral_contact_draft_versions (draft_id,org_id,version,payload_json,reason,actor_id,created_at) SELECT id,org_id,version,payload_json,reason,?,? FROM referral_contact_drafts WHERE id=? AND org_id=? AND changes()=1').bind(user.id,at,draftId,user.org_id),changedAudit(db,user,method==='POST'?'referral_contact_draft_created':'referral_contact_draft_updated',draftId)]);
 if(!results[0].meta.changes)fail(409,'ACCESS_OR_VERSION_CHANGED','权限或草稿版本已变化，请重新验证');
 const {data}=await readCurrent(db,user);return {status:method==='POST'?201:200,data,headers:privateHeaders(user)};
}
