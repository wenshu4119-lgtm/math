import pathlib,subprocess,json,urllib.request,urllib.error,hashlib
private=pathlib.Path('/var/lib/deeptutor/local-models');catalog=json.loads(pathlib.Path('/var/lib/deeptutor/runtime/data/user/settings/model_catalog.json').read_text())
out={'services':{},'profiles':{},'loopbackModelEndpoints':[], 'websiteFilesModifiedByThisTask':False}
for name in ['deeptutor-local-llm','deeptutor-local-embedding','deeptutor-backend','deeptutor-frontend','junior-learning-trial','junior-learning-trial-tunnel','hostodo-proxy']:
 p=subprocess.run(['systemctl','show',name,'--property=ActiveState,MemoryCurrent,MemoryPeak,NRestarts,ExecMainStartTimestamp'],capture_output=True,text=True);out['services'][name]=dict(l.split('=',1) for l in p.stdout.splitlines() if '=' in l)
for name in ['llm','task','embedding']:
 entry=catalog['services'][name];p=next(p for p in entry['profiles'] if p['id']==entry['active_profile_id']);out['profiles'][name]={'profileId':p['id'],'apiFormat':p.get('api_format'),'models':[m['model'] for m in p['models']],'localOnly':p['base_url'].startswith('http://127.0.0.1:'),'credentialPresent':bool(p.get('api_key'))}
out['loopbackModelEndpoints']=[line.split()[3] for line in subprocess.check_output(['ss','-lnt'],text=True).splitlines() if ':18081 ' in line or ':18082 ' in line]
mem=dict(line.split(':',1) for line in pathlib.Path('/proc/meminfo').read_text().splitlines());out['memAvailableKiB']=int(mem['MemAvailable'].split()[0])
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
for name,url in [('websiteHealth','http://127.0.0.1:8791/api/v1/health'),('deepTutorReady','http://127.0.0.1:8001/health/ready')]:
 try:
  with opener.open(url,timeout=10) as r:out[name]={'status':r.status,'body':json.load(r)}
 except urllib.error.HTTPError as e:out[name]={'status':e.code}
 except Exception:out[name]={'error':'READ_FAILED'}
key=(private/'inference.key').read_text().strip()
out['modelMetrics']={}
for port in [18081,18082]:
 request=urllib.request.Request(f'http://127.0.0.1:{port}/metrics',headers={'Authorization':'Bearer '+key})
 try:
  with opener.open(request,timeout=10) as r:lines=r.read().decode().splitlines()
  out['modelMetrics'][str(port)]=[l for l in lines if not l.startswith('#') and any(k in l for k in ['tokens_total','requests','prompt_tokens','predicted_tokens'])]
 except Exception:out['modelMetrics'][str(port)]={'status':'UNAVAILABLE'}
backup=private/'model_catalog.before-stage9.json';out['originalCatalogBackupSha256']=hashlib.sha256(backup.read_bytes()).hexdigest()
out['outputFiles']=[p.name for p in private.glob('*.json')]
(private/'final-audit.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
