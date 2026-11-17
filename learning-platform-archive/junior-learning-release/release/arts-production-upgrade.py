"""Reviewable .4 backend coordinator. Only the root deployment owner executes remote actions.

Default --plan is local/read-only. --stage uploads an immutable independent release.
--activate backs up, stops writes, adds/seeds arts, verifies old tables, then switches.
--rollback changes only the backend symlink and preserves every arts database record.
No action publishes static assets, replaces a database, creates accounts or approves content.
"""
import sys, json, hashlib, shlex, time
from pathlib import Path
sys.dont_write_bytecode = True
sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
BASE = '/opt/learning-platform'
TARGET = BASE + '/releases/20261114-arts-1'
PRIOR = BASE + '/releases/20261114-content-2'
NODE = BASE + '/tools/node/bin/node'
DATABASE = '/var/lib/learning-platform/data/learning.sqlite'
ARTS_TABLES = ['arts_attempts', 'arts_content_versions', 'arts_plan_versions', 'arts_plans', 'arts_reports', 'arts_reviews']
REQUIRED = ['scripts/local-db.mjs', 'scripts/environment.mjs', 'scripts/seed-arts-production.mjs',
            'scripts/apply-bank-rechecks.mjs', 'scripts/import-subject-pilot.mjs', 'scripts/import-question-bank.mjs',
            'scripts/learning-qa-deployed-smoke.mjs', 'release/production-server.mjs', 'release/private-storage.mjs',
            'release/production-backup.mjs', 'release/production-backup-runner.py', 'release/production-health.py']


def local_manifest():
    files = list((ROOT / 'src').glob('*.mjs')) + list((ROOT / 'migrations').glob('*.sql'))
    files += list((ROOT / 'data/question-bank').rglob('*.json')) + list((ROOT / 'data').glob('arts*.json'))
    files += [ROOT / 'integrations/learning-qa/sources.json'] + list((ROOT / 'integrations/learning-qa/sources').glob('*.txt'))
    files += [ROOT / p for p in REQUIRED]
    for required in ['src/arts.mjs', 'src/arts-domain.mjs', 'data/arts-content.json', 'migrations/0020_arts.sql']:
        if not (ROOT / required).is_file():
            raise RuntimeError('Arts integration file is missing: ' + required)
    result = {}
    for file in sorted(set(files)):
        if not file.is_file() or file.is_symlink() or not file.resolve().is_relative_to(ROOT):
            raise RuntimeError('Unsafe or missing release input')
        name = file.relative_to(ROOT).as_posix()
        if name.startswith(('.local/', 'public/')) or '..' in Path(name).parts:
            raise RuntimeError('Unexpected release input boundary')
        result[name] = hashlib.sha256(file.read_bytes()).hexdigest()
    return result


def verified_rehearsal(manifest):
    path = ROOT / 'test-results/arts-production/rehearsal.json'
    if not path.is_file():
        raise RuntimeError('Run the local arts-rehearsal.mjs before staging or activation')
    record = json.loads(path.read_text(encoding='utf-8'))
    baseline = json.loads((ROOT / 'release/content-round2.json').read_text(encoding='utf-8'))
    if not (record['localOnly'] and not record['productionModified'] and record['allOriginalTablesUnchanged']
            and record['sourceBackupUnchanged'] and record['secondMigrateAndSeedIdempotent']
            and record['newTables'] == ARTS_TABLES and record['artsCounts']['contents'] == 6
            and record['artsCounts']['questions'] == 18 and record['artsCounts']['reviewed'] == 0
            and record['artsCounts']['pending'] == 6
            and record['apiChecks']['health'] == 200 and record['apiChecks']['publicArts'] == 200
            and record['apiChecks']['juniorTotalsUnchanged'] and record['apiChecks']['qaStatusEndpoint'] == 200
            and record['apiChecks']['anonymousArts'] == 401 and record['apiChecks']['anonymousStudents'] == 401
            and record['restoredFromArchive'] == baseline['backup']['archive']):
        raise RuntimeError('Local independent restore/migration evidence does not satisfy this release')
    for name, digest in record['criticalSourceHashes'].items():
        if manifest.get(name) != digest:
            raise RuntimeError('Source changed after the local rehearsal: ' + name)
    return {'checkedAt': record['checkedAt'], 'restoredFromArchive': record['restoredFromArchive'],
            'sourceDatabaseSha256': record['sourceDatabaseSha256']}


