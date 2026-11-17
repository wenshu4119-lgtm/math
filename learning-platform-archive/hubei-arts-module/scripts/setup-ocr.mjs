import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {root} from './environment.mjs';
import {OCR_MODELS,OCR_MODEL_REVISION} from './ocr-models.mjs';
const folder=join(root,'.local/ocr-models');await mkdir(folder,{recursive:true});const results=[];
for(const [name,expected]of Object.entries(OCR_MODELS)){
  const path=join(folder,name);let bytes;
  try{bytes=await readFile(path);}catch(e){if(e.code!=='ENOENT')throw e;if(!process.argv.includes('--download-models'))throw new Error(`Missing ${name}; use --download-models to fetch fixed public language files.`);const response=await fetch(`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${OCR_MODEL_REVISION}/${name}`,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error(`Model download failed: ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==expected.bytes||createHash('sha256').update(bytes).digest('hex')!==expected.sha256)throw new Error('Model integrity verification failed');await writeFile(path,bytes,{flag:'wx'});}
  if(bytes.length!==expected.bytes||createHash('sha256').update(bytes).digest('hex')!==expected.sha256)throw new Error(`Existing model differs: ${name}; preserved without replacement.`);
  results.push({file:name,...expected});
}
await writeFile(join(folder,'manifest.json'),JSON.stringify({provider:'tessdata_fast',revision:OCR_MODEL_REVISION,license:'Apache-2.0',files:results},null,2));console.log('OCR language files verified. No runtime network downloads; no student images were sent anywhere.');
