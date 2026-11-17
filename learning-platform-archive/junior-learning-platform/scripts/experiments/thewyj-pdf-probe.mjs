// Synthetic Canvas instrumentation; no student content and no exported PDF artifact.
// This probes layout control flow, not browser glyphs, image validity or printer output.
import { createWrongBookPdf } from '../../.local/references/thewyj/js/language/pdf.js';
import assert from 'node:assert/strict';
const calls=[];
let pages=0;
const documentStub={createElement(tag){
  assert.equal(tag,'canvas');
  const page=++pages;
  const context={font:'10px sans-serif',fillStyle:'#000',textBaseline:'alphabetic',
    fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
    measureText(text){return {width:[...text].length*16};},
    fillText(text){calls.push({page,text,font:this.font});}
  };
  return {width:0,height:0,getContext(){return context;},toBlob(callback,type){callback(new Blob([Uint8Array.of(255,216,255,217)],{type}));}};
}};
const book=Object.fromEntries(Array.from({length:3},(_,i)=>[`题${i}：${'题'.repeat(230)}`,{
  wrong_count:1,last_answer:'答'.repeat(240),correct_answer:'正'.repeat(240),
  accepted:Array.from({length:12},(_,j)=>`候选${j}${'甲'.repeat(115)}`),last_time:'2026-11-13T01:00:00Z'
}]));
await createWrongBookPdf(book,{title:'隔离 PDF 流程探测'},documentStub);
const defaultFontCalls=calls.filter(c=>c.font==='10px sans-serif').length;
const renderedAccepted=calls.filter(c=>c.text.includes('候选')).map(c=>c.text).join('');
const result={upstreamCommit:'4fc025a044e5e39d742166df9510d488413f7043',syntheticCanvas:true,pages,
  defaultFontAfterPageBreak:defaultFontCalls>0,defaultFontDraws:defaultFontCalls,
  twelfthAcceptedAnswerRendered:renderedAccepted.includes('候选11'),
  limit:'No real Canvas/fonts/JPEG viewer/printer or visual PDF was tested. No artifact was saved.'};
console.log(JSON.stringify(result,null,2));
