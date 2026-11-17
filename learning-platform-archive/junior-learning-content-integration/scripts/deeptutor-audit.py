"""Read-only inspection via existing pinned SSH; never emits credential values."""
import sys
sys.dont_write_bytecode = True
sys.stdout.reconfigure(encoding='utf-8')
import json
from pathlib import Path
sys.path.insert(0, 'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect

REMOTE = r'''
import json,pathlib,subprocess,urllib.request,urllib.error,hashlib,shutil
root=pathlib.Path('/var/lib/deeptutor/runtime')
catalog=json.loads((root/'data/user/settings/model_catalog.json').read_text())
out={'readOnly':True,'modelCalls':0,'services':{},'profiles':{},'anonymousEndpoints':{}}
for name in ['deeptutor-local-llm','deeptutor-local-embedding','deeptutor-backend','deeptutor-frontend','learning-platform','learning-production','junior-learning-trial','junior-learning-trial-tunnel','hostodo-proxy']:
 p=subprocess.run(['systemctl','show',name,'--property=ActiveState,MemoryCurrent,MemoryPeak,NRestarts,User,CPUQuotaPerSecUSec,MemoryMax'],capture_output=True,text=True)
 out['services'][name]=dict(l.split('=',1) for l in p.stdout.splitlines() if '=' in l)
for name in ['llm','task','embedding']:
 entry=catalog['services'][name];p=next(p for p in entry['profiles'] if p['id']==entry['active_profile_id'])
 out['profiles'][name]={'profileId':p['id'],'apiFormat':p.get('api_format'),'models':[m['model'] for m in p['models']],'localOnly':p['base_url'].startswith('http://127.0.0.1:'),'credentialPresent':bool(p.get('api_key'))}
out['listeners']=[l.split()[3] for l in subprocess.check_output(['ss','-lnt'],text=True).splitlines()[1:]]
mem=dict(l.split(':',1) for l in pathlib.Path('/proc/meminfo').read_text().splitlines())
out['resources']={'memAvailableKiB':int(mem['MemAvailable'].split()[0]),'memTotalKiB':int(mem['MemTotal'].split()[0]),'diskFreeBytes':shutil.disk_usage('/opt').free,'cpuCount':pathlib.Path('/proc/cpuinfo').read_text().count('processor\t:')}
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
for name,url in [('llm','http://127.0.0.1:18081/v1/models'),('embedding','http://127.0.0.1:18082/v1/models'),('knowledgeBases','http://127.0.0.1:8001/api/knowledge-bases'),('ready','http://127.0.0.1:8001/health/ready'),('production','http://127.0.0.1:8792/api/v1/health')]:
 try:
  with opener.open(url,timeout=10) as r:out['anonymousEndpoints'][name]={'status':r.status}
 except urllib.error.HTTPError as e:out['anonymousEndpoints'][name]={'status':e.code}
 except Exception:out['anonymousEndpoints'][name]={'status':'unavailable'}
out['catalogSha256']=hashlib.sha256((root/'data/user/settings/model_catalog.json').read_bytes()).hexdigest()
print(json.dumps(out))
'''
with connect() as client:
 stdin,stdout,stderr=client.exec_command('python3 -B -',timeout=60)
 stdin.write(REMOTE);stdin.channel.shutdown_write()
 raw=stdout.read();code=stdout.channel.recv_exit_status()
 if code:raise SystemExit('Read-only inspection failed; raw errors withheld.')
 result=json.loads(raw)
target=Path(__file__).resolve().parents[1]/'test-results/deeptutor'
target.mkdir(parents=True,exist_ok=True)
(target/'live-inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
