"""Read installed license metadata and copy explicit upstream license texts only."""
import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import json,hashlib
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
remote=r'''
import importlib.metadata as m,json,pathlib,hashlib,os
out={'packages':[],'licenseFiles':[]}
for name in ['deeptutor','PyMuPDF','llama-index-core','llama-index-embeddings-openai','llama-index-llms-openai','fastapi','pydantic','torch','transformers']:
 try:
  d=m.distribution(name);meta=d.metadata
  out['packages'].append({'name':name,'version':d.version,'license':meta.get('License'),'licenseExpression':meta.get('License-Expression'),'classifiers':[v for v in meta.get_all('Classifier',[]) if v.startswith('License')]})
  if name in ['deeptutor','PyMuPDF']:
   for file in d.files or []:
    if ('license' in str(file).lower() or 'notice' in str(file).lower() or str(file).endswith('COPYING')) and str(file).endswith(('.txt','.md','LICENSE','NOTICE','COPYING')):
     p=pathlib.Path(d.locate_file(file))
     if p.is_file() and p.stat().st_size<150000:
      data=p.read_bytes();out['licenseFiles'].append({'path':str(p),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 except m.PackageNotFoundError:out['packages'].append({'name':name,'installed':False})
for root in ['/opt/deeptutor-models','/var/lib/deeptutor/local-models','/opt/deeptutor']:
 for parent,dirs,files in os.walk(root):
  dirs[:]=[d for d in dirs if d not in ['venv','node_modules','.git','.next','__pycache__']]
  for name in files:
   p=pathlib.Path(parent)/name
   if not p.is_file() or p.stat().st_size>150000:continue
   if p.name.lower() in ['license','license.txt','license.md','notice','notice.txt','copyright'] or ('license' in p.name.lower() and p.suffix in ['.txt','.md']):
    data=p.read_bytes();out['licenseFiles'].append({'path':str(p),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
for name in ['Qwen-embedding-model-card.md','Qwen-generation-model-card.md','manifest.json']:
 p=pathlib.Path('/opt/deeptutor-models/licenses')/name
 if p.is_file():
  data=p.read_bytes();out['licenseFiles'].append({'path':str(p),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
p=pathlib.Path('/opt/deeptutor-models/runtime-library/extracted/usr/share/doc/libgomp1/copyright')
out['gccRuntimeCopyright']={'path':str(p),'isFile':p.is_file(),'isSymlink':p.is_symlink()}
print(json.dumps(out))
'''
with connect() as client:
 stdin,stdout,stderr=client.exec_command('/opt/deeptutor/venv/bin/python -B -',timeout=60)
 stdin.write(remote);stdin.channel.shutdown_write();raw=stdout.read();status=stdout.channel.recv_exit_status()
 if status:raise SystemExit('License inventory failed; raw output withheld.')
 result=json.loads(raw)
 folder=Path(__file__).resolve().parents[1]/'docs/licenses/deeptutor-selected'
 folder.mkdir(parents=True,exist_ok=True)
 with client.open_sftp() as sftp:
  for i,item in enumerate(result['licenseFiles']):
   target=folder/f'{i+1:02d}-{Path(item["path"]).name}'
   sftp.get(item['path'],str(target))
   if hashlib.sha256(target.read_bytes()).hexdigest()!=item['sha256']:raise SystemExit('License copy hash mismatch')
   item['localPath']=str(target.relative_to(folder.parent.parent))
 (folder/'inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(result,ensure_ascii=False))
