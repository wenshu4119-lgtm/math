import {spawnSync} from 'node:child_process';import{mkdirSync,readFileSync,writeFileSync}from'node:fs';
const file=new URL('../.local/production/credentials.dpapi',import.meta.url);
const pwsh='C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
function run(code,input){const r=spawnSync(pwsh,['-NoProfile','-NonInteractive','-Command',code],{input,encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('Private credential protection failed');return r.stdout.trim();}
export function saveProductionSecrets(value){mkdirSync(new URL('../.local/production/',import.meta.url),{recursive:true});const encrypted=run('$raw=[Console]::In.ReadToEnd(); ConvertFrom-SecureString (ConvertTo-SecureString -String $raw -AsPlainText -Force)',JSON.stringify(value));writeFileSync(file,encrypted);}
export function readProductionSecrets(){return JSON.parse(run('$s=ConvertTo-SecureString ([Console]::In.ReadToEnd());$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}',readFileSync(file,'utf8')));}
