"""Reviewable, root-owner-only referral release coordinator.

--plan is entirely local. Remote actions are never implicit.
--stage uploads immutable source only; --activate adds empty schemas and switches code.
--rollback switches code only and verifies referral records remain byte-for-byte equivalent.
No action seeds data, replaces a database, publishes static files, or enables live referrals.
"""
import sys, json, hashlib, shlex, time, re, uuid
from datetime import datetime
from pathlib import Path

sys.dont_write_bytecode = True
sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
BASE = '/opt/learning-platform'
TARGET = BASE + '/releases/20261115-plan-1'
PRIOR = BASE + '/releases/20261115-referral-1'
NODE = BASE + '/tools/node/bin/node'
DATABASE = '/var/lib/learning-platform/data/learning.sqlite'
OUTPUT = ROOT / 'test-results/time-plan-production'
TIME_PLAN_TABLES = ['time_plan_events','time_plan_previews','time_plan_versions','time_plans']
REQUIRED = ['scripts/local-db.mjs', 'scripts/environment.mjs', 'scripts/migrate-time-plan-production.mjs',
            'scripts/seed-arts-production.mjs', 'scripts/apply-bank-rechecks.mjs',
            'scripts/import-subject-pilot.mjs', 'scripts/import-question-bank.mjs',
            'scripts/learning-qa-deployed-smoke.mjs', 'release/production-server.mjs',
            'release/private-storage.mjs', 'release/production-backup.mjs',
            'release/production-backup-runner.py', 'release/production-health.py']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def coverage_without_generated_at(payload):
    if not isinstance(payload, dict):
        raise RuntimeError('Junior public response must be an object')
    value = payload.get('generatedAt')
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', value):
        raise RuntimeError('Junior generatedAt must be a UTC ISO timestamp')
    try:
        datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise RuntimeError('Junior generatedAt must be a valid calendar timestamp') from None
    # Only this one top-level generated clock field is excluded. Nested fields,
    # totals, subject inventories and every other body field remain exact.
    return {key: item for key, item in payload.items() if key != 'generatedAt'}


def qa_without_checked_at(payload):
    if not isinstance(payload, dict):
        raise RuntimeError('Learning QA public response must be an object')
    value = payload.get('checkedAt')
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', value):
        raise RuntimeError('Learning QA checkedAt must be a UTC ISO timestamp')
    try:
        datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise RuntimeError('Learning QA checkedAt must be a valid calendar timestamp') from None
    return {key: item for key, item in payload.items() if key != 'checkedAt'}


def comparison_clock_fields(checks, baseline):
    return {'juniorGeneratedAt': {'before': baseline['public/coverage']['generatedAt'],
                                 'after': checks['public/coverage']['generatedAt']},
            'qaCheckedAt': {'before': baseline['public/learning-qa-status']['checkedAt'],
                            'after': checks['public/learning-qa-status']['checkedAt']}}


def ensure_recovery_ownership(switched_by_this_operation, link):
    if not switched_by_this_operation and link != PRIOR:
        raise RuntimeError('This operation never switched code; another TARGET or unknown release will not be stopped or rolled back')
    if link not in [TARGET, PRIOR]:
        raise RuntimeError('Unknown concurrent backend change; no symlink was overwritten')


def local_manifest():
    files = list((ROOT / 'src').glob('*.mjs')) + list((ROOT / 'migrations').glob('*.sql'))
    files += list((ROOT / 'data/question-bank').rglob('*.json')) + list((ROOT / 'data').glob('arts*.json'))
    files += [ROOT / 'integrations/learning-qa/sources.json'] + list((ROOT / 'integrations/learning-qa/sources').glob('*.txt'))
    files += [ROOT / p for p in REQUIRED]
    for required in ['src/api.mjs', 'src/referral.mjs', 'src/referral-domain.mjs',
                     'src/referral-contact.mjs', 'migrations/0050_time_plans.sql',
                     'migrations/0031_referral_contact.sql', 'src/arts.mjs', 'data/arts-content.json']:
        if not (ROOT / required).is_file():
            raise RuntimeError('Required integrated source is missing: ' + required)
    result = {}
    for file in sorted(set(files)):
        if not file.is_file() or file.is_symlink() or not file.resolve().is_relative_to(ROOT):
            raise RuntimeError('Unsafe or missing release input')
        name = file.relative_to(ROOT).as_posix()
        if name.startswith(('.local/', 'public/', 'test-results/')) or '..' in Path(name).parts:
            raise RuntimeError('Release input crossed the source-only boundary')
        result[name] = sha(file)
    return result


