"""Review-only by default. Removes only this task's profiles; retains all data/models."""
import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import argparse,json
from stage9_client import Client
p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');args=p.parse_args()
with Client() as client:
 current=client.request('/api/settings/catalog')['catalog']
 # Masked unrelated credentials are restored by the native catalog API.
 for service in ['llm','task','embedding']:
  entry=current['services'][service];removed='stage9-local-'+service
  entry['profiles']=[p for p in entry['profiles'] if p['id']!=removed]
  if entry.get('active_profile_id')==removed:entry['active_profile_id']=None;entry['active_model_id']=None
 if args.apply:
  client.request('/api/settings/catalog','PUT',{'catalog':current})
  stdin,stdout,stderr=client.ssh.exec_command('systemctl disable --now deeptutor-local-llm.service deeptutor-local-embedding.service',timeout=25);stdin.close();code=stdout.channel.recv_exit_status();assert code==0
 print(json.dumps({'applied':args.apply,'profilesToRemove':['stage9-local-llm','stage9-local-task','stage9-local-embedding'],'servicesToStop':['deeptutor-local-llm','deeptutor-local-embedding'],'dataDeleted':False,'websiteTouched':False}))
