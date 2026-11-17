"""Real local-model regression with original, isolated samples; no learner data."""
import sys
sys.dont_write_bytecode = True
sys.stdout.reconfigure(encoding='utf-8')
import hashlib
import json
import time
import uuid
from pathlib import Path
sys.path.insert(0, 'C:/Users/Administrator/Desktop/junior-learning-platform/scripts/experiments')
from stage9_client import Client
root = Path(__file__).resolve().parents[1]
source = Path('C:/Users/Administrator/Desktop/junior-learning-platform/scripts/experiments/stage9/sources')
target = root/'test-results/deeptutor'
target.mkdir(parents=True, exist_ok=True)
name = 'learning-lab-synthetic-20261114'
files = [source/'stage9_math.txt', source/'stage9_english.txt']
with Client() as client:
 existing = client.request('/api/knowledge-bases')
 created = False
 if name not in json.dumps(existing):
  boundary = 'LearningLab'+uuid.uuid4().hex
  parts = []
  for key, value in [('name', name), ('rag_provider', 'llamaindex')]:
   parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
  for file in files:
   parts.extend([f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="{file.name}"\r\nContent-Type: text/plain\r\n\r\n'.encode(),file.read_bytes(),b'\r\n'])
  parts.append(f'--{boundary}--\r\n'.encode())
  client.request('/api/knowledge-bases','POST',b''.join(parts),'multipart/form-data; boundary='+boundary)
  created = True
  print(json.dumps({'stage':'ingestion','created':True,'fileCount':2}),flush=True)
 start = time.monotonic()
 for i in range(90):
  p = client.request('/api/knowledge-bases/'+name+'/progress')
  state = p.get('stage') or p.get('progress',{}).get('stage') or p.get('status')
  if state in ['completed','complete','done','ready']:
   break
  if state in ['failed','error']:
   raise SystemExit('Original sample ingestion failed; no mock results.')
  time.sleep(2)
 else:
  raise SystemExit('Original sample ingestion timed out; no mock results.')
 ingestion = {'kbName':name,'created':created,'state':state,'seconds':round(time.monotonic()-start,2),'files':[{'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in files],'syntheticOnly':True}
 (target/'ingestion.json').write_text(json.dumps(ingestion,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(ingestion),flush=True)
 code = (root/'integrations/deeptutor-lab/bridge.py').read_text(encoding='utf-8')
 remote = "namespace={'__name__':'learning_lab_test'}\nexec("+repr(code)+",namespace)\n"+r'''
import asyncio,json,math,time,os
os.chdir('/var/lib/deeptutor/runtime')
async def check():
 from deeptutor.services.embedding import get_embedding_client
 namespace['check_local_configuration']()
 start=time.monotonic()
 vectors=await get_embedding_client().embed(['原创实验：x + 2 = 5，解为3。','Original laboratory: She is a student.'])
 assert len(vectors)==2 and all(len(v)==1024 and all(math.isfinite(x) for x in v) for v in vectors)
 print(json.dumps({'stage':'embedding','vectors':2,'dimensions':1024,'seconds':round(time.monotonic()-start,2),'realExecution':True}),flush=True)
 for preset in ['math-equation','english-be','outside-scope']:
  result=await namespace['run_preset'](preset)
  print(json.dumps({'stage':'preset','result':result},ensure_ascii=False),flush=True)
 assert namespace['validate_answer']('{"answer":"am","explanation":"She uses is."}','english-be') is False
 print(json.dumps({'stage':'regression','wrongEnglishAnswerBlocked':True,'mockModelResults':False,'externalPaidCalls':0}),flush=True)
asyncio.run(check())
'''
 command='runuser -u deeptutor -- env PYTHONDONTWRITEBYTECODE=1 DEEPTUTOR_HOME=/var/lib/deeptutor/runtime DEEPTUTOR_WORKSPACE_ROOT=/var/lib/deeptutor/runtime/content /opt/deeptutor/venv/bin/python -u -B -'
 stdin,stdout,stderr=client.ssh.exec_command(command,timeout=600)
 stdin.write(remote);stdin.channel.shutdown_write()
 evidence=[]
 for line in stdout:
  try:
   row=json.loads(line)
  except Exception:
   continue
  evidence.append(row)
  print(json.dumps(row,ensure_ascii=False),flush=True)
 exit_code=stdout.channel.recv_exit_status()
 (target/'live-regression.json').write_text(json.dumps({'exitCode':exit_code,'events':evidence},ensure_ascii=False,indent=2),encoding='utf-8')
 if exit_code:
  raise SystemExit('Real DeepTutor regression failed; raw config/errors withheld.')
