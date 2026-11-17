import sys,json
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1]
gates=json.loads((root/'release/production-gates.json').read_text());check=json.loads((root/'release/linux-upload-verification.json').read_text());backup=json.loads((root/'release/production-backup-verification.json').read_text())
assert gates['uploadPermissionRaceResolved']and check['pass']==25 and backup['encryptedBackupVerified']
with connect()as c:
 script="""import json,os,subprocess,urllib.request,time
from pathlib import Path
p=Path('/etc/learning-platform/runtime.json');cfg=json.loads(p.read_text());assert cfg['APP_ENV']=='production'and cfg['APP_ORIGIN']=='https://mrxu.uk'and cfg['DATA_DIRECTORY']=='/var/lib/learning-platform/data'
cfg['ENABLE_PRIVATE_UPLOADS']='true';tmp=p.with_suffix('.pending');tmp.write_text(json.dumps(cfg));os.chmod(tmp,0o640);subprocess.run(['chown','root:learningapp',str(tmp)],check=True);tmp.replace(p)
subprocess.run(['systemctl','restart','learning-platform.service'],check=True)
for i in range(20):
 try:
  r=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8792/api/v1/health',headers={'X-Trial-Bridge':cfg['BRIDGE_SECRET']}),timeout=3)
  assert r.status==200;break
 except Exception:time.sleep(.2)
else:raise RuntimeError('Backend health failed after upload enable')
print(json.dumps({'privateStorageEnabled':True,'health':200}))
"""
 stdin,out,err=c.exec_command("python3 - <<'PY'\n"+script+"\nPY",timeout=60);stdin.close();result=out.read().decode();code=out.channel.recv_exit_status();assert code==0,'Configuration health failed';print(result)
local=root/'.local/production/runtime.json';cfg=json.loads(local.read_text());cfg['ENABLE_PRIVATE_UPLOADS']='true';local.write_text(json.dumps(cfg))
