"""Read-only resource/config inventory; values containing credentials never leave VPS."""
import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import json
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
remote=r'''
import json,pathlib,subprocess,shutil,urllib.request
root=pathlib.Path('/var/lib/deeptutor/runtime');catalog=json.loads((root/'data/user/settings/model_catalog.json').read_text())
profiles={}
for service,item in catalog.get('services',{}).items():
 profiles[service]={'count':len(item.get('profiles',[])),'has_active_id':bool(item.get('active_profile_id'))}
mem=dict(line.split(':',1) for line in pathlib.Path('/proc/meminfo').read_text().splitlines())
cpu=pathlib.Path('/proc/cpuinfo').read_text()
out={'profiles':profiles,'memAvailableKiB':int(mem['MemAvailable'].split()[0]),'memTotalKiB':int(mem['MemTotal'].split()[0]),'cpuCount':cpu.count('processor\t:'),'avx2':'avx2' in cpu,'arch':subprocess.check_output(['uname','-m'],text=True).strip(),'diskFreeBytes':shutil.disk_usage('/opt').free,'pythonPaths':[str(p) for p in pathlib.Path('/opt/deeptutor').glob('*/bin/python')],'modelRequests':0}
out['services']={}
for name in ['deeptutor-backend','deeptutor-frontend','junior-learning-trial','junior-learning-trial-tunnel','hostodo-proxy']:
 p=subprocess.run(['systemctl','show',name,'--property=ActiveState,MemoryCurrent'],capture_output=True,text=True);out['services'][name]=dict(l.split('=',1) for l in p.stdout.splitlines() if '=' in l)
out['listeningPorts']=[l.split()[3] for l in subprocess.check_output(['ss','-lnt'],text=True).splitlines()[1:]]
out['existingModelRoot']=pathlib.Path('/opt/deeptutor-models').exists()
print(json.dumps(out))
'''
with connect() as client:
 stdin,stdout,stderr=client.exec_command('python3 -B -',timeout=30);stdin.write(remote);stdin.channel.shutdown_write();raw=stdout.read();code=stdout.channel.recv_exit_status()
 if code:raise SystemExit('Inventory failed; raw remote output withheld.')
 result=json.loads(raw)
out=Path(__file__).resolve().parents[2]/'test-results/stage9';out.mkdir(parents=True,exist_ok=True)
(out/'initial-inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
