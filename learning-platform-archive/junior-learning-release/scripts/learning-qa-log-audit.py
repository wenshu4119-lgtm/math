"""Read-only, redacted model-log check for known synthetic evaluation phrases."""
import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import json
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
remote=r'''
import pathlib,json,subprocess
queries=['为什么等式两边同时除以同一个数时','解方程 3x + 4 = 19','计算 3 + 4 * 2','She ___ a student','How do I form a negative sentence']
key=pathlib.Path('/var/lib/deeptutor/local-models/inference.key').read_text().strip()
out={'readOnly':True,'rawLogsReturned':False,'services':{}}
for unit in ['deeptutor-local-llm.service','deeptutor-local-embedding.service','deeptutor-learning-lab.service']:
 p=subprocess.run(['journalctl','-u',unit,'--since','2 hours ago','--no-pager','-o','cat'],capture_output=True,text=True)
 text=p.stdout
 out['services'][unit]={'logBytes':len(text.encode()),'knownSyntheticQuestionMatches':sum(text.count(q) for q in queries),'inferenceCredentialOccurrences':text.count(key) if key else 0}
files=list(pathlib.Path('/var/lib/deeptutor/runtime').glob('logs/**/*.log'))[:50]
out['runtimeLogFilesChecked']=len(files);out['runtimeKnownQuestionMatches']=0
for p in files:
 if p.is_file():
  with p.open('rb') as f:
   f.seek(max(0,p.stat().st_size-1000000));text=f.read().decode(errors='replace')
  out['runtimeKnownQuestionMatches']+=sum(text.count(q) for q in queries)
print(json.dumps(out))
'''
with connect() as client:
 stdin,stdout,stderr=client.exec_command('python3 -B -',timeout=45);stdin.write(remote);stdin.channel.shutdown_write();raw=stdout.read();status=stdout.channel.recv_exit_status()
 if status:raise SystemExit('Redacted log check failed; raw logs withheld.')
 result=json.loads(raw);target=Path(__file__).resolve().parents[1]/'test-results/learning-qa/log-audit.json';target.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