def save_result(action, result):
    folder = ROOT / 'test-results/arts-production'
    folder.mkdir(parents=True, exist_ok=True)
    text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    (folder / (action + '-' + str(time.time_ns()) + '.json')).write_text(text, encoding='utf-8')
    (folder / (action + '.json')).write_text(text, encoding='utf-8')


action = sys.argv[1] if len(sys.argv) > 1 else '--plan'
if len(sys.argv) > 2 or action not in ['--plan', '--stage', '--activate', '--rollback']:
    raise SystemExit('Choose --plan, --stage, --activate, or --rollback')
manifest = local_manifest() if action != '--rollback' else None
if action == '--plan':
    try:
        verified_rehearsal(manifest)
        rehearsal_ready, rehearsal_issue = True, None
    except Exception as error:
        rehearsal_ready, rehearsal_issue = False, str(error)
    print(json.dumps({'action': 'plan', 'target': TARGET, 'prior': PRIOR, 'files': len(manifest),
                      'requiredLocalRehearsal': 'release/arts-rehearsal.mjs', 'newTables': ARTS_TABLES,
                      'localRehearsalReady': rehearsal_ready, 'localRehearsalIssue': rehearsal_issue,
                      'expectedContents': 6, 'expectedQuestions': 18, 'expectedHumanReviews': 0,
                      'productionDatabaseReplacement': False, 'staticWorkerChanged': False,
                      'remoteConnectionOpened': False}))
    raise SystemExit()
