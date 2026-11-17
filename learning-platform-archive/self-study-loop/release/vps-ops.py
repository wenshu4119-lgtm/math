import sys,json,hashlib,re
from datetime import datetime,timezone
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1]
action=sys.argv[1] if len(sys.argv)>1 else 'status'
if action not in ('status','backup','disable-qa'):raise SystemExit('Use status, backup, or disable-qa')
with connect() as client:
 def run(command):
  stdin,stdout,stderr=client.exec_command(command,timeout=90);stdin.close();out=stdout.read().decode();code=stdout.channel.recv_exit_status()
  if code:raise RuntimeError('Trial maintenance operation failed')
  return out
 status=run('systemctl is-active junior-learning-trial.service junior-learning-trial-tunnel.service deeptutor-backend.service deeptutor-frontend.service hostodo-proxy.service').splitlines()
 if action=='disable-qa':
  run("python3 - <<'PY'\nimport sqlite3\nc=sqlite3.connect('/opt/junior-learning-trial/data/learning.sqlite')\nc.execute(\"UPDATE users SET active=0 WHERE username LIKE 'qa-%'\")\nc.execute(\"DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'qa-%')\")\nc.commit()\nc.close()\nPY")
 if action=='backup':
  stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
  remote_backup=f'/opt/junior-learning-trial/data/backup-{stamp}.sqlite'
  run("python3 - <<'PY'\nimport sqlite3,os\np='/opt/junior-learning-trial/data/learning.sqlite'\nb="+repr(remote_backup)+"\nassert not os.path.exists(b)\ns=sqlite3.connect(p);d=sqlite3.connect(b);s.backup(d);assert d.execute('PRAGMA integrity_check').fetchone()[0]=='ok';s.close();d.close();os.chmod(b,0o600)\nPY")
  local=root/f'.local/backups/trial-{stamp}.sqlite';local.parent.mkdir(exist_ok=True)
  with client.open_sftp()as sftp:sftp.get(remote_backup,str(local))
  print(json.dumps({'backupSaved':True,'sha256':hashlib.sha256(local.read_bytes()).hexdigest()}))
 log=run('journalctl -u junior-learning-trial-tunnel.service --no-pager -n 100 -o cat')
 urls=re.findall(r'https://[a-z0-9-]+\.trycloudflare\.com',log)
 counts=json.loads(run("python3 - <<'PY'\nimport sqlite3,json\nc=sqlite3.connect('file:/opt/junior-learning-trial/data/learning.sqlite?mode=ro',uri=True)\nprint(json.dumps({'qaActive':c.execute(\"SELECT count(*) FROM users WHERE username LIKE 'qa-%' AND active=1\").fetchone()[0],'trialAttempts':c.execute(\"SELECT count(*) FROM attempts WHERE student_id IN (SELECT id FROM users WHERE username LIKE 'trial-%')\").fetchone()[0],'trialReviews':c.execute(\"SELECT count(*) FROM content_reviews WHERE reviewed_by IN (SELECT id FROM users WHERE username LIKE 'trial-%')\").fetchone()[0],'integrity':c.execute('PRAGMA integrity_check').fetchone()[0]}))\nPY"))
 result={'services':status,'counts':counts,'backendOrigin':urls[-1]if urls else None}
 (root/'.local/vps/current-status.json').write_text(json.dumps(result,indent=2))
 print(json.dumps({'servicesActive':all(x=='active'for x in status),'counts':counts}))
