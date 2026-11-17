// Tesseract's Node worker uses global.fetch as its fetch adapter. Fail closed on network access.
global.fetch=async()=>{throw new Error('OCR_RUNTIME_NETWORK_DISABLED');};
const path=require('node:path');
if(!process.env.OCR_ENGINE_DIR)throw new Error('OCR_ENGINE_MISSING');
require(path.join(process.env.OCR_ENGINE_DIR,'src/worker-script/node/index.js'));
