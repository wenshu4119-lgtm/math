import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {root} from './environment.mjs';
import {OCR_MODELS,OCR_MODEL_REVISION} from './ocr-models.mjs';
export const defaultOcrEngine='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/tesseract.js';
export async function createLocalOcr({engineDir=process.env.OCR_ENGINE_DIR||defaultOcrEngine,modelDir=process.env.OCR_MODEL_DIR||join(root,'.local/ocr-models'),timeoutMs=45000}={}){
  const pkg=JSON.parse(await readFile(join(engineDir,'package.json'),'utf8'));if(pkg.version!=='7.0.0')throw new Error('OCR_ENGINE_VERSION_UNVERIFIED');
  for(const [name,expected]of Object.entries(OCR_MODELS)){const bytes=await readFile(join(modelDir,name));if(bytes.length!==expected.bytes||createHash('sha256').update(bytes).digest('hex')!==expected.sha256)throw new Error('OCR_MODEL_UNVERIFIED');}
  let busy=false;
  const description={id:'tesseract-local',version:pkg.version,languages:['eng','chi_sim+eng'],modelRevision:OCR_MODEL_REVISION,mode:'local-only',networkImagesSent:false};
  return {description,get busy(){return busy;},async recognize(bytes,{language='chi_sim+eng'}={}){
    if(busy)throw Object.assign(new Error('OCR is busy'),{code:'OCR_BUSY'});if(!['eng','chi_sim+eng'].includes(language))throw Object.assign(new Error('Language is not supported'),{code:'OCR_LANGUAGE_UNSUPPORTED'});
    busy=true;const started=performance.now();
    try{return await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['--max-old-space-size=256',join(root,'scripts/ocr-child.mjs'),engineDir,modelDir,language],{stdio:['pipe','pipe','pipe'],windowsHide:true,env:{PATH:process.env.PATH||'',SystemRoot:process.env.SystemRoot||'C:/Windows',TEMP:process.env.TEMP||'',NODE_NO_WARNINGS:'1'}});
      const parts=[];let total=0,done=false;const timer=setTimeout(()=>finish('OCR_TIMEOUT'),timeoutMs);
      function finish(code,result){if(done)return;done=true;clearTimeout(timer);if(code){child.kill();reject(Object.assign(new Error(code),{code}));}else resolve({...result,elapsedMs:Math.round(performance.now()-started)});}
      child.stdout.on('data',part=>{total+=part.length;if(total>160000)return finish('OCR_OUTPUT_TOO_LARGE');parts.push(part);});
      // Provider stderr is deliberately neither returned nor logged (may contain input or local paths).
      child.stderr.on('data',()=>{});child.on('error',()=>finish('OCR_FAILED'));
      child.on('close',code=>{if(code!==0)return finish('OCR_FAILED');try{const result=JSON.parse(Buffer.concat(parts).toString('utf8'));if(typeof result.text!=='string'||result.text.length>20000)throw new Error();finish(null,result);}catch{finish('OCR_FAILED');}});
      child.stdin.on('error',()=>finish('OCR_FAILED'));child.stdin.end(bytes);
    });}finally{busy=false;}
  }};
}
