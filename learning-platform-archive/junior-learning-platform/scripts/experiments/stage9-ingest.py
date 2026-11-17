import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import json,time,uuid,hashlib,urllib.parse
from pathlib import Path
from stage9_client import Client
root=Path(__file__).resolve().parents[2];folder=Path(__file__).with_name('stage9')/'sources';name='stage9-synthetic-20261114'
files=[folder/'stage9_math.txt',folder/'stage9_english.txt'];out=root/'test-results/stage9';out.mkdir(exist_ok=True,parents=True)
with Client() as client:
 existing=client.request('/api/knowledge-bases')
 # Only the task's fixed KB may be resumed, never an unrelated resource.
 existing_text=json.dumps(existing)
 if name not in existing_text:
  boundary='Stage9Boundary'+uuid.uuid4().hex;parts=[]
  for key,value in [('name',name),('rag_provider','llamaindex')]:parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
  for file in files:parts.extend([f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="{file.name}"\r\nContent-Type: text/plain\r\n\r\n'.encode(),file.read_bytes(),b'\r\n'])
  parts.append(f'--{boundary}--\r\n'.encode());created=client.request('/api/knowledge-bases','POST',b''.join(parts),'multipart/form-data; boundary='+boundary)
  print(json.dumps({'created':True,'taskId':created.get('task_id'),'fileCount':2}),flush=True)
 start=time.monotonic();states=[]
 for i in range(90):
  p=client.request('/api/knowledge-bases/'+name+'/progress');stage=p.get('stage') or p.get('progress',{}).get('stage');status=p.get('status');percent=p.get('percent',p.get('progress',{}).get('percent'))
  safe={'stage':stage,'status':status,'percent':percent}
  if not states or states[-1]!=safe:states.append(safe);print(json.dumps(safe),flush=True)
  if stage in ['completed','complete','done'] or status in ['ready','completed']:break
  if stage in ['failed','error'] or status in ['failed','error']:raise RuntimeError('Indexing failed; inspect sanitized task state')
  time.sleep(2)
 else:raise RuntimeError('Indexing has not completed within this probe window')
 detail=client.request('/api/knowledge-bases/'+name)
 report={'kbName':name,'provider':'llamaindex','sourceFiles':[{'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in files],'states':states,'seconds':round(time.monotonic()-start,2),'detailKeys':list(detail.keys()),'syntheticOnly':True,'humanReviewed':False}
 (out/'ingestion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
