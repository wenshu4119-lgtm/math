"""Inspect literal installed metadata without importing the installed packages."""
import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import json
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
remote=r'''
import pathlib,json,hashlib,email
out=[]
for site in pathlib.Path('/opt/deeptutor/venv/lib').glob('python*/site-packages'):
 for p in site.glob('*.dist-info'):
  if not any(p.name.lower().startswith(n) for n in ['deeptutor','pymupdf','fitz']):continue
  meta=p/'METADATA'
  if not meta.exists():continue
  data=meta.read_bytes();msg=email.message_from_bytes(data)
  record={'directory':str(p),'metadataSha256':hashlib.sha256(data).hexdigest(),'name':msg.get('Name'),'version':msg.get('Version'),'license':msg.get('License'),'licenseExpression':msg.get('License-Expression'),'licenseFiles':msg.get_all('License-File'),'metadataBytes':len(data),'files':[x.name for x in p.iterdir() if x.is_file()]}
  direct=p/'direct_url.json'
  if direct.exists():
   d=json.loads(direct.read_text());record['vcsCommit']=d.get('vcs_info',{}).get('commit_id');record['editable']=d.get('dir_info',{}).get('editable')
  out.append(record)
print(json.dumps({'installedMetadata':out}))
'''
with connect() as client:
 stdin,stdout,stderr=client.exec_command('python3 -B -',timeout=30);stdin.write(remote);stdin.channel.shutdown_write();raw=stdout.read();status=stdout.channel.recv_exit_status()
 if status:raise SystemExit('Metadata read failed; raw output withheld.')
 result=json.loads(raw)
 dest=Path(__file__).resolve().parents[1]/'docs/licenses/deeptutor-selected/metadata-check.json'
 dest.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(result,ensure_ascii=False))
