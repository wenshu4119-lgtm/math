import sys,json,hashlib,time,re
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1]
target='/opt/junior-learning-trial'
tooling=json.loads((root/'.local/vps/tooling.json').read_text())
service='''[Unit]
Description=Isolated learning platform trial backend
After=network.target
[Service]
Type=simple
User=jltrial
Group=jltrial
WorkingDirectory=/opt/junior-learning-trial
ExecStart=/opt/junior-learning-trial/tools/node/bin/node --disable-warning=ExperimentalWarning /opt/junior-learning-trial/release/vps-server.mjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/junior-learning-trial/data
MemoryMax=512M
CPUQuota=50%
UMask=0077
[Install]
WantedBy=multi-user.target
'''
tunnel='''[Unit]
Description=Temporary learning trial tunnel (no production domain)
After=network-online.target junior-learning-trial.service
Wants=network-online.target
[Service]
Type=simple
User=nobody
Group=nogroup
Environment=HOME=/tmp
ExecStart=/opt/junior-learning-trial/tools/cloudflared tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:8791
Restart=on-failure
RestartSec=10
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
MemoryMax=192M
CPUQuota=25%
[Install]
WantedBy=multi-user.target
'''
with connect() as client:
 def run(command):
  stdin,stdout,stderr=client.exec_command(command,timeout=180);stdin.close();out=stdout.read().decode();err=stderr.read().decode();code=stdout.channel.recv_exit_status()
  if code:raise RuntimeError('Isolated deployment command failed; no other services changed: '+err[:150])
  return out
 run(f'test ! -e {target} && mkdir -m 755 {target}')
 run(f'useradd --system --no-create-home --home-dir {target} --shell /usr/sbin/nologin jltrial')
 run(f'mkdir -p {target}/src {target}/scripts {target}/release {target}/tools {target}/private {target}/data')
 with client.open_sftp() as sftp:
  files=[(p,f'{target}/src/{p.name}')for p in(root/'src').glob('*.mjs')]
  files += [(root/'scripts/local-db.mjs',target+'/scripts/local-db.mjs'),(root/'release/vps-server.mjs',target+'/release/vps-server.mjs'),(root/'.local/vps/learning.sqlite',target+'/data/learning.sqlite'),(root/'.local/vps/runtime.json',target+'/private/runtime.json')]
  for p,dest in files:sftp.put(str(p),dest);sftp.chmod(dest,0o600 if '/private/'in dest or '/data/'in dest else 0o640)
  for file in tooling['files']:
   print('Uploading verified runtime: '+file['name'],flush=True);sftp.put(str(root/'.local/tools'/file['name']),target+'/tools/'+file['name'])
  for name,value in [('junior-learning-trial.service',service),('junior-learning-trial-tunnel.service',tunnel)]:
   with sftp.file('/etc/systemd/system/'+name,'w')as f:f.write(value)
 for file in tooling['files']:
  actual=run(f"sha256sum {target}/tools/{file['name']}").split()[0]
  if actual!=file['hash']:raise RuntimeError('Server runtime checksum mismatch')
 nodeFolder=tooling['nodeArchive'].removesuffix('.tar.xz')
 run(f'tar -xJf {target}/tools/{tooling["nodeArchive"]} -C {target}/tools && ln -s {nodeFolder} {target}/tools/node && chmod 755 {target}/tools/cloudflared-linux-amd64 && ln -s cloudflared-linux-amd64 {target}/tools/cloudflared')
 run(f'chown -R root:jltrial {target}/src {target}/scripts {target}/release && chmod 750 {target}/src {target}/scripts {target}/release && chown -R jltrial:jltrial {target}/private {target}/data && chmod 700 {target}/private {target}/data && chmod 600 {target}/private/runtime.json {target}/data/learning.sqlite')
 run('systemctl daemon-reload && systemctl enable --now junior-learning-trial.service junior-learning-trial-tunnel.service')
 tunnelOrigin=None
 for attempt in range(18):
  log=run('journalctl -u junior-learning-trial-tunnel.service --no-pager -n 60 -o cat')
  urls=re.findall(r'https://[a-z0-9-]+\.trycloudflare\.com',log)
  if urls:tunnelOrigin=urls[-1];break
  time.sleep(2)
 if not tunnelOrigin:raise RuntimeError('Trial tunnel URL not ready; existing services untouched')
 statuses=run('systemctl is-active junior-learning-trial.service junior-learning-trial-tunnel.service deeptutor-backend.service deeptutor-frontend.service hostodo-proxy.service').splitlines()
 result={'backendOrigin':tunnelOrigin,'services':statuses,'nodeVersion':tooling['nodeVersion'],'path':target,'temporaryTunnel':True}
 (root/'.local/vps/deployment-status.json').write_text(json.dumps(result,indent=2))
 print(json.dumps({'newTrialServicesActive':statuses[:2]==['active','active'],'existingServicesActive':statuses[2:]==['active']*3,'temporaryTunnelReady':True}))
