"""Creates only the new production service; does not switch DNS or the root Worker."""
import sys,json,hashlib,time
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1];base='/opt/learning-platform';version=base+'/releases/20261114-1';data='/var/lib/learning-platform';etc='/etc/learning-platform'
with connect()as client:
 def run(cmd,timeout=120):
  stdin,stdout,stderr=client.exec_command(cmd,timeout=timeout);stdin.close();out=stdout.read().decode();err=stderr.read().decode();code=stdout.channel.recv_exit_status()
  if code:raise RuntimeError('Production preparation failed: '+err[:200])
  return out
 run(f'test ! -e {base} && test ! -e {data} && test ! -e {etc}')
 run('useradd --system --no-create-home --home-dir /var/lib/learning-platform --shell /usr/sbin/nologin learningapp && useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin learningtunnel')
 run(f'mkdir -p {version}/src {version}/scripts {version}/migrations {version}/release {base}/tools {data}/data/papers {data}/operations {etc} /var/backups/learning-platform')
 files=list((root/'src').glob('*.mjs'))+list((root/'migrations').glob('*.sql'))+[root/'scripts/local-db.mjs']+[root/'release'/name for name in ['production-server.mjs','private-storage.mjs','production-backup.mjs','production-backup-runner.py','production-health.py']]
 manifest={}
 with client.open_sftp()as sftp:
  for p in files:
   relative=p.relative_to(root).as_posix();dest=version+'/'+relative;sftp.put(str(p),dest);sftp.chmod(dest,0o640);manifest[relative]=hashlib.sha256(p.read_bytes()).hexdigest()
  with sftp.file(version+'/source-manifest.json','w')as f:f.write(json.dumps(manifest))
  for source,dest,mode in [('.local/production/runtime.json',etc+'/runtime.json',0o640),('.local/production/tunnel.token',etc+'/tunnel.token',0o640),('.local/production/backup-public.pem',etc+'/backup-public.pem',0o644),('.local/production/learning.sqlite',data+'/data/learning.sqlite',0o600)]:sftp.put(str(root/source),dest);sftp.chmod(dest,mode)
  for p in(root/'release/production-units').iterdir():sftp.put(str(p),'/etc/systemd/system/'+p.name);sftp.chmod('/etc/systemd/system/'+p.name,0o644)
 run("python3 - <<'PY'\nimport json,hashlib\nfrom pathlib import Path\np=Path('"+version+"')\nm=json.loads((p/'source-manifest.json').read_text())\nfor name,digest in m.items():assert hashlib.sha256((p/name).read_bytes()).hexdigest()==digest\nPY")
 run(f'cp -a /opt/junior-learning-trial/tools/node-v24.22.1-linux-x64 {base}/tools/node && cp /opt/junior-learning-trial/tools/cloudflared-linux-amd64 {base}/tools/cloudflared && chmod 755 {base}/tools/cloudflared && ln -s releases/20261114-1 {base}/current')
 run(f'chown -R root:learningapp {version} && chmod 750 {version} {version}/src {version}/scripts {version}/migrations {version}/release && chown -R learningapp:learningapp {data}/data && chmod 700 {data}/data {data}/data/papers && chown root:learningapp {etc}/runtime.json && chown root:learningtunnel {etc}/tunnel.token && chmod 755 {etc} && chmod 700 /var/backups/learning-platform')
 run('systemctl daemon-reload && systemctl enable --now learning-platform.service learning-platform-tunnel.service')
 time.sleep(2)
 status=run('systemctl is-active learning-platform.service learning-platform-tunnel.service junior-learning-trial.service junior-learning-trial-tunnel.service deeptutor-backend.service deeptutor-frontend.service hostodo-proxy.service').splitlines()
 run('systemctl start learning-platform-backup.service',timeout=180)
 run('systemctl enable --now learning-platform-backup.timer learning-platform-health.timer')
 # Test the new API locally using the service credential, never output it.
 check=run("python3 - <<'PY'\nimport json,urllib.request,sqlite3\nfrom pathlib import Path\ncfg=json.loads(Path('/etc/learning-platform/runtime.json').read_text())\nr=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8792/api/v1/health',headers={'X-Trial-Bridge':cfg['BRIDGE_SECRET']}))\ndb=sqlite3.connect('file:/var/lib/learning-platform/data/learning.sqlite?mode=ro',uri=True)\nprint(json.dumps({'health':r.status,'users':db.execute('SELECT count(*) FROM users').fetchone()[0],'qaUsers':db.execute(\"SELECT count(*) FROM users WHERE username LIKE 'qa-%' OR username LIKE 'trial-%'\").fetchone()[0],'mustChangePassword':db.execute(\"SELECT must_change_password FROM users WHERE username='mrxu'\").fetchone()[0],'integrity':db.execute('PRAGMA integrity_check').fetchone()[0]}))\nPY")
 summary={'newServices':status[:2],'existingServices':status[2:],'sourceVersion':'20261114-1','runtime':json.loads(check),'rootDomainSwitched':False}
 (root/'release/production-server-preparation.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary))
