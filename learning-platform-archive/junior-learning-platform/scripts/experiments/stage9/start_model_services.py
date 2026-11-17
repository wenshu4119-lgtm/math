import pathlib,subprocess,os,pwd,secrets,json,time,urllib.request,urllib.error
root=pathlib.Path('/opt/deeptutor-models');binary=root/'llama-b12375/llama-b12375/llama-server'
account=pwd.getpwnam('deeptutor');private=pathlib.Path('/var/lib/deeptutor/local-models')
private.mkdir(mode=0o700,exist_ok=True);os.chown(private,account.pw_uid,account.pw_gid);os.chmod(private,0o700)
keyfile=private/'inference.key'
if not keyfile.exists():
 with keyfile.open('x') as f:f.write(secrets.token_urlsafe(32)+'\n')
 os.chown(keyfile,account.pw_uid,account.pw_gid);os.chmod(keyfile,0o600)
key=keyfile.read_text().strip()
assert len(key)>32
units=[]
for kind,port,model,alias,extra in [
 ('llm',18081,'Qwen3-0.6B-Q8_0.gguf','stage9-qwen3-0.6b','--reasoning off --reasoning-budget 0 --n-predict 512'),
 ('embedding',18082,'Qwen3-Embedding-0.6B-Q8_0.gguf','stage9-qwen3-embedding-0.6b','--embedding --pooling last')]:
 name='deeptutor-local-'+kind+'.service'
 unit=f'''[Unit]
Description=DeepTutor isolated local {kind} (Stage 9, no paid API)
After=network.target

[Service]
User=deeptutor
Group=deeptutor
WorkingDirectory=/var/lib/deeptutor/local-models
Environment=LD_LIBRARY_PATH=/opt/deeptutor-models/runtime-library/extracted/usr/lib/x86_64-linux-gnu
ExecStart={binary} --model {root/model} --alias {alias} --host 127.0.0.1 --port {port} --api-key-file {keyfile} --ctx-size 2048 --threads 1 --threads-batch 1 --parallel 1 --threads-http 2 --batch-size 512 --ubatch-size 512 --no-warmup --no-webui --metrics {extra}
Restart=on-failure
RestartSec=10
Nice=15
CPUQuota=35%
MemoryHigh=800M
MemoryMax=950M
MemorySwapMax=0
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
CapabilityBoundingSet=
AmbientCapabilities=
RestrictSUIDSGID=true
UMask=0077

[Install]
WantedBy=multi-user.target
'''
 path=pathlib.Path('/etc/systemd/system')/name
 if path.exists() and path.read_text()!=unit:raise RuntimeError('Existing service differs; not overwriting')
 if not path.exists():
  with path.open('x') as f:f.write(unit)
 units.append(name)
subprocess.run(['systemctl','daemon-reload'],check=True,stdout=subprocess.DEVNULL)
for unit in units:subprocess.run(['systemctl','enable','--now',unit],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
out={}
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
for port in [18081,18082]:
 for attempt in range(40):
  try:
   with opener.open(f'http://127.0.0.1:{port}/health',timeout=2) as r:ready=r.status==200
   if ready:break
  except Exception:time.sleep(1)
 else:raise RuntimeError('Model service did not become ready')
 try:opener.open(f'http://127.0.0.1:{port}/v1/models',timeout=5);anonymous='unexpected_success'
 except urllib.error.HTTPError as e:anonymous=e.code
 req=urllib.request.Request(f'http://127.0.0.1:{port}/v1/models',headers={'Authorization':'Bearer '+key})
 with opener.open(req,timeout=5) as r:models=json.load(r)
 out[str(port)]={'ready':True,'anonymousModelsStatus':anonymous,'models':[m['id'] for m in models['data']]}
out['services']={}
for name in units+['junior-learning-trial.service','junior-learning-trial-tunnel.service','hostodo-proxy.service']:
 p=subprocess.run(['systemctl','show',name,'--property=ActiveState,MemoryCurrent,MemoryPeak,CPUQuotaPerSecUSec'],capture_output=True,text=True)
 out['services'][name]=dict(l.split('=',1) for l in p.stdout.splitlines() if '=' in l)
(private/'service-verification.json').write_text(json.dumps(out,indent=2));print(json.dumps(out),flush=True)
