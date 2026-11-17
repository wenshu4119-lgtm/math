import sys,json,hashlib
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1];base='/opt/junior-learning-trial';target=base+'/versions/stage8'
if len(sys.argv)!=2 or sys.argv[1]not in('--stage','--activate','--rollback'):raise SystemExit('Choose --stage, --activate, --rollback')
if sys.argv[1]=='--activate' and not json.loads((root/'release/production-gates.json').read_text())['uploadPermissionRaceResolved']:
 raise SystemExit('Activation blocked: receive and verify the upload authorization fix first. No remote change.')
with connect()as client:
 def run(cmd):
  stdin,stdout,stderr=client.exec_command(cmd,timeout=90);stdin.close();out=stdout.read().decode();err=stderr.read().decode();code=stdout.channel.recv_exit_status()
  if code:raise RuntimeError('Trial upgrade failed: '+err[:200])
  return out
 if sys.argv[1]=='--stage':
  run(f'test ! -e {target} && mkdir -p {target}/src {target}/migrations {target}/scripts {target}/release && ln -s {base}/data {target}/data && ln -s {base}/private {target}/private')
  files=list((root/'src').glob('*.mjs'))+list((root/'migrations').glob('*.sql'))+[root/'scripts/local-db.mjs',root/'release/vps-server.mjs',root/'release/private-storage.mjs']
  with client.open_sftp()as sftp:
   for p in files:
    relative=p.relative_to(root).as_posix();remote=target+'/'+relative;sftp.put(str(p),remote);sftp.chmod(remote,0o640)
    if run('sha256sum '+remote).split()[0]!=hashlib.sha256(p.read_bytes()).hexdigest():raise RuntimeError('Upload checksum mismatch')
  run(f'chown -R root:jltrial {target}/src {target}/migrations {target}/scripts {target}/release && chmod 750 {target}/src {target}/migrations {target}/scripts {target}/release')
  run(f'{base}/tools/node/bin/node --check {target}/release/vps-server.mjs')
  print('Versioned stage8 source staged and verified; running service unchanged.')
 else:
  unit='/etc/systemd/system/junior-learning-trial.service'
  if sys.argv[1]=='--activate':
   run(f'test -e {target}/migrations/0005_isolated_drafts.sql && cp -n {unit} {base}/stage7-service.backup && systemctl stop junior-learning-trial.service')
   # Only additive migration, run as the database owner; never replace the database.
   command=f"import{{openDatabase,migrate}}from'{target}/scripts/local-db.mjs';const db=openDatabase('{base}/data/learning.sqlite');migrate(db);db.sqlite.close();"
   import shlex
   try:
    run('runuser -u jltrial -- '+base+'/tools/node/bin/node --input-type=module -e '+shlex.quote(command))
    with client.open_sftp()as sftp:
     with sftp.file(unit,'r')as f:text=f.read().decode()
     text=text.replace(base+'/release/vps-server.mjs',target+'/release/vps-server.mjs')
     with sftp.file(unit,'w')as f:f.write(text)
    run('systemctl daemon-reload && systemctl start junior-learning-trial.service')
   except:
    run(f'cp {base}/stage7-service.backup {unit} && systemctl daemon-reload && systemctl start junior-learning-trial.service');raise
  else:run(f'test -e {base}/stage7-service.backup && cp {base}/stage7-service.backup {unit} && systemctl daemon-reload && systemctl restart junior-learning-trial.service')
  print(run('systemctl is-active junior-learning-trial.service junior-learning-trial-tunnel.service deeptutor-backend.service deeptutor-frontend.service hostodo-proxy.service'))
