import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import json
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[2];out=root/'test-results/stage9';out.mkdir(exist_ok=True,parents=True)
with connect() as ssh,ssh.open_sftp() as sftp:
 key=sftp.open('/var/lib/deeptutor/local-models/inference.key').read().decode().strip()
 for name in ['config-smoke.json','service-verification.json','retrieval-generation.json','final-audit.json','index-evidence.json']:
  raw=sftp.open('/var/lib/deeptutor/local-models/'+name).read()
  if key.encode() in raw:raise RuntimeError('Refusing output containing protected inference credential')
  result=json.loads(raw);(out/name).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'downloadedEvidence':name,'bytes':len(raw)}))