def verified_rehearsal(manifest):
    file = OUTPUT / 'rehearsal.json'
    receipt_file = OUTPUT / 'restore-check.json'
    if not file.is_file() or not receipt_file.is_file():
        raise RuntimeError('A new restored-backup receipt and local referral rehearsal are required')
    r = json.loads(file.read_text(encoding='utf-8'))
    receipt = json.loads(receipt_file.read_text(encoding='utf-8'))
    if not (r.get('localOnly') is True and r.get('productionModified') is False
            and r.get('sourceRelease') == '20261115-referral-1'
            and r.get('sourceBackupUnchanged') is True
            and r.get('allOriginalTablesUnchanged') is True
            and r.get('secondMigrationIdempotent') is True
            and r.get('allTimePlanTablesEmpty') is True and r.get('seedPerformed') is False
            and r.get('newTables') == TIME_PLAN_TABLES
            and sorted(r.get('timePlanCounts', {})) == TIME_PLAN_TABLES
            and all(value == 0 for value in r['timePlanCounts'].values())
            and receipt.get('verified') is True and receipt.get('productionUntouched') is True
            and receipt.get('sqliteIntegrity') == 'ok' and receipt.get('foreignKeysValid') is True
            and receipt.get('releaseVersion') == '20261115-referral-1'
            and r.get('restoredFromArchive') == receipt.get('archive')
            and r.get('restoreReceiptSha256') == sha(receipt_file)):
        raise RuntimeError('The local restore/rehearsal evidence does not satisfy this release')
    checks = r['apiChecks']
    for key in ['juniorUnchanged', 'artsUnchanged', 'qaUnchanged', 'contactHardClosed', 'exampleRulesSimulationOnly']:
        if checks.get(key) is not True:
            raise RuntimeError('Local API preservation or closed-boundary check failed: ' + key)
    for key in ['health', 'junior', 'arts', 'qaStatusEndpoint', 'contactStatus', 'exampleRules']:
        if checks.get(key) != 200:
            raise RuntimeError('Local API check failed: ' + key)
    expected_private = ['students', 'arts/catalog?examYear=2027', 'referral/dashboard',
                        'referral/contact-config', 'referral/contact-config/print',
                        'referral/contact-config/qr.png', 'referral/export?format=json&scope=staff',
                        'referral/export?format=csv&scope=mine', 'referral/export?format=print&scope=mine']
    if checks.get('anonymous') != dict.fromkeys(expected_private, 401) or checks.get('contactDraftsPublic') is not False:
        raise RuntimeError('Anonymous access or contact-draft boundary is not closed')
    if r.get('criticalSourceHashes') != manifest:
        raise RuntimeError('Runtime source differs from the independently rehearsed source manifest')
    archive = (ROOT / '.local/production/backups' / receipt['archive']).resolve(strict=True)
    allowed = (ROOT / '.local/production/backups').resolve(strict=True)
    if archive.parent != allowed or sha(archive) != r['sourceArchiveSha256']:
        raise RuntimeError('The locally restored encrypted archive changed after rehearsal')
    source = (ROOT / receipt['restoreDirectory'] / 'learning.sqlite').resolve(strict=True)
    if not source.is_relative_to((ROOT / '.local/production').resolve(strict=True)) or sha(source) != r['sourceDatabaseSha256']:
        raise RuntimeError('The restored source database changed after rehearsal')
    return {'checkedAt': r['checkedAt'], 'restoredFromArchive': r['restoredFromArchive'],
            'sourceArchiveSha256': r['sourceArchiveSha256'], 'sourceDatabaseSha256': r['sourceDatabaseSha256']}


