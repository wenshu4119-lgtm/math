import { loadDocument,readApi } from './print-data.js';
import {createSessionMonitor} from './session-guard.js';
import { fractionSegments } from './math-text.js';
const params=new URLSearchParams(location.search),kind=params.get('kind'),$=s=>document.querySelector(s);
let fingerprint='',ready=false,epoch=0,pinnedActor=null,authorization=null,controller=null,ticket=null,ticketTimer=null;
const blobs=new Set(),scope=kind+'?'+params.toString();
function el(tag,cls,...children){const n=document.createElement(tag);if(cls)n.className=cls;for(const child of children.flat())n.append(child instanceof Node?child:document.createTextNode(String(child??'')));return n;}
function mathText(value){
  const frag=document.createDocumentFragment();
  for(const segment of fractionSegments(value)){
    if('text' in segment){frag.append(document.createTextNode(segment.text));continue;}
    const ns='http://www.w3.org/1998/Math/MathML',math=document.createElementNS(ns,'math'),frac=document.createElementNS(ns,'mfrac');math.setAttribute('aria-label',`${segment.denominator} 分之 ${segment.numerator}`);
    for(const number of [segment.numerator,segment.denominator]){const mn=document.createElementNS(ns,'mn');mn.textContent=number;frac.append(mn);}math.append(frac);frag.append(math);
  }
  return frag;
}
function table(b){return el('table','doc-table',el('thead','',el('tr','',b.headers.map(c=>el('th','',c)))),el('tbody','',b.rows.map(r=>el('tr','',r.map(c=>el('td','',c))))));}
function chart(b){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 620 ${b.rows.length*62+20}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','知识点作答正确题数图表');
  const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);};
  b.rows.forEach((r,i)=>{const y=i*62;add('text',{x:0,y:y+18,'font-size':13,fill:'#243b36'},r.label);add('rect',{x:0,y:y+28,width:520,height:15,rx:3,fill:'#e5ebdf'});add('rect',{x:0,y:y+28,width:r.total?520*r.correct/r.total:0,height:15,rx:3,fill:'#456e57'});add('text',{x:535,y:y+41,'font-size':12,fill:'#243b36'},`${r.correct} / ${r.total}`);});
  return el('figure','figure',svg,el('figcaption','','图表来自当前实际提交记录；条形表示答对题数 / 作答题数，不表示能力百分位。'));
}
function block(b){
  if(b.type==='heading')return el('h2','',b.text);
  if(b.type==='notice')return el('p','notice',b.text);
  if(b.type==='table')return table(b);
  if(b.type==='chart')return chart(b);
  if(b.type==='homework-item'){const q=b.question,node=el('section',`block${(q.workText?.length||0)+(q.teacherNote?.length||0)>1000?' allow-split':''}`,el('h3','',mathText(q.prompt)),el('p','',`满分：${q.maxScore}`),...q.options.map((o,i)=>el('p','option',`${String.fromCharCode(65+i)}. `,mathText(o))));if(Number.isInteger(q.selectedOption))node.append(el('p','',`学生选择：${String.fromCharCode(65+q.selectedOption)}`),el('p','card-text',q.workText||'未填写额外过程'));if(Number.isInteger(q.correctOption))node.append(el('p','answer',`参考答案：${String.fromCharCode(65+q.correctOption)}；`,mathText(q.rationale||'')));if(q.earnedScore!==undefined)node.append(el('p','',`人工得分：${q.earnedScore}/${q.maxScore}`),el('p','card-text',q.teacherNote||'无额外逐题反馈'));return node;}
  if(b.type==='paper-item')return el('section',`block${b.title.length+b.details.join('').length>1300?' allow-split':''}`,el('h3','',mathText(b.title)),...b.details.map(detail=>el('p','',mathText(detail))));
  if(b.type==='image'){const img=el('img');img.dataset.protectedSrc=b.src;img.alt='已授权的试卷图片';return el('figure','figure',img,el('figcaption','',b.caption));}
  if(b.type==='question'){
    const long=b.prompt.length+b.options.join('').length+(b.rationale?.length||0)>1600;
    const q=el('section',`block${long?' allow-split':''}`,el('h3','',`${b.number}. `,mathText(b.prompt)),b.options.map((o,i)=>el('p','option',`${String.fromCharCode(65+i)}. `,mathText(o))));
    if(Number.isInteger(b.correctOption))q.append(el('div','answer',el('p','',`正确答案：${String.fromCharCode(65+b.correctOption)}${Number.isInteger(b.selectedOption)?`；实际选择：${String.fromCharCode(65+b.selectedOption)}`:''}`),el('p','',mathText(b.rationale||''))));
    if(b.writing)q.append(el('div','writing-lines'));return q;
  }
  const section=el('div',b.memory?'memory':'card-text allow-split');
  for(const paragraph of String(b.text).split(/\n+/).filter(Boolean))section.append(el('p','',mathText(paragraph)));
  return section;
}
function revokePrint(){ticket=null;clearTimeout(ticketTimer);document.body.classList.remove('session-print-authorized');}
function clearPrivate(message='请重新校验账号与资料权限。'){
 epoch++;controller?.abort();controller=null;revokePrint();for(const u of blobs)URL.revokeObjectURL(u);blobs.clear();ready=false;fingerprint='';authorization=null;
 document.title='受保护导出 · 学习规划';$('#preview-title').textContent='导出前检查';$('#document').replaceChildren();delete $('#document').dataset.ready;$('#checklist').textContent='';$('#confirm').checked=false;$('#confirm').disabled=true;$('#print').disabled=true;$('#status').textContent=message;$('#status').className='';monitor?.unbind();
}
const monitor=createSessionMonitor({onInvalidate:clearPrivate,onResume:()=>load(),verify:async identity=>{const turn=epoch,old=fingerprint;if(!ready)return;const current=await loadDocument(kind,params,{expectedActor:identity.actorId,signal:identity.signal,assertCurrent:()=>assertTurn(turn)});assertTurn(turn);if(JSON.stringify(current)!==old)throw Error('内容或授权范围已更新，请重新加载并核对。');}});
function assertTurn(turn){if(turn!==epoch||document.visibilityState!=='visible')throw Error('页面上下文已变化，旧请求已忽略。');}
async function imagesForCurrent(actor,signal,turn){
 for(const img of $('#document').querySelectorAll('img')){
  const source=img.dataset.protectedSrc;if(!source||!/^\/api\/v1\/uploads\/[\w-]+\/image$/.test(source))throw Error('图片来源无法验证。');
  const r=await fetch(source,{cache:'no-store',credentials:'same-origin',signal});assertTurn(turn);
  if(r.status!==200||r.headers.get('X-Actor-Id')!==actor||!['image/png','image/jpeg'].includes(r.headers.get('content-type')?.split(';')[0]))throw Error('图片授权或响应身份无法确认。');
  const blob=await r.blob();assertTurn(turn);const u=URL.createObjectURL(blob);blobs.add(u);const previous=img.src;img.src=u;if(blobs.has(previous)){URL.revokeObjectURL(previous);blobs.delete(previous);}await img.decode();assertTurn(turn);
 }
}
async function load({newIdentity=false}={}){
 if(newIdentity)pinnedActor=null;clearPrivate('正在验证账号与资料权限…');if(document.visibilityState!=='visible')return;
 const turn=epoch,c=new AbortController();controller=c;const timeout=setTimeout(()=>c.abort(),12000);
 try{
  const doc=await loadDocument(kind,params,{expectedActor:pinnedActor,signal:c.signal,assertCurrent:()=>assertTurn(turn)});assertTurn(turn);
  if(doc.authorization.scope!==scope)throw Error('导出范围发生变化。');pinnedActor=doc.authorization.actorId;
  if(doc.empty){clearPrivate('暂无可导出内容，打印未启用。');return;}
  document.title=`${doc.title} · 学习规划`;$('#preview-title').textContent=doc.title;
  $('#document').append(el('header','doc-header',el('div','brand','学习规划 / 学习工作台'),el('h1','',doc.title),el('div','doc-meta',`${doc.student?`学生别名：${doc.student}　|　`:''}导出人：${doc.viewer}（${doc.role}）\n预览时间：${new Date().toLocaleString('zh-CN',{hour12:false})}　|　当前账号授权范围`)),...doc.blocks.map(block),el('footer','doc-footer','学习规划 · 授权教学报告 · 有限样本不代表完整能力。'));
  await document.fonts.ready;assertTurn(turn);await imagesForCurrent(pinnedActor,c.signal,turn);const finalSession=await readApi('/auth/session',pinnedActor,{signal:c.signal,assertCurrent:()=>assertTurn(turn)});assertTurn(turn);if(finalSession.user?.role!==doc.authorization.role||finalSession.user?.mustChangePassword)throw Error('账号角色或状态已变化，导出权限已失效。');
  fingerprint=JSON.stringify(doc);authorization=doc.authorization;ready=true;$('#document').dataset.ready='true';$('#confirm').disabled=false;$('#checklist').textContent=`${doc.count} 条内容；${$('#document').querySelectorAll('img').length} 张图片；请核对对象与范围。`;$('#status').textContent='预览已就绪。勾选后使用本页按钮再次验证并打印。';monitor.bind({user:{id:authorization.actorId,role:authorization.role},expiresAt:authorization.expiresAt});
 }catch(error){if(turn===epoch)clearPrivate(`导出未就绪：${error.message}`);}finally{clearTimeout(timeout);if(controller===c)controller=null;}
}
$('#confirm').addEventListener('change',()=>$('#print').disabled=!(ready&&$('#confirm').checked));
$('#retry').addEventListener('click',()=>load({newIdentity:true}));
$('#print').addEventListener('click',async()=>{
 if(!ready||!$('#confirm').checked||!authorization)return;revokePrint();const turn=epoch,expected={...authorization},c=new AbortController();controller=c;const timeout=setTimeout(()=>c.abort(),10000);$('#print').disabled=true;$('#status').textContent='正在再次验证身份、范围和图片…';
 try{
  const current=await loadDocument(kind,params,{expectedActor:expected.actorId,signal:c.signal,assertCurrent:()=>assertTurn(turn)});assertTurn(turn);
  if(current.authorization.actorId!==expected.actorId||current.authorization.scope!==expected.scope||JSON.stringify(current)!==fingerprint){await load();$('#status').textContent='数据已更新，请重新核对预览。';return;}
  await imagesForCurrent(expected.actorId,c.signal,turn);assertTurn(turn);if(!ready||monitor.actorId!==expected.actorId)throw Error('打印权限已变化。');
  ticket={epoch:turn,actor:expected.actorId,scope:expected.scope,expires:Date.now()+5000,used:false};ticketTimer=setTimeout(revokePrint,5000);window.print();
  if(turn===epoch)$('#status').textContent='已请求系统打印。已生成的浏览器打印快照或本地文件不能由网页远程撤回，请妥善保管。';
 }catch(error){if(turn===epoch)clearPrivate(`打印已阻止：${error.message}`);}finally{clearTimeout(timeout);if(controller===c)controller=null;if(turn===epoch)$('#print').disabled=!(ready&&$('#confirm').checked);}
});
window.addEventListener('beforeprint',()=>{
 const allowed=ticket&&!ticket.used&&ready&&ticket.epoch===epoch&&ticket.actor===authorization?.actorId&&ticket.actor===monitor.actorId&&ticket.scope===scope&&ticket.scope===authorization?.scope&&Date.now()<=ticket.expires&&document.visibilityState==='visible';
 if(!allowed){clearPrivate('直接打印未获许可，请重新加载并使用本页打印按钮。');return;}
 ticket.used=true;document.body.classList.add('session-print-authorized');
});
window.addEventListener('afterprint',revokePrint);
await load();
