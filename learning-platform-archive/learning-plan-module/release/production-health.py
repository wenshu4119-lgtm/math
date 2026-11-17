"""Credential-free output; health failures remain visible to systemd/journal."""
import json,urllib.request,subprocess,os
from pathlib import Path
from datetime import datetime,timezone
cfg=json.loads(Path('/etc/learning-platform/runtime.json').read_text());state=Path('/var/lib/learning-platform/operations');state.mkdir(exist_ok=True)
checks={}
for name,url,headers in [('backend','http://127.0.0.1:8792/api/v1/health',{'X-Trial-Bridge':cfg['BRIDGE_SECRET']}),('namedOrigin','https://earning-origin.mrxu.uk/api/v1/health',{'X-Trial-Bridge':cfg['BRIDGE_SECRET']})]:
 try:
  headers={**headers,'User-Agent':'LearningPlanningHealth/1.0 (+https://mrxu.uk/privacy.html)','Accept':'application/json'}
  with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=12)as r:checks[name]=r.status==200
 except Exception:checks[name]=False
checks['backupFresh']=False
try:
 b=json.loads((state/'backup.json').read_text());checks['backupFresh']=bool(b['success']and b['serviceResumed']and(datetime.now(timezone.utc)-datetime.fromisoformat(b['finishedAt'])).total_seconds()<36*3600)
except Exception:pass
result={'checkedAt':datetime.now(timezone.utc).isoformat(),'healthy':all(checks.values()),'checks':checks}
target=state/'health.json';target.write_text(json.dumps(result));os.chmod(target,0o640);subprocess.run(['chown','root:learningapp',str(target)],check=True);print(json.dumps(result))
raise SystemExit(0 if result['healthy']else 1)
