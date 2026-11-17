"""Read-only deployed DeepTutor inspection. Never emits credentials or config values.

Uses the user's existing strict host-key SSH helper; no installation, service
mutation, document upload, model inference or embedding request is performed.
"""
import sys
sys.dont_write_bytecode = True
import argparse, json, subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--private-tools', required=True)
args = parser.parse_args()
tools = Path(args.private_tools).resolve()
if not (tools / 'ssh_task.py').is_file():
    raise SystemExit('Authorized SSH helper not found; nothing executed.')
sys.path.insert(0, str(tools))
from ssh_task import connect

remote = r'''
import json, pathlib, subprocess, urllib.request, urllib.error
root = pathlib.Path('/var/lib/deeptutor/runtime')
settings = root/'data/user/settings'
out = {'readOnly': True, 'modelRequests': 0, 'embeddingRequests': 0, 'uploadedDocuments': 0}
for name in ['deeptutor-backend', 'deeptutor-frontend']:
    p = subprocess.run(['systemctl','show',name,'--property=ActiveState,SubState,User,MemoryCurrent'],capture_output=True,text=True)
    out[name] = dict(line.split('=',1) for line in p.stdout.splitlines() if '=' in line)
catalog = settings/'model_catalog.json'
if catalog.is_file():
    obj = json.loads(catalog.read_text())
    out['modelCatalogShape'] = {str(k): {'type': type(v).__name__, 'count': len(v) if isinstance(v,(list,dict)) else None} for k,v in obj.items() if k=='version' or k.endswith('_profiles') or k in ['profiles','defaults','providers','provider_accounts']}
    def counts(v, prefix=''):
        rows = {}
        if isinstance(v,dict):
            for k,x in v.items():
                if (k.endswith('_profiles') or k in ['profiles','llm','task','embedding','search','models']) and isinstance(x,(list,dict)): rows[prefix+k]=len(x)
                if isinstance(x,dict): rows.update(counts(x,prefix+k+'.'))
        return rows
    out['modelProfileCounts'] = counts(obj)
out['authEnabled'] = bool(json.loads((settings/'auth.json').read_text()).get('enabled'))
out['settingsFiles'] = sorted(p.name for p in settings.glob('*.json'))
out['installedVersions'] = {}
for base in pathlib.Path('/opt/deeptutor').glob('**/site-packages'):
    for p in base.glob('deeptutor*.dist-info'):
        package, version = p.name.removesuffix('.dist-info').rsplit('-',1)
        out['installedVersions'][package] = version
for label, address in [('ready','http://127.0.0.1:8001/health/ready'),('frontend','http://127.0.0.1:3782/login'),('anonymousSettings','http://127.0.0.1:3782/api/settings'),('schema','http://127.0.0.1:8001/openapi.json')]:
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(address,timeout=12) as r:
            body = r.read(2_000_000)
            out[label] = {'httpStatus': r.status}
            if label == 'schema':
                schema = json.loads(body)
                paths = schema.get('paths',{})
                out['schemaInfo'] = {'title':schema.get('info',{}).get('title'),'version':schema.get('info',{}).get('version')}
                out['paths'] = {path:list(verbs.keys()) for path,verbs in paths.items() if any(word in path for word in ['health','knowledge','question','mastery','models','settings'])}
            if label == 'ready': out[label]['status'] = json.loads(body).get('status')
    except urllib.error.HTTPError as e: out[label] = {'httpStatus': e.code}
    except Exception: out[label] = {'error':'READ_FAILED'}
ss = subprocess.run(['ss','-lnt'],capture_output=True,text=True)
out['loopbackListeners'] = [line.split()[3] for line in ss.stdout.splitlines() if ':8001 ' in line or ':3782 ' in line]
print(json.dumps(out))
'''
try:
    with connect() as client:
        stdin, stdout, stderr = client.exec_command('python3 -B -', timeout=45)
        stdin.write(remote); stdin.channel.shutdown_write()
        payload = stdout.read(2_000_000).decode()
        code = stdout.channel.recv_exit_status()
        if code != 0:
            raise RuntimeError('remote inspection failed')
        report = json.loads(payload)
except Exception:
    raise SystemExit('Read-only inspection failed. No raw connection/configuration error is printed.')
target = Path(__file__).resolve().parents[2] / 'test-results/stage8/deeptutor-vps-readonly.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='paths'},ensure_ascii=False))