rehearsal = verified_rehearsal(manifest) if action != '--rollback' else None
# Deliberately lazy: --plan never imports credentials or opens SSH.
sys.path.insert(0, 'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect

with connect() as client:
    def run(command, timeout=150, label='remote operation'):
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        stdin.close()
        output = stdout.read().decode('utf-8')
        stderr.read()  # Never copy credentials, request bodies, or raw server errors into receipts/chat.
        code = stdout.channel.recv_exit_status()
        if code:
            raise RuntimeError(label + ' failed with exit ' + str(code) + '; raw server output withheld')
        return output

    def py(source, timeout=150, label='remote verification'):
        stdin, stdout, stderr = client.exec_command('python3 -B -', timeout=timeout)
        stdin.write(source)
        stdin.channel.shutdown_write()
        output = stdout.read().decode('utf-8')
        stderr.read()
        code = stdout.channel.recv_exit_status()
        if code:
            raise RuntimeError(label + ' failed with exit ' + str(code) + '; raw server output withheld')
        return output

    def current():
        return run('readlink -f ' + shlex.quote(BASE + '/current'), label='current release lookup').strip()

    def assert_manifest():
        py("import json,hashlib\nfrom pathlib import Path\np=Path(" + repr(TARGET) + ")\n"
           "expected=json.loads(" + repr(json.dumps(manifest)) + ")\n"
           "actual=json.loads((p/'source-manifest.json').read_text())\nassert actual==expected,'manifest changed'\n"
           "for name,digest in actual.items():\n f=p/name;assert not f.is_symlink() and f.is_file() and f.resolve().is_relative_to(p.resolve());assert hashlib.sha256(f.read_bytes()).hexdigest()==digest,name\n",
           label='staged manifest verification')

    def switch(destination):
        if destination not in [TARGET, PRIOR]:
            raise RuntimeError('Unknown backend target')
        py("import os\nfrom pathlib import Path\np=Path('/opt/learning-platform/arts-next')\n"
           "assert not p.exists() and not p.is_symlink()\nd=Path(" + repr(destination) + ")\n"
           "assert d.parent==Path('/opt/learning-platform/releases') and d.is_dir() and not d.is_symlink()\n"
           "p.symlink_to(d);os.replace(p,Path('/opt/learning-platform/current'))\n", label='atomic backend switch')

    def service_stopped():
        py("import subprocess\ns=subprocess.check_output(['systemctl','show','learning-platform.service','-p','ActiveState','--value'],text=True).strip()\nassert s=='inactive'\n", label='write-stop verification')

    def capture(names=None):
        source = """import sqlite3,json,hashlib
db=sqlite3.connect('file:/var/lib/learning-platform/data/learning.sqlite?mode=ro',uri=True)
db.execute('PRAGMA query_only=ON')
all_names=[r[0]for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
selected=SELECTED
if selected is None:selected=[n for n in all_names if n!='local_migrations']
out={}
for name in selected:
 assert name in all_names
 quoted='"'+name.replace('"','""')+'"'
 rows=sorted(db.execute('SELECT * FROM '+quoted).fetchall(),key=repr)
 schema=db.execute("SELECT type,name,sql FROM sqlite_master WHERE tbl_name=? AND type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_autoindex%' ORDER BY type,name",(name,)).fetchall()
 out[name]={'rows':len(rows),'sha256':hashlib.sha256(json.dumps(rows,ensure_ascii=False,default=repr).encode()).hexdigest(),'schemaSha256':hashlib.sha256(json.dumps(schema,ensure_ascii=False,default=repr).encode()).hexdigest()}
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert not db.execute('PRAGMA foreign_key_check').fetchall()
orgs=[r[0]for r in db.execute('SELECT id FROM organizations')]
assert len(orgs)==1
print(json.dumps({'tables':out,'allTables':all_names,'organization':orgs[0]},sort_keys=True))
""".replace('SELECTED', repr(names))
        return json.loads(py(source, label='read-only database digest capture'))

    def probe(include_arts=False):
        paths = ['health', 'public/coverage', 'public/learning-qa-status']
        if include_arts:
            paths += ['public/arts/catalog']
        source = """import json,time,urllib.request,urllib.error
from pathlib import Path
c=json.loads(Path('/etc/learning-platform/runtime.json').read_text())
headers={'X-Trial-Bridge':c['BRIDGE_SECRET']}
paths=PATHS
last=None
for attempt in range(4):
 try:
  result={}
  for path in paths:
   response=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8792/api/v1/'+path,headers=headers),timeout=20)
   assert response.status==200
   result[path]=json.load(response)['data']
  for path in ['students','arts/catalog?examYear=2027']:
   try:urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8792/api/v1/'+path,headers=headers),timeout=10);raise AssertionError('private endpoint exposed')
   except urllib.error.HTTPError as error:assert error.code==401
  print(json.dumps(result,ensure_ascii=False));break
 except Exception as error:
  last=type(error).__name__
  if attempt==3:raise RuntimeError('protected loopback probe failed: '+last)
  time.sleep(1)
""".replace('PATHS', repr(paths))
        return json.loads(py(source, timeout=300, label='real protected loopback API probes'))

    def validate_live(checks, baseline=None, arts=False):
        health = checks['health']
        if health.get('status') != 'ok' or health.get('aiFormalGrading') is not False or health.get('aiGeneration') != 'unavailable':
            raise RuntimeError('Unexpected health/capability boundary')
        if checks['public/learning-qa-status'].get('status') != 'limited':
            raise RuntimeError('Existing protected learning QA is not actually ready')
        if baseline and checks['public/coverage']['totals'] != baseline['public/coverage']['totals']:
            raise RuntimeError('Junior public totals changed')
        if arts:
            catalog = checks['public/arts/catalog']
            counts = catalog.get('counts', {})
            if catalog.get('stage') != 'senior_arts' or counts.get('points') != 6 or counts.get('questions') != 18 or counts.get('initialHumanReviewed') != 0 or counts.get('humanReviewed') is not None:
                raise RuntimeError('Unexpected public arts inventory or review claim')
            def no_private(value):
                if isinstance(value, dict):
                    if any(k in value for k in ['correctOption', 'selectedOption', 'rationale', 'snapshot_json', 'answers_json', 'studentId', 'owner_id']):
                        raise RuntimeError('Public arts API exposed a private field')
                    for v in value.values(): no_private(v)
                elif isinstance(value, list):
                    for v in value: no_private(v)
            no_private(catalog)

    if action == '--stage':
        if current() != PRIOR:
            raise RuntimeError('Current backend changed; re-audit before staging')
        dirs = sorted({str(Path(name).parent).replace('\\', '/') for name in manifest})
        py("from pathlib import Path\np=Path(" + repr(TARGET) + ")\nassert p.parent.resolve()==Path('/opt/learning-platform/releases').resolve()\nassert not p.exists() and not p.is_symlink()\np.mkdir(mode=0o750)\nfor name in " + repr(dirs) + ":\n d=p/name;assert '..' not in Path(name).parts;d.mkdir(parents=True,exist_ok=True,mode=0o750)\n", label='independent release directory creation')
        with client.open_sftp() as sftp:
            for name, digest in manifest.items():
                if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != digest:
                    raise RuntimeError('Local input changed during staging')
                sftp.put(str(ROOT / name), TARGET + '/' + name)
                sftp.chmod(TARGET + '/' + name, 0o640)
            with sftp.file(TARGET + '/source-manifest.json', 'w') as file:
                file.write(json.dumps(manifest))
            sftp.chmod(TARGET + '/source-manifest.json', 0o640)
        assert_manifest()
        py("import os\nfrom pathlib import Path\np=Path(" + repr(TARGET) + ")\nassert p.parent==Path('/opt/learning-platform/releases') and not p.is_symlink()\nimport grp\ngid=grp.getgrnam('learningapp').gr_gid\nfor f in [p,*p.rglob('*')]:\n assert not f.is_symlink();os.chown(f,0,gid);os.chmod(f,0o750 if f.is_dir() else 0o640)\n", label='release permissions')
        run('runuser -u learningapp -- ' + ' '.join(shlex.quote(x) for x in [NODE, '--input-type=module', '-e', "await import('file://" + TARGET + "/src/api.mjs');console.log('API imports resolved')"]), label='low-privilege API module import')
        result = {'stagedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'target': TARGET, 'prior': PRIOR, 'files': manifest, 'rehearsal': rehearsal, 'runningBackendChanged': False, 'productionDatabaseModified': False, 'staticWorkerChanged': False}
    elif action == '--activate':
        if current() != PRIOR:
            raise RuntimeError('Production backend changed; activation refused')
        assert_manifest()
        baseline = probe()
        validate_live(baseline)
        run('systemctl start learning-platform-backup.service', timeout=300, label='fresh encrypted production backup')
        backup = json.loads(py("import json,hashlib,time,re\nfrom pathlib import Path\nb=json.loads(Path('/var/lib/learning-platform/operations/backup.json').read_text());assert b['success'] and b['serviceResumed']\nassert re.fullmatch(r'learning-platform-[A-Za-z0-9-]+\\.lpbak',b['archive'])\np=Path('/var/backups/learning-platform')/b['archive'];assert time.time()-p.stat().st_mtime<300 and hashlib.sha256(p.read_bytes()).hexdigest()==b['sha256']\nr=json.loads(Path(str(p)+'.receipt.json').read_text());assert r['fullPayloadVerifiedAtCreation']\nprint(json.dumps({'archive':b['archive'],'sha256':b['sha256'],'fullPayloadVerifiedAtCreation':True,'fresh':True}))\n", label='fresh backup receipt verification'))
        if current() != PRIOR:
            raise RuntimeError('Production changed during backup; activation refused')
        run('systemctl stop learning-platform.service', label='stop production writes')
        try:
            service_stopped()
            before = capture()
            command = [NODE, TARGET + '/scripts/seed-arts-production.mjs', '--database', DATABASE, '--org', before['organization']]
            seed = json.loads(run('runuser -u learningapp -- ' + ' '.join(shlex.quote(x) for x in command), label='additive migration and explicit single-org arts seed'))
            if not seed['originalTablesUnchanged'] or (seed['contents'], seed['questions'], seed['pending'], seed['reviewed']) != (6, 18, 6, 0):
                raise RuntimeError('Unexpected seed result')
            service_stopped()
            after = capture(list(before['tables']))
            if before['tables'] != after['tables']:
                raise RuntimeError('A pre-existing table or schema changed')
            if sorted(n for n in after['allTables'] if n.startswith('arts_')) != ARTS_TABLES:
                raise RuntimeError('Unexpected arts schema')
            if set(after['allTables']) - set(before['allTables']) - set(ARTS_TABLES):
                raise RuntimeError('An unrelated new table appeared')
            switch(TARGET)
            run('systemctl start learning-platform.service', label='start independent arts backend')
            checks = probe(include_arts=True)
            validate_live(checks, baseline, arts=True)
            result = {'activatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'target': TARGET, 'prior': PRIOR, 'backup': backup, 'rehearsal': rehearsal, 'seed': seed, 'oldTableSnapshots': before['tables'], 'allOriginalTablesUnchanged': True, 'checks': checks, 'databaseReplaced': False, 'staticWorkerChanged': False, 'teacherReviewsCreated': 0}
        except Exception as error:
            recovery = {'attempted': True, 'backendLinkRestored': False, 'serviceStarted': False, 'checksPassed': False, 'databaseReplaced': False, 'artsRecordsPreserved': True}
            try:
                link = current()
                if link not in [TARGET, PRIOR]:
                    raise RuntimeError('Unknown concurrent backend change; no symlink was overwritten')
                if link == TARGET:
                    switch(PRIOR)
                recovery['backendLinkRestored'] = True
                run('systemctl start learning-platform.service', label='restart previous backend after failure')
                recovery['serviceStarted'] = True
                restored = probe()
                validate_live(restored, baseline)
                recovery['checksPassed'] = True
            except Exception as recovery_error:
                recovery['error'] = str(recovery_error)
            save_result('activate-failed', {'at': time.time(), 'error': str(error), 'backup': backup, 'recovery': recovery})
            raise
    else:
        if current() != TARGET:
            raise RuntimeError('Unknown production version; refusing rollback')
        # Do not delay an emergency code rollback trying to probe the unhealthy new API.
        baseline = None
        run('systemctl stop learning-platform.service', label='stop writes for backend rollback')
        try:
            service_stopped()
            arts_before = capture(ARTS_TABLES)['tables']
            switch(PRIOR)
        finally:
            run('systemctl start learning-platform.service', label='restart backend after rollback attempt')
        if capture(ARTS_TABLES)['tables'] != arts_before:
            raise RuntimeError('Arts data changed during backend rollback')
        result = {'rolledBackAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'backend': PRIOR, 'previousBackend': TARGET, 'artsDataPreserved': True, 'artsTableSnapshots': arts_before, 'productionDatabaseReplaced': False, 'staticWorkerChanged': False}
        try:
            checks = probe()
            validate_live(checks, baseline)
            result['checks'] = checks
            result['checksPassed'] = True
        except Exception as error:
            result['checksPassed'] = False
            result['checkError'] = str(error)
            save_result('rollback', result)
            raise RuntimeError('Backend was restored and arts data preserved; post-rollback health needs attention') from error
    save_result(action[2:], result)
    print(json.dumps({'action': action[2:], 'backend': result.get('target', result.get('backend')), 'files': len(manifest) if manifest else None, 'productionDatabaseReplaced': False, 'staticWorkerChanged': False, 'allOriginalTablesUnchanged': result.get('allOriginalTablesUnchanged'), 'artsDataPreserved': result.get('artsDataPreserved'), 'seed': result.get('seed')}, ensure_ascii=False))
