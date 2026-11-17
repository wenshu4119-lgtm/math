import sys,json,hashlib
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1];action=sys.argv[1]if len(sys.argv)>1 else'status'
if action not in('status','fetch-backups','run-backup'):raise SystemExit('Choose status, fetch-backups, run-backup')
with connect()as client:
 def run(cmd,timeout=90):
  stdin,stdout,stderr=client.exec_command(cmd,timeout=timeout);stdin.close();out=stdout.read().decode();code=stdout.channel.recv_exit_status()
  if code:raise RuntimeError('Production operation failed; inspect dedicated service journal')
  return out
 if action=='run-backup':run('systemctl start learning-platform-backup.service',240)
 if action in('fetch-backups','run-backup'):
  dest=root/'.local/production/backups';dest.mkdir(parents=True,exist_ok=True);downloaded=[]
  with client.open_sftp()as sftp:
   names=sftp.listdir('/var/backups/learning-platform')
   for name in names:
    if '/'in name or '\\'in name or not(name.endswith('.lpbak')or name.endswith('.receipt.json')):continue
    target=dest/name
    if not target.exists():sftp.get('/var/backups/learning-platform/'+name,str(target))
    downloaded.append({'name':name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size})
  (root/'.local/production/backup-downloads.json').write_text(json.dumps(downloaded,indent=2));print(json.dumps({'downloadedEncryptedFiles':len(downloaded)}))
 safe=run("python3 - <<'PY'\nimport json,subprocess\nfrom pathlib import Path\nr={}\nfor name in ['backup','health']:\n p=Path('/var/lib/learning-platform/operations/'+name+'.json')\n r[name]=json.loads(p.read_text()) if p.exists() else None\nr['timers']=subprocess.check_output(['systemctl','is-enabled','learning-platform-backup.timer','learning-platform-health.timer'],text=True).splitlines()\nr['services']=subprocess.check_output(['systemctl','is-active','learning-platform.service','learning-platform-tunnel.service','junior-learning-trial.service','junior-learning-trial-tunnel.service','deeptutor-backend.service','deeptutor-frontend.service','hostodo-proxy.service'],text=True).splitlines()\nprint(json.dumps(r))\nPY")
 (root/'release/production-operations-status.json').write_text(safe);print(safe)
