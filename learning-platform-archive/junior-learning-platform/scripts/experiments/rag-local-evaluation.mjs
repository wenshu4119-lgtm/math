// Isolated, model-free retrieval evidence. Does not modify platform data or config.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const bundled='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const python=process.env.RAG_PROBE_PYTHON||(existsSync(bundled)?bundled:'python');
const args=process.argv.slice(2);if(args.some(arg=>arg!=='--fetch'))throw new Error('Only --fetch is supported');
const child=spawn(python,[fileURLToPath(new URL('./rag-local-evaluation.py',import.meta.url)),...args],{stdio:'inherit',windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
const timer=setTimeout(()=>{child.kill();process.exitCode=1;},60000);
child.once('error',error=>{clearTimeout(timer);console.error(`Cannot start isolated retrieval probe: ${error.code}`);process.exitCode=1;});
child.once('exit',code=>{clearTimeout(timer);process.exitCode=code??1;});
