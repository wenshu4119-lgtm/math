"""Runs on the server as root. Only the dedicated learning service is paused."""
import subprocess,json,os,hashlib
from pathlib import Path
from datetime import datetime,timezone
state=Path('/var/lib/learning-platform/operations');state.mkdir(parents=True,exist_ok=True)
result={'startedAt':datetime.now(timezone.utc).isoformat(),'success':False,'serviceResumed':False}
release_path=Path('/opt/learning-platform/current').resolve(strict=True)
if release_path.parent!=Path('/opt/learning-platform/releases'):
 raise RuntimeError('Unknown current release path')
release_version=release_path.name
try:
 subprocess.run(['systemctl','stop','learning-platform.service'],check=True,timeout=60)
 if subprocess.run(['systemctl','is-active','--quiet','learning-platform.service']).returncode==0:raise RuntimeError('Writers remain active')
 job=subprocess.run(['/opt/learning-platform/tools/node/bin/node','/opt/learning-platform/current/release/production-backup.mjs','encrypt','--data-dir','/var/lib/learning-platform/data','--backup-dir','/var/backups/learning-platform','--public-key','/etc/learning-platform/backup-public.pem','--version',release_version,'--writers-stopped','--retain-days','30'],capture_output=True,text=True,timeout=180)
 if job.returncode:raise RuntimeError('Encrypted backup failed')
 archive=json.loads(job.stdout.strip())
 package=Path(archive['file']).resolve();receipt=Path(archive['receipt']).resolve()
 if package.parent!=Path('/var/backups/learning-platform') or receipt!=Path(str(package)+'.receipt.json'):raise RuntimeError('Backup output path mismatch')
 meta=json.loads(receipt.read_text())
 digest=hashlib.sha256(package.read_bytes()).hexdigest()
 if digest!=archive['sha256']or digest!=meta['sha256']or not meta['fullPayloadVerifiedAtCreation']:raise RuntimeError('Backup verification receipt mismatch')
 result['archive']=package.name;result['sha256']=digest
 result['success']=True
finally:
 resumed=subprocess.run(['systemctl','start','learning-platform.service'],timeout=60)
 result['serviceResumed']=resumed.returncode==0;result['finishedAt']=datetime.now(timezone.utc).isoformat()
 target=state/'backup.json';target.write_text(json.dumps(result));os.chmod(target,0o640)
 subprocess.run(['chown','root:learningapp',str(target)],check=True)
 print(json.dumps(result))
 if not result['success']or not result['serviceResumed']:raise SystemExit(1)