def save_result(action, result):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    (OUTPUT / (action + '-' + str(time.time_ns()) + '.json')).write_text(serialized, encoding='utf-8')
    (OUTPUT / (action + '.json')).write_text(serialized, encoding='utf-8')


class RemoteOperationLock:
    """An SSH-held flock plus an exclusive owner marker. Never clears stale owners."""
    def __init__(self, client, operation_id, operation):
        self.client, self.operation_id, self.operation = client, operation_id, operation
        self.acquired = False
        self.stdin = self.stdout = self.stderr = None

    def acquire(self):
        metadata = {'operationId': self.operation_id, 'action': self.operation, 'target': TARGET}
        program = r"""import os,sys,json,fcntl,stat
meta=json.loads(METADATA)
lock='/var/lock/learning-platform-deploy.lock'
owner='/var/lock/learning-platform-deploy-owner.json'
fd=os.open(lock,os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
try:
 info=os.fstat(fd);assert stat.S_ISREG(info.st_mode) and info.st_nlink==1 and info.st_uid==os.geteuid()
 fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 # An unlocked but retained owner marker is abnormal: never steal or auto-clear it.
 assert not os.path.lexists(owner),'existing owner marker requires manual review'
 marker=os.open(owner,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 created=os.fstat(marker)
 meta['pid']=os.getpid()
 with os.fdopen(marker,'w') as stream:
  json.dump(meta,stream);stream.flush();os.fsync(stream.fileno())
 print(json.dumps({'acquired':True,'operationId':meta['operationId']}),flush=True)
 release=sys.stdin.readline().strip()
 assert release==meta['operationId'],'missing authorized release; marker retained'
 marker=os.open(owner,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(marker) as stream:
  current=os.fstat(stream.fileno());assert current.st_ino==created.st_ino and current.st_dev==created.st_dev
  assert json.load(stream)['operationId']==meta['operationId']
 current=os.lstat(owner);assert current.st_ino==created.st_ino and current.st_dev==created.st_dev and stat.S_ISREG(current.st_mode)
 os.unlink(owner)  # This operation's verified inode only; no recursive/stale cleanup.
 print(json.dumps({'released':True,'operationId':meta['operationId']}),flush=True)
finally:
 os.close(fd)  # An abnormal exit releases flock but deliberately retains the owner marker.
""".replace('METADATA', repr(json.dumps(metadata)))
        self.stdin, self.stdout, self.stderr = self.client.exec_command(
            'python3 -u -c ' + shlex.quote(program), timeout=30)
        try:
            acknowledgement = json.loads(self.stdout.readline())
        except Exception:
            self.stdout.channel.close()
            raise RuntimeError('Exclusive deployment lock not acquired; inspect the remote owner marker. No existing or stale marker was removed') from None
        if acknowledgement != {'acquired': True, 'operationId': self.operation_id}:
            self.stdout.channel.close()
            raise RuntimeError('Unexpected lock owner acknowledgement; existing marker retained')
        self.acquired = True

    def assert_held(self):
        if not self.acquired or self.stdout.channel.exit_status_ready():
            raise RuntimeError('Deployment owner lock is no longer held; no further remote action is permitted')

    def release(self):
        self.assert_held()
        try:
            self.stdin.write(self.operation_id + '\n')
            self.stdin.flush()
            self.stdin.channel.shutdown_write()
            acknowledgement = json.loads(self.stdout.readline())
            if acknowledgement != {'released': True, 'operationId': self.operation_id}:
                raise RuntimeError('Owner-specific release was not acknowledged')
            self.acquired = False
        except Exception:
            raise RuntimeError('Deployment owner marker could not be safely released; retain it and inspect manually') from None
        finally:
            self.stdout.channel.close()


