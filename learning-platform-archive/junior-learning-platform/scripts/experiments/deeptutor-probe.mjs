// Real HTTP/module probe, separate from the platform runtime and all student data.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('./deeptutor-module-probe.py',import.meta.url));
const allowed=process.argv.slice(2);
if(allowed.some(arg=>arg!=='--fetch'))throw new Error('Only --fetch is supported');
const child=spawn(process.env.DEEPTUTOR_PROBE_PYTHON||'python',[script,...allowed],{stdio:'inherit',windowsHide:true});
const timer=setTimeout(()=>{child.kill();process.exitCode=1;},180000);
child.once('error',error=>{clearTimeout(timer);console.error(`Cannot run Python: ${error.code}`);process.exitCode=1;});
child.once('exit',code=>{clearTimeout(timer);process.exitCode=code??1;});
