import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const path=new URL('../.local/trial-credentials.dpapi',import.meta.url);
const powershell='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
function run(code,input){const r=spawnSync(powershell,['-NoProfile','-NonInteractive','-Command',code],{input,encoding:'utf8',windowsHide:true});if(r.status!==0)throw new Error('Windows credential protection operation failed');return r.stdout.trim();}
export function saveSecrets(value){mkdirSync(new URL('../.local/',import.meta.url),{recursive:true});writeFileSync(path,run('$raw=[Console]::In.ReadToEnd(); $secure=ConvertTo-SecureString -String $raw -AsPlainText -Force; ConvertFrom-SecureString $secure',JSON.stringify(value)),{flag:'wx'});}
export function readSecrets(){return JSON.parse(run('$raw=[Console]::In.ReadToEnd(); $secure=ConvertTo-SecureString $raw; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }',readFileSync(path,'utf8')));}
