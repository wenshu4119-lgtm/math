import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['C:/Users/Administrator/Desktop/junior-learning-platform/node_modules/wrangler/bin/wrangler.js','tail','junior-learning-trial-20261114','--format=json'],{windowsHide:true});
let buffer='';
child.stdout.on('data',data=>{buffer+=data;const end=buffer.indexOf('\n}\n');if(end<0)return;const start=buffer.indexOf('{');const raw=buffer.slice(start,end+2);buffer=buffer.slice(end+3);try{const d=JSON.parse(raw);console.log(JSON.stringify({outcome:d.outcome,cpuTime:d.cpuTime,wallTime:d.wallTime,exceptions:d.exceptions?.map(x=>({name:x.name,message:x.message})),timestamp:d.eventTimestamp}));}catch{}});
child.stderr.on('data',()=>{});setTimeout(()=>child.kill(),55000);child.on('exit',()=>process.exit(0));
