// Private child-process protocol. Receives image bytes on stdin; never paths or URLs from a client.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {OCR_MODELS} from './ocr-models.mjs';
const [engineDir,modelDir,language,deadlineArg]=process.argv.slice(2);
// Independent watchdog also bounds work if the calling dev server disappears.
const deadlineMs=Math.min(45000,Math.max(25,Number(deadlineArg)||45000));
const watchdog=setTimeout(()=>process.exit(124),deadlineMs);
if(!['eng','chi_sim+eng'].includes(language))throw new Error('Invalid language');
const chunks=[];let size=0;
for await(const chunk of process.stdin){size+=chunk.length;if(size>2*1024*1024)throw new Error('Input too large');chunks.push(chunk);}
const {createWorker}=createRequire(import.meta.url)(join(engineDir,'src/index.js'));
for(const code of language.split('+')){const file=code+'.traineddata',data=await readFile(join(modelDir,file));if(createHash('sha256').update(data).digest('hex')!==OCR_MODELS[file].sha256)throw new Error('Model mismatch');}
process.env.OCR_ENGINE_DIR=engineDir;
let worker;
try{
  worker=await createWorker(language,1,{cacheMethod:'none',gzip:false,langPath:modelDir,workerPath:fileURLToPath(new URL('./ocr-worker-entry.cjs',import.meta.url)),logger:()=>{},errorHandler:()=>{}});
  await worker.setParameters({tessedit_pageseg_mode:'6',user_defined_dpi:'300',preserve_interword_spaces:'1'});
  const result=await worker.recognize(Buffer.concat(chunks),{},{text:true});
  const text=String(result.data.text||'');if(text.length>20000)throw new Error('Output too large');
  process.stdout.write(JSON.stringify({text,confidence:Number.isFinite(result.data.confidence)?result.data.confidence:null}));
}finally{if(worker)await worker.terminate();clearTimeout(watchdog);}
