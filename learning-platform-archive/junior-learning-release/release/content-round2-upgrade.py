"""Second content release: additive schema, CAS rechecks, reversible candidates.
Only the primary deployment coordinator executes this file.
"""
import sys,json,hashlib,shlex,time
from pathlib import Path
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1]
base='/opt/learning-platform';target=base+'/releases/20261114-content-2';prior=base+'/releases/20261114-content-1';node=base+'/tools/node/bin/node';database='/var/lib/learning-platform/data/learning.sqlite'
reports=['math-recheck-v2.json','english-recheck-v3.json']
action=sys.argv[1]if len(sys.argv)>1 else'--plan'
if action not in ['--plan','--stage','--activate','--rollback']:raise SystemExit('Choose --plan, --stage, --activate, --rollback')
files=list((root/'src').glob('*.mjs'))+list((root/'migrations').glob('*.sql'))+list((root/'data/question-bank').rglob('*.json'))+[root/'integrations/learning-qa/sources.json']+list((root/'integrations/learning-qa/sources').glob('*.txt'))
files += [root/p for p in ['scripts/local-db.mjs','scripts/environment.mjs','scripts/apply-bank-rechecks.mjs','scripts/import-subject-pilot.mjs','scripts/import-question-bank.mjs','scripts/learning-qa-deployed-smoke.mjs','release/production-server.mjs','release/private-storage.mjs','release/production-backup.mjs','release/production-backup-runner.py','release/production-health.py']]
batch_ids=[b['id']for report in reports for b in json.loads((root/'data/question-bank/rechecks'/report).read_text(encoding='utf-8'))['batches']]
if action=='--plan':print(json.dumps({'target':target,'prior':prior,'files':len(files),'recheckBatches':batch_ids,'databaseReplacement':False}));raise SystemExit()
with connect()as client:
 def run(cmd,timeout=150):
  stdin,out,err=client.exec_command(cmd,timeout=timeout);stdin.close();text=out.read().decode();error=err.read().decode();code=out.channel.recv_exit_status()
  if code:raise RuntimeError('Release operation failed; exit '+str(code)+'; '+error[:200])
  return text
 def py(source,timeout=90):
  stdin,out,err=client.exec_command('python3 -B -',timeout=timeout);stdin.write(source);stdin.channel.shutdown_write();text=out.read().decode();error=err.read().decode();code=out.channel.recv_exit_status()
  if code:raise RuntimeError('Release check failed; exit '+str(code)+'; '+error[:200])
  return text
 def cli(script,extra):return run('runuser -u learningapp -- '+' '.join(shlex.quote(x)for x in [node,target+'/scripts/'+script,'--database',database]+extra))
 def switch(destination):
  py("import os\nfrom pathlib import Path\np=Path('/opt/learning-platform/round2-next');assert not p.exists() and not p.is_symlink()\nd=Path("+repr(destination)+");assert d.parent==Path('/opt/learning-platform/releases') and d.is_dir()\np.symlink_to(d);os.replace(p,Path('/opt/learning-platform/current'))\n")
 def rollback_content():
  results=[]
  for batch in batch_ids:results.append(json.loads(cli('apply-bank-rechecks.mjs',['--rollback',batch])))
  for batch in ['pilot-physics-20261114-v1','pilot-geography-20261114-v1']:results.append(json.loads(cli('import-subject-pilot.mjs',['--withdraw',batch])))
  return results
 if action=='--stage':
  manifest={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()for p in files};directories=sorted({str(Path(n).parent).replace('\\','/')for n in manifest})
  run('test ! -e '+shlex.quote(target)+' && mkdir -p '+' '.join(shlex.quote(target+'/'+d)for d in directories))
  with client.open_sftp()as sftp:
   for name,digest in manifest.items():
    if hashlib.sha256((root/name).read_bytes()).hexdigest()!=digest:raise RuntimeError('Source changed during stage')
    sftp.put(str(root/name),target+'/'+name);sftp.chmod(target+'/'+name,0o640)
   with sftp.file(target+'/source-manifest.json','w')as f:f.write(json.dumps(manifest))
  py("import json,hashlib\nfrom pathlib import Path\np=Path("+repr(target)+")\nfor name,digest in json.loads((p/'source-manifest.json').read_text()).items():assert hashlib.sha256((p/name).read_bytes()).hexdigest()==digest,name\n")
  run('chown -R root:learningapp '+shlex.quote(target)+' && find '+shlex.quote(target)+' -type d -exec chmod 750 {} +')
  run(node+' --input-type=module -e '+shlex.quote("await import('"+target+"/src/api.mjs');console.log('API imports resolved')"))
  result={'stagedAt':time.time(),'target':target,'files':manifest,'runningBackendChanged':False}
 elif action=='--activate':
  if run('readlink -f '+base+'/current').strip()!=prior:raise RuntimeError('Production changed; re-audit')
  py("import json,hashlib\nfrom pathlib import Path\np=Path("+repr(target)+")\nfor name,digest in json.loads((p/'source-manifest.json').read_text()).items():assert hashlib.sha256((p/name).read_bytes()).hexdigest()==digest,name\n")
  run('systemctl start learning-platform-backup.service',240)
  py("import json,hashlib,time\nfrom pathlib import Path\nb=json.loads(Path('/var/lib/learning-platform/operations/backup.json').read_text());assert b['success'] and b['serviceResumed']\np=Path('/var/backups/learning-platform')/b['archive'];assert time.time()-p.stat().st_mtime<300 and hashlib.sha256(p.read_bytes()).hexdigest()==b['sha256']\nr=json.loads(Path(str(p)+'.receipt.json').read_text());assert r['fullPayloadVerifiedAtCreation']\n")
  run('systemctl stop learning-platform.service')
  capture="""import sqlite3,json,hashlib
db=sqlite3.connect('file:/var/lib/learning-platform/data/learning.sqlite?mode=ro',uri=True)
names=[r[0]for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
skip={'local_migrations','bank_heads','bank_versions','bank_batches','bank_recheck_batches','bank_recheck_items','learning_qa_jobs'}
out={n:hashlib.sha256(json.dumps(sorted(db.execute('SELECT * FROM "'+n+'"').fetchall(),key=repr),ensure_ascii=False,default=repr).encode()).hexdigest()for n in names if n not in skip}
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok' and not db.execute('PRAGMA foreign_key_check').fetchall()
print(json.dumps(out,sort_keys=True))
"""
  before=py(capture);receipts=[]
  try:
   for report in reports:receipts.append(json.loads(cli('apply-bank-rechecks.mjs',['--report',target+'/data/question-bank/rechecks/'+report])))
   pilot=json.loads(cli('import-subject-pilot.mjs',[]))
   if py(capture)!=before:raise RuntimeError('Pre-existing business data changed')
   switch(target);run('systemctl start learning-platform.service');time.sleep(2)
   checks=py("import json,urllib.request\nfrom pathlib import Path\nc=json.loads(Path('/etc/learning-platform/runtime.json').read_text());h={'X-Trial-Bridge':c['BRIDGE_SECRET']}\nfor path in ['health','public/coverage','public/learning-qa-status']:\n r=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8792/api/v1/'+path,headers=h),timeout=20);assert r.status==200\n print(json.dumps({'path':path,'data':json.load(r)['data']},ensure_ascii=False))\n")
   result={'activatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'target':target,'prior':prior,'receipts':receipts,'pilot':pilot,'checks':[json.loads(line)for line in checks.splitlines()],'oldBusinessTablesUnchanged':True,'databaseReplaced':False}
  except Exception:
   # No history is deleted. Rollback conflicts preserve any later teacher work.
   try:rollback_content()
   finally:switch(prior);run('systemctl start learning-platform.service')
   raise
 else:
  if run('readlink -f '+base+'/current').strip()!=target:raise RuntimeError('Unknown production version; refusing rollback')
  run('systemctl stop learning-platform.service')
  try:rolled=rollback_content();switch(prior)
  finally:run('systemctl start learning-platform.service')
  result={'rolledBackAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'backend':prior,'contentRollback':rolled,'historyPreserved':True,'productionDatabaseReplaced':False}
 out=root/'test-results/content-round2';out.mkdir(parents=True,exist_ok=True);(out/(action[2:]+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 if action=='--stage':print(json.dumps({'target':target,'files':len(files),'runningBackendChanged':False}))
 elif action=='--activate':print(json.dumps({'target':target,'oldBusinessTablesUnchanged':True,'recheckBatches':len(batch_ids),'rechecked':sum(r['applied']for report in receipts for r in report['results']),'conflicts':[q for report in receipts for r in report['results']for q in r['conflicts']],'pilot':pilot,'coverage':next(x['data']['totals']for x in result['checks']if x['path']=='public/coverage'),'qa':next(x['data']['status']for x in result['checks']if x['path']=='public/learning-qa-status')},ensure_ascii=False))
 else:print(json.dumps(result,ensure_ascii=False))
