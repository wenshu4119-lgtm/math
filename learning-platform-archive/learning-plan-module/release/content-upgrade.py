"""Versioned, additive content release. Never resets accounts or replaces live data."""
import sys,json,hashlib,shlex,time
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1]
base='/opt/learning-platform'
target=base+'/releases/20261114-content-1'
prior=base+'/releases/20261114-1'
action=sys.argv[1] if len(sys.argv)>1 else '--plan'
if action not in ['--plan','--stage','--activate','--rollback']:raise SystemExit('Choose --plan, --stage, --activate, --rollback')
files=list((root/'src').glob('*.mjs'))+list((root/'migrations').glob('*.sql'))
files += [root/p for p in ['scripts/local-db.mjs','scripts/import-question-bank.mjs','scripts/environment.mjs','scripts/deeptutor-deployed-smoke.mjs','release/production-server.mjs','release/private-storage.mjs','release/production-backup.mjs','release/production-backup-runner.py','release/production-health.py']]
files += list((root/'data/question-bank').glob('*.json'))
if action=='--plan':
 print(json.dumps({'target':target,'prior':prior,'files':[p.relative_to(root).as_posix() for p in files],'databaseReplaced':False}));raise SystemExit()
with connect() as client:
 def run(command,timeout=120):
  stdin,stdout,stderr=client.exec_command(command,timeout=timeout);stdin.close();out=stdout.read().decode();error=stderr.read().decode();code=stdout.channel.recv_exit_status()
  if code:raise RuntimeError('Versioned release operation failed; exit '+str(code)+'; '+error[:200])
  return out
 def remote_python(source,timeout=120):
  stdin,stdout,stderr=client.exec_command('python3 -B -',timeout=timeout);stdin.write(source);stdin.channel.shutdown_write();out=stdout.read().decode();error=stderr.read().decode();code=stdout.channel.recv_exit_status()
  if code:raise RuntimeError('Versioned release check failed; exit '+str(code)+'; '+error[:200])
  return out
 if action=='--stage':
  if not (root/'data/question-bank/catalog.json').is_file():raise RuntimeError('Verified bank catalog is required')
  manifest={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
  directories=sorted({str(Path(n).parent).replace('\\','/') for n in manifest})
  run('test ! -e '+shlex.quote(target)+' && mkdir -p '+' '.join(shlex.quote(target+'/'+d) for d in directories))
  with client.open_sftp() as sftp:
   for relative,digest in manifest.items():
    p=root/relative
    if hashlib.sha256(p.read_bytes()).hexdigest()!=digest:raise RuntimeError('Local file changed during staging')
    sftp.put(str(p),target+'/'+relative);sftp.chmod(target+'/'+relative,0o640)
   with sftp.file(target+'/source-manifest.json','w')as f:f.write(json.dumps(manifest))
  remote_python("import json,hashlib\nfrom pathlib import Path\np=Path("+repr(target)+")\nfor n,h in json.loads((p/'source-manifest.json').read_text()).items():\n assert hashlib.sha256((p/n).read_bytes()).hexdigest()==h,n\n")
  run('chown -R root:learningapp '+shlex.quote(target)+' && find '+shlex.quote(target)+' -type d -exec chmod 750 {} +')
  run(base+'/tools/node/bin/node --check '+target+'/release/production-server.mjs')
  result={'stagedAt':time.time(),'target':target,'files':manifest,'runningServiceChanged':False}
 elif action=='--activate':
  if run('readlink -f '+base+'/current').strip()!=prior:raise RuntimeError('Live version changed; re-audit before activation')
  run('systemctl start learning-platform-backup.service',240)
  remote_python("import json,hashlib,time\nfrom pathlib import Path\np=Path('/var/lib/learning-platform/operations/backup.json')\nb=json.loads(p.read_text());assert b['success'] and b['serviceResumed']\na=Path('/var/backups/learning-platform')/b['archive'];r=json.loads(Path(str(a)+'.receipt.json').read_text());assert r['fullPayloadVerifiedAtCreation'] and hashlib.sha256(a.read_bytes()).hexdigest()==b['sha256'];assert time.time()-a.stat().st_mtime<300\n")
  run('systemctl stop learning-platform.service')
  try:
   # All pre-existing business tables must remain byte-equivalent. Only additive
   # migration bookkeeping and the new import audit may change during this window.
   capture="""import sqlite3,json,hashlib
db=sqlite3.connect('file:/var/lib/learning-platform/data/learning.sqlite?mode=ro',uri=True)
out={}
for (name,) in db.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'\"):
 if name in ['local_migrations','audit_events','rate_limits','sessions'] or name.startswith(('bank_','ai_lab_','deeptutor_lab_')):continue
 rows=db.execute('SELECT * FROM \"'+name+'\"').fetchall()
 out[name]=hashlib.sha256(json.dumps(sorted(rows,key=repr),ensure_ascii=False,default=repr).encode()).hexdigest()
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert not db.execute('PRAGMA foreign_key_check').fetchall()
print(json.dumps(out,sort_keys=True))
"""
   before=remote_python(capture)
   cli=[base+'/tools/node/bin/node',target+'/scripts/import-question-bank.mjs','--database','/var/lib/learning-platform/data/learning.sqlite']
   imported=run('runuser -u learningapp -- '+' '.join(shlex.quote(a)for a in cli))
   after=remote_python(capture)
   if before!=after:raise RuntimeError('Existing business table digests changed')
   remote_python("import os\nfrom pathlib import Path\nt=Path("+repr(target)+");assert t.is_dir() and str(t).startswith('/opt/learning-platform/releases/')\np=Path('/opt/learning-platform/content-next');assert not p.exists() and not p.is_symlink()\np.symlink_to(t);os.replace(p,Path('/opt/learning-platform/current'))\n")
   run('systemctl start learning-platform.service')
   time.sleep(2)
   check=remote_python("import json,urllib.request\nfrom pathlib import Path\nc=json.loads(Path('/etc/learning-platform/runtime.json').read_text())\nh={'X-Trial-Bridge':c['BRIDGE_SECRET']}\nfor path in ['health','public/coverage']:\n r=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8792/api/v1/'+path,headers=h),timeout=15);assert r.status==200\n print(json.dumps({'path':path,'response':json.load(r)}))\n")
   result={'activatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'target':target,'prior':prior,'existingBusinessTablesUnchanged':True,'import':imported,'checks':check,'databaseReplaced':False}
  except:
   remote_python("import os\nfrom pathlib import Path\np=Path('/opt/learning-platform/content-fallback');p.symlink_to("+repr(prior)+");os.replace(p,Path('/opt/learning-platform/current'))\n")
   run('systemctl start learning-platform.service')
   raise
 else:
  if run('readlink -f '+base+'/current').strip()!=target:raise RuntimeError('Unexpected live version; refusing rollback')
  run('systemctl stop learning-platform.service')
  remote_python("import os\nfrom pathlib import Path\np=Path('/opt/learning-platform/content-rollback');p.symlink_to("+repr(prior)+");os.replace(p,Path('/opt/learning-platform/current'))\n")
  run('systemctl start learning-platform.service')
  result={'rolledBackAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'source':prior,'additiveTablesRetained':True,'productionDataRestored':False}
 out=root/'test-results/content-release';out.mkdir(parents=True,exist_ok=True)
 (out/(action[2:]+'.json')).write_text(json.dumps(result,indent=2))
 print(json.dumps(result if action!='--stage' else {'target':target,'files':len(files),'runningServiceChanged':False}))