action = sys.argv[1] if len(sys.argv) > 1 else '--plan'
if len(sys.argv) > 2 or action not in ['--plan', '--stage', '--activate', '--rollback']:
    raise SystemExit('Choose --plan, --stage, --activate, or --rollback')
manifest = local_manifest() if action != '--rollback' else None
if action == '--plan':
    try:
        verified_rehearsal(manifest)
        ready, issue = True, None
    except Exception as error:
        ready, issue = False, str(error)
    print(json.dumps({'action': 'plan', 'target': TARGET, 'prior': PRIOR, 'files': len(manifest),
                      'newTables': TIME_PLAN_TABLES, 'localRehearsalReady': ready, 'localRehearsalIssue': issue,
                      'restoreReceipt': 'test-results/time-plan-production/restore-check.json',
                      'requiredLocalRehearsal': 'release/time-plan-rehearsal.mjs',
                      'seedPerformed': False, 'expectedNewBusinessRows': 0,
                      'exclusiveOperationLockRequired': True, 'staleOwnerPolicy': 'retain_and_refuse_for_manual_review',
                      'productionDatabaseReplacement': False, 'staticWorkerChanged': False,
                      'liveReferralEnabled': False, 'remoteConnectionOpened': False}))
    raise SystemExit()

rehearsal = verified_rehearsal(manifest) if action != '--rollback' else None
operation_id = uuid.uuid4().hex
# Lazy by design: local --plan and source validation never import credential code.
sys.path.insert(0, 'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect

with connect() as client:
    lease = RemoteOperationLock(client, operation_id, action[2:])
    def run(command, timeout=150, label='remote operation'):
        lease.assert_held()
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        stdin.close()
        output = stdout.read().decode('utf-8')
        stderr.read()
        code = stdout.channel.recv_exit_status()
        if code:
            raise RuntimeError(label + ' failed with exit ' + str(code) + '; raw server output withheld')
        return output

    def py(source, timeout=150, label='remote verification'):
        lease.assert_held()
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

    def service_stopped():
        py("import subprocess\ns=subprocess.check_output(['systemctl','show','learning-platform.service','-p','ActiveState','--value'],text=True).strip()\nassert s=='inactive'\n", label='write-stop verification')

    def assert_manifest():
        py("import json,hashlib\nfrom pathlib import Path\np=Path(" + repr(TARGET) + ")\n"
           "assert p.parent==Path('/opt/learning-platform/releases') and p.is_dir() and not p.is_symlink()\n"
           "expected=json.loads(" + repr(json.dumps(manifest)) + ")\n"
           "actual=json.loads((p/'source-manifest.json').read_text());assert actual==expected\n"
           "for name,digest in actual.items():\n f=p/name;assert not f.is_symlink() and f.is_file() and f.resolve().is_relative_to(p.resolve());assert hashlib.sha256(f.read_bytes()).hexdigest()==digest\n",
           label='immutable staged manifest verification')

    def switch(destination, expected_current):
        if destination not in [TARGET, PRIOR]:
            raise RuntimeError('Unknown backend target')
        if expected_current not in [TARGET, PRIOR]:
            raise RuntimeError('Unknown expected backend')
        py("import os,json\nfrom pathlib import Path\nowner=json.loads(Path('/var/lock/learning-platform-deploy-owner.json').read_text())\nassert owner['operationId']==" + repr(operation_id) + "\ncurrent=Path('/opt/learning-platform/current')\nassert current.is_symlink() and current.resolve()==Path(" + repr(expected_current) + ")\np=Path('/opt/learning-platform/referral-next')\n"
           "assert not p.exists() and not p.is_symlink()\nd=Path(" + repr(destination) + ")\n"
           "assert d.parent==Path('/opt/learning-platform/releases') and d.is_dir() and not d.is_symlink()\n"
           "p.symlink_to(d);assert current.resolve()==Path(" + repr(expected_current) + ");os.replace(p,current)\n", label='owner-guarded atomic code symlink switch')

    def capture(names=None):
        source = """import sqlite3,json,hashlib
db=sqlite3.connect('file:/var/lib/learning-platform/data/learning.sqlite?mode=ro',uri=True)
db.execute('PRAGMA query_only=ON')
all_names=[r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
selected=SELECTED
if selected is None:selected=[n for n in all_names if n!='local_migrations']
out={}
for name in selected:
 assert name in all_names
 quoted='"'+name.replace('"','""')+'"'
 rows=sorted(db.execute('SELECT * FROM '+quoted).fetchall(),key=repr)
 schema=db.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE tbl_name=? AND type IN ('table','index','trigger') ORDER BY type,name",(name,)).fetchall()
 out[name]={'rows':len(rows),'sha256':hashlib.sha256(json.dumps(rows,ensure_ascii=False,default=repr).encode()).hexdigest(),'schemaSha256':hashlib.sha256(json.dumps(schema,ensure_ascii=False,default=repr).encode()).hexdigest()}
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert not db.execute('PRAGMA foreign_key_check').fetchall()
print(json.dumps({'tables':out,'allTables':all_names},sort_keys=True))
""".replace('SELECTED', repr(names))
        return json.loads(py(source, label='read-only database digest capture'))

    def probe(include_referral=False):
        paths = ['health', 'public/coverage', 'public/arts/catalog', 'public/learning-qa-status']
        private = ['students', 'arts/catalog?examYear=2027']
        if include_referral:
            paths += ['public/referral/contact-status', 'public/referral/example-rules']
            private += ['referral/dashboard', 'referral/contact-config', 'referral/contact-config/print',
                        'referral/contact-config/qr.png', 'referral/export?format=json&scope=staff',
                        'referral/export?format=csv&scope=mine', 'referral/export?format=print&scope=mine']
        source = """import json,time,urllib.request,urllib.error
from pathlib import Path
c=json.loads(Path('/etc/learning-platform/runtime.json').read_text())
headers={'X-Trial-Bridge':c['BRIDGE_SECRET']}
paths=PATHS
private=PRIVATE
for attempt in range(4):
 try:
  result={}
  for path in paths:
   response=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8792/api/v1/'+path,headers=headers),timeout=20)
   assert response.status==200 and response.headers.get('Cache-Control')=='no-store'
   result[path]=json.load(response)['data']
  result['anonymous']={}
  for path in private:
   try:urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8792/api/v1/'+path,headers=headers),timeout=10);raise AssertionError('private endpoint exposed')
   except urllib.error.HTTPError as error:
    assert error.code==401 and error.headers.get('Cache-Control')=='no-store';result['anonymous'][path]=401
  print(json.dumps(result,ensure_ascii=False));break
 except Exception as error:
  if attempt==3:raise RuntimeError('protected loopback probe failed: '+type(error).__name__)
  time.sleep(1)
""".replace('PATHS', repr(paths)).replace('PRIVATE', repr(private))
        return json.loads(py(source, timeout=300, label='protected loopback API probes'))

    def validate_live(checks, baseline=None, referral=False):
        health = checks['health']
        coverage_without_generated_at(checks['public/coverage'])
        qa_without_checked_at(checks['public/learning-qa-status'])
        if health.get('status') != 'ok' or health.get('aiFormalGrading') is not False or health.get('aiGeneration') != 'unavailable':
            raise RuntimeError('Unexpected existing health/capability boundary')
        if checks['public/learning-qa-status'].get('status') != 'limited':
            raise RuntimeError('Existing protected learning QA is not ready; release refused')
        if baseline:
            for path in ['public/coverage', 'public/arts/catalog', 'public/learning-qa-status']:
                normalize = coverage_without_generated_at if path == 'public/coverage' else qa_without_checked_at if path == 'public/learning-qa-status' else lambda value: value
                left, right = normalize(checks[path]), normalize(baseline[path])
                if left != right:
                    raise RuntimeError('An existing public API changed: ' + path)
            if checks['health'] != baseline['health']:
                raise RuntimeError('Existing health capabilities changed')
        if referral:
            contact = checks['public/referral/contact-status']
            keys = {'state', 'label', 'apiConnected', 'automaticAttribution', 'publicConsultationEnabled', 'liveIntegrationEnabled'}
            if set(contact) != keys or contact.get('state') != 'preparing' or any(contact.get(k) is not False for k in keys - {'state', 'label'}):
                raise RuntimeError('Contact API is not hard closed or exposed unexpected draft fields')
            examples = checks['public/referral/example-rules']
            if not (examples.get('simulation') is True and examples.get('unconfirmedExamples') is True
                    and examples.get('liveEnabled') is False and examples.get('paymentsEnabled') is False):
                raise RuntimeError('Referral example API is not simulation-only')

    lease.acquire()
    switched_by_this_operation = False
    try:
        if action == '--stage':
            if current() != PRIOR:
                raise RuntimeError('Current backend changed; re-audit before staging')
            dirs = sorted({str(Path(name).parent).replace('\\', '/') for name in manifest})
            py("from pathlib import Path\np=Path(" + repr(TARGET) + ")\nassert p.parent.resolve()==Path('/opt/learning-platform/releases').resolve()\nassert not p.exists() and not p.is_symlink()\np.mkdir(mode=0o750)\nfor name in " + repr(dirs) + ":\n d=p/name;assert '..' not in Path(name).parts;d.mkdir(parents=True,exist_ok=True,mode=0o750)\n", label='new immutable release directory creation')
            with client.open_sftp() as sftp:
                for name, expected in manifest.items():
                    if sha(ROOT / name) != expected:
                        raise RuntimeError('Local source changed during staging')
                    sftp.put(str(ROOT / name), TARGET + '/' + name)
                    sftp.chmod(TARGET + '/' + name, 0o640)
                with sftp.file(TARGET + '/source-manifest.json', 'w') as file:
                    file.write(json.dumps(manifest))
                sftp.chmod(TARGET + '/source-manifest.json', 0o640)
            assert_manifest()
            py("import os,grp\nfrom pathlib import Path\np=Path(" + repr(TARGET) + ")\nassert p.parent==Path('/opt/learning-platform/releases') and not p.is_symlink()\ngid=grp.getgrnam('learningapp').gr_gid\nfor f in [p,*p.rglob('*')]:\n assert not f.is_symlink();os.chown(f,0,gid);os.chmod(f,0o750 if f.is_dir() else 0o640)\n", label='immutable source permissions')
            imports = "await import('file://" + TARGET + "/src/api.mjs');await import('file://" + TARGET + "/scripts/migrate-time-plan-production.mjs');console.log('API and migration helper imports resolved')"
            run('runuser -u learningapp -- ' + ' '.join(shlex.quote(x) for x in [NODE, '--input-type=module', '-e', imports]), label='low-privilege imports without executing a migration')
            result = {'stagedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'target': TARGET,
                      'prior': PRIOR, 'files': manifest, 'rehearsal': rehearsal, 'runningBackendChanged': False,
                      'productionDatabaseModified': False, 'staticWorkerChanged': False, 'seedPerformed': False}
        elif action == '--activate':
            if current() != PRIOR:
                raise RuntimeError('Current backend changed; activation refused')
            assert_manifest()
            baseline = probe()
            validate_live(baseline)
            triggered_at = float(run('date +%s', label='backup timestamp boundary').strip())
            run('systemctl start learning-platform-backup.service', timeout=300, label='fresh encrypted production backup')
            backup = json.loads(py("import json,hashlib,time,re\nfrom pathlib import Path\nb=json.loads(Path('/var/lib/learning-platform/operations/backup.json').read_text());assert b['success'] is True and b['serviceResumed'] is True\nassert re.fullmatch(r'learning-platform-[A-Za-z0-9-]+\\.lpbak',b['archive'])\np=Path('/var/backups/learning-platform')/b['archive'];assert p.is_file() and not p.is_symlink() and time.time()-p.stat().st_mtime<300 and p.stat().st_mtime>=" + repr(triggered_at - 5) + " and hashlib.sha256(p.read_bytes()).hexdigest()==b['sha256']\nr=json.loads(Path(str(p)+'.receipt.json').read_text());assert r['fullPayloadVerifiedAtCreation'] is True and r['sha256']==b['sha256'] and r['releaseVersion']=='20261115-referral-1'\nprint(json.dumps({'archive':b['archive'],'sha256':b['sha256'],'fullPayloadVerifiedAtCreation':True,'sourceRelease':r['releaseVersion'],'fresh':True}))\n", label='fresh backup receipt verification'))
            if current() != PRIOR:
                raise RuntimeError('Production changed during backup; activation refused')
            run('systemctl stop learning-platform.service', label='stop the learning-platform writer only')
            try:
                service_stopped()
                if current() != PRIOR:
                    raise RuntimeError('Production backend changed after writes stopped')
                before = capture()
                existing = sorted(n for n in before['allTables'] if n.startswith('time_plan'))
                if existing and existing != TIME_PLAN_TABLES:
                    raise RuntimeError('Unexpected pre-existing referral schema')
                if existing and any(before['tables'][n]['rows'] != 0 for n in existing):
                    raise RuntimeError('Referral data already exists; preserve it and re-audit this activation')
                command = [NODE, TARGET + '/scripts/migrate-time-plan-production.mjs', '--database', DATABASE]
                migrated = json.loads(run('runuser -u learningapp -- ' + ' '.join(shlex.quote(x) for x in command), label='additive referral migration without seeding'))
                if not (migrated.get('success') is True and migrated.get('originalTablesUnchanged') is True
                        and migrated.get('originalSchemasUnchanged') is True and migrated.get('seedPerformed') is False
                        and migrated.get('timePlanSchemaVerified') is True
                        and migrated.get('businessRowsCreated') == 0 and migrated.get('allTimePlanTablesEmpty') is True
                        and migrated.get('timePlanTables') == TIME_PLAN_TABLES):
                    raise RuntimeError('Unexpected referral migration result')
                service_stopped()
                after = capture(list(before['tables']))
                if before['tables'] != after['tables']:
                    raise RuntimeError('An original table, row or schema changed')
                if sorted(n for n in after['allTables'] if n.startswith('time_plan')) != TIME_PLAN_TABLES:
                    raise RuntimeError('Unexpected referral table inventory')
                if set(after['allTables']) - set(before['allTables']) - set(TIME_PLAN_TABLES):
                    raise RuntimeError('An unrelated new table appeared')
                if any(row['rows'] != 0 for row in capture(TIME_PLAN_TABLES)['tables'].values()):
                    raise RuntimeError('Referral data was seeded unexpectedly')
                if current() != PRIOR:
                    raise RuntimeError('Concurrent code switch detected')
                switch(TARGET, PRIOR)
                switched_by_this_operation = True
                run('systemctl start learning-platform.service', label='start the new referral backend')
                checks = probe(include_referral=True)
                validate_live(checks, baseline, referral=True)
                if any(row['rows'] != 0 for row in capture(TIME_PLAN_TABLES)['tables'].values()):
                    raise RuntimeError('Public or anonymous startup probes created referral records')
                result = {'activatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'target': TARGET,
                          'prior': PRIOR, 'backup': backup, 'rehearsal': rehearsal, 'migration': migrated,
                          'oldTableSnapshots': before['tables'], 'allOriginalTablesUnchanged': True,
                          'allTimePlanTablesInitiallyEmpty': True, 'checks': checks, 'comparisonClockFields': comparison_clock_fields(checks, baseline), 'seedPerformed': False,
                          'databaseReplaced': False, 'staticWorkerChanged': False, 'liveReferralEnabled': False}
            except Exception as error:
                recovery = {'attempted': True, 'backendLinkRestored': False, 'serviceStarted': False,
                            'checksPassed': False, 'databaseReplaced': False, 'timePlanTablesNotDropped': True}
                try:
                    link = current()
                    ensure_recovery_ownership(switched_by_this_operation, link)
                    if link == TARGET:
                        run('systemctl stop learning-platform.service', label='stop failed new backend before code-only rollback')
                        service_stopped()
                    retained_names = sorted(n for n in capture()['allTables'] if n.startswith('time_plan'))
                    retained = capture(retained_names)['tables']
                    if link == TARGET:
                        switch(PRIOR, TARGET)
                    recovery['backendLinkRestored'] = True
                    run('systemctl start learning-platform.service', label='restart previous backend without replacing database')
                    recovery['serviceStarted'] = True
                    if capture(retained_names)['tables'] != retained:
                        raise RuntimeError('Referral records changed during recovery')
                    recovery['referralDataPreserved'] = True
                    restored = probe()
                    validate_live(restored, baseline)
                    recovery['comparisonClockFields'] = comparison_clock_fields(restored, baseline)
                    recovery['checksPassed'] = True
                except Exception as recovery_error:
                    recovery['error'] = str(recovery_error)
                save_result('activate-failed', {'at': time.time(), 'error': str(error), 'backup': backup, 'recovery': recovery})
                raise
        else:
            if current() != TARGET:
                raise RuntimeError('Unknown current version; code rollback refused')
            run('systemctl stop learning-platform.service', label='stop learning writes for code-only rollback')
            retained = None
            try:
                service_stopped()
                if current() != TARGET:
                    raise RuntimeError('Concurrent code switch detected before rollback')
                retained = capture(TIME_PLAN_TABLES)['tables']
                switch(PRIOR, TARGET)
                switched_by_this_operation = True
            finally:
                expected = PRIOR if switched_by_this_operation else TARGET
                if current() != expected:
                    raise RuntimeError('Concurrent release ownership changed; no unknown backend was restarted')
                run('systemctl start learning-platform.service', label='restart learning backend after rollback attempt')
            if retained is None or capture(TIME_PLAN_TABLES)['tables'] != retained:
                raise RuntimeError('Referral records changed during rollback')
            result = {'rolledBackAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'backend': PRIOR,
                      'previousBackend': TARGET, 'referralDataPreserved': True, 'referralTableSnapshots': retained,
                      'productionDatabaseReplaced': False, 'timePlanTablesDropped': False, 'staticWorkerChanged': False}
            try:
                checks = probe()
                validate_live(checks)
                result['checks'] = checks
                result['checksPassed'] = True
            except Exception as error:
                result['checksPassed'] = False
                result['checkError'] = str(error)
                save_result('rollback', result)
                raise RuntimeError('Prior code restored and referral records preserved; post-rollback health needs attention') from error
    finally:
        try:
            lease.release()
        except Exception as lock_error:
            save_result('lock-release-failed', {'action': action[2:], 'operationId': operation_id, 'ownerMarkerRetained': True, 'error': str(lock_error)})
            raise
    result['operationId'] = operation_id
    result['operationLockReleased'] = True
    result['codeSwitchedByThisOperation'] = switched_by_this_operation
    save_result(action[2:], result)
    print(json.dumps({'action': action[2:], 'backend': result.get('target', result.get('backend')),
                      'files': len(manifest) if manifest else None, 'productionDatabaseReplaced': False,
                      'staticWorkerChanged': False, 'seedPerformed': False,
                      'allOriginalTablesUnchanged': result.get('allOriginalTablesUnchanged'),
                      'referralDataPreserved': result.get('referralDataPreserved'),
                      'migration': result.get('migration')}, ensure_ascii=False))
