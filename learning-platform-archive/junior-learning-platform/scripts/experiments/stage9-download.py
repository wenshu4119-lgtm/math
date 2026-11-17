"""Download only fixed public model/binary artifacts over TLS; verify before use."""
import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import json
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[2];lock=json.loads((Path(__file__).with_name('stage9-artifacts.json')).read_text())
remote=r'''
import json, pathlib, hashlib, urllib.request, tarfile, time
lock=LOCK_LITERAL
root=pathlib.Path('/opt/deeptutor-models');root.mkdir(mode=0o755,exist_ok=True)
marker=root/'stage9-artifacts.json'
if marker.exists() and json.loads(marker.read_text())!=lock:raise RuntimeError('Existing model directory belongs to another configuration')
if not marker.exists():marker.write_text(json.dumps(lock,indent=2))
files=[{'name':'llama-b12375-bin-ubuntu-x64.tar.gz',**lock['llama']}]+[{**m,'url':'https://huggingface.co/'+m['repo']+'/resolve/'+m['revision']+'/'+m['name']} for m in lock['models']]
for f in files:
 target=root/f['name']
 if target.exists():
  if target.stat().st_size==f['size'] and hashlib.file_digest(target.open('rb'),'sha256').hexdigest()==f['sha256']:
   print(json.dumps({'artifact':f['name'],'verified':'existing'}),flush=True);continue
  raise RuntimeError('Existing artifact mismatch; kept for inspection')
 part=target.with_suffix(target.suffix+'.partial')
 if part.exists():raise RuntimeError('Partial file preserved; inspect before retry')
 print(json.dumps({'artifact':f['name'],'stage':'downloading','expectedBytes':f['size']}),flush=True)
 request=urllib.request.Request(f['url'],headers={'User-Agent':'junior-learning-stage9'})
 h=hashlib.sha256();n=0;last=time.monotonic()
 with urllib.request.urlopen(request,timeout=45) as r,part.open('xb') as stream:
  while True:
   data=r.read(1024*1024)
   if not data:break
   n+=len(data)
   if n>f['size']:raise RuntimeError('Unexpected artifact size')
   h.update(data);stream.write(data)
   if time.monotonic()-last>15:print(json.dumps({'artifact':f['name'],'receivedMiB':n//1048576}),flush=True);last=time.monotonic()
 if n!=f['size'] or h.hexdigest()!=f['sha256']:raise RuntimeError('Artifact hash mismatch; nothing executed')
 part.rename(target);target.chmod(0o644);print(json.dumps({'artifact':f['name'],'verified':True}),flush=True)
archive=root/files[0]['name'];destination=root/'llama-b12375'
if not destination.exists():
 destination.mkdir()
 with tarfile.open(archive) as t:t.extractall(destination,filter='data')
print(json.dumps({'binaryCandidates':[str(p) for p in destination.rglob('llama-server')]}),flush=True)
'''.replace('LOCK_LITERAL',repr(lock))
try:
 with connect() as client:
  stdin,stdout,stderr=client.exec_command('python3 -u -B -',timeout=600);stdin.write(remote);stdin.channel.shutdown_write()
  for line in stdout:print(line.strip(),flush=True)
  code=stdout.channel.recv_exit_status()
  if code:raise RuntimeError('download failed')
except Exception:raise SystemExit('Fixed-artifact download failed; partial files preserved and raw remote errors withheld.')
