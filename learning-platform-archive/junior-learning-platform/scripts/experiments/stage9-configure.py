"""Back up catalog and apply only three local profiles through authenticated API."""
import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import json,hashlib
from pathlib import Path
from stage9_client import Client
root=Path(__file__).resolve().parents[2]
with Client() as client:
 with client.ssh.open_sftp() as sftp:
  catalog_path='/var/lib/deeptutor/runtime/data/user/settings/model_catalog.json';private='/var/lib/deeptutor/local-models/'
  raw=sftp.open(catalog_path,'rb').read();before=json.loads(raw)
  backup=private+'model_catalog.before-stage9.json'
  try:sftp.stat(backup)
  except FileNotFoundError:
   with sftp.open(backup,'wb') as f:f.write(raw)
   sftp.chmod(backup,0o600);stat=sftp.stat(catalog_path);sftp.chown(backup,stat.st_uid,stat.st_gid)
  key=sftp.open(private+'inference.key').read().decode().strip()
 for service,port,model in [('llm',18081,'stage9-qwen3-0.6b'),('task',18081,'stage9-qwen3-0.6b'),('embedding',18082,'stage9-qwen3-embedding-0.6b')]:
  profile_id='stage9-local-'+service;model_id=profile_id+'-model'
  current=client.request('/api/settings/catalog')['catalog']['services'][service]
  if any(p['id']!=profile_id for p in current.get('profiles',[])):raise RuntimeError('Other profiles appeared; preserving them and stopping activation')
  item={'id':model_id,'name':model+' · 小范围合成验证','model':model}
  if service=='embedding':item.update({'dimension':1024,'supported_dimensions':'1024','request_timeout':180,'batch_size':1})
  else:item.update({'context_window':2048,'capabilities':{'tools':False,'vision':False,'json_output':True,'reasoning':False}})
  profile={'id':profile_id,'name':'Stage9 自托管免费 '+service,'binding':'openai','api_format':'openai_chat','wire_api':'chat_completions','base_url':f'http://127.0.0.1:{port}/v1'+('/embeddings' if service=='embedding' else ''),'api_key':key,'models':[item],'extra_headers':{}}
  client.request('/api/settings/apply/provider','POST',{'service':service,'profile':profile,'active_model_id':model_id,'activate':True})
  print(json.dumps({'service':service,'profileApplied':True,'externalPaidAPI':False}),flush=True)
 after=client.request('/api/settings/catalog')['catalog'];report={'beforeSha256':hashlib.sha256(raw).hexdigest(),'backup':'DeepTutor private local-models directory','profiles':{k:{'count':len(v.get('profiles',[])),'active':v.get('active_profile_id'),'modelIds':[m['model'] for p in v.get('profiles',[]) for m in p.get('models',[])]} for k,v in after['services'].items()},'apiKeyValuesExported':False}
 out=root/'test-results/stage9';out.mkdir(exist_ok=True,parents=True);(out/'configuration.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
