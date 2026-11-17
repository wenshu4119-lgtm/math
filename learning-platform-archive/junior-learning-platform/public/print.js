import { loadDocument } from './print-data.js';
import { fractionSegments } from './math-text.js';
const params=new URLSearchParams(location.search),kind=params.get('kind'),$=s=>document.querySelector(s);
let fingerprint='',ready=false;
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
  if(b.type==='image'){const img=el('img');img.src=b.src;img.alt='已授权的试卷图片';return el('figure','figure',img,el('figcaption','',b.caption));}
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
function disable(message,error=false){ready=false;delete $('#document').dataset.ready;$('#print').disabled=true;$('#confirm').disabled=true;$('#confirm').checked=false;$('#status').textContent=message;$('#status').className=error?'error':'';}
async function load(){
  disable('正在校验权限并读取最新数据…');$('#document').replaceChildren();$('#checklist').textContent='';
  try{
    const doc=await loadDocument(kind,params);fingerprint=JSON.stringify(doc);document.title=`${doc.title} · 知行`;$('#preview-title').textContent=doc.title;
    const header=el('header','doc-header',el('div','brand','知行 / 学习工作台'),el('h1','',doc.title),el('div','doc-meta',`${doc.student?`学生别名：${doc.student}　|　`:''}导出人：${doc.viewer}（${doc.role}）\n预览时间：${new Date().toLocaleString('zh-CN',{hour12:false})}　|　数据：当前账号授权范围内的实时记录`));
    $('#document').append(header);
    if(doc.empty){$('#document').append(el('p','empty-state','暂无可导出的内容。完成实际业务操作后再试。'));disable('暂无可导出数据，打印已禁用。');return;}
    $('#document').append(...doc.blocks.map(block),el('footer','doc-footer','知行学习工作台 · 本地 MVP · 示例内容及有限样本不代表完整能力。文件仅供授权范围内教学使用。'));
    await document.fonts.ready;
    await Promise.all([...$('#document').querySelectorAll('img')].map(img=>img.decode().catch(()=>{throw new Error('必要图片未能加载或已经失去访问权限，已阻止导出。');})));
    const longQuestions=$('#document').querySelectorAll('.block.allow-split').length;
    $('#checklist').textContent=`内容已加载：${doc.count} 条；图片 ${$('#document').querySelectorAll('img').length} 张；A4 样式已应用。${longQuestions?'含超长题目，请在系统预览中逐页核对跨页位置。':''}`;
    ready=true;$('#confirm').disabled=false;$('#status').textContent='预览已就绪。核对并勾选后可打印或保存为 PDF。';
    $('#document').dataset.ready='true';
  }catch(e){$('#document').replaceChildren(el('p','empty-state error',e.message));disable(`导出失败：${e.message}`,true);}
}
$('#confirm').addEventListener('change',()=>$('#print').disabled=!(ready&&$('#confirm').checked));
$('#retry').addEventListener('click',load);
$('#print').addEventListener('click',async()=>{
  if(!ready||!$('#confirm').checked)return;$('#print').disabled=true;$('#status').textContent='正在再次核验权限与数据…';
  try{
    const current=await loadDocument(kind,params);
    if(JSON.stringify(current)!==fingerprint){await load();$('#status').textContent='数据发生变化，已刷新预览，请重新检查。';return;}
    // An image is another protected resource; recheck it before opening the system dialog.
    for(const img of $('#document').querySelectorAll('img')){const response=await fetch(img.src,{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error('图片访问权限已失效，请重新加载。');}
    await document.fonts.ready;window.print();$('#status').textContent='已请求系统打印。请在系统窗口中选择保存为 PDF 或打印；取消不会保存文件。';
  }catch(e){$('#document').replaceChildren(el('p','empty-state error',e.message));disable(`导出失败：${e.message}`,true);return;}
  $('#print').disabled=false;
});
// Browser Ctrl+P must not print a loading/error/empty document.
window.addEventListener('beforeprint',()=>{if(!ready)$('#document').replaceChildren(el('p','empty-state','内容尚未就绪或无访问权限，无法导出业务数据。'));});
await load();
