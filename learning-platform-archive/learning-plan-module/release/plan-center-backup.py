"""Fresh backup via existing service, then download only its authenticated archive.
No database replacement or credentials are printed. Existing backups are retained.
"""
import sys,json,hashlib,re,uuid
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,r'C:\Users\Administrator\HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1]
client=connect()
try:
    def run(command):
        _,out,err=client.exec_command(command,timeout=60)
        value=out.read().decode();error=err.read().decode();code=out.channel.recv_exit_status()
        if code:raise RuntimeError('Backup preflight/service failed: '+error[:500])
        return value
    preflight="from pathlib import Path\np=Path('/opt/learning-platform/current').resolve()\nassert str(p)=='/opt/learning-platform/releases/20261115-plan-1'\nassert not Path('/var/lock/learning-platform-deploy-owner.json').exists()\nprint('ready')"
    run("python3 - <<'PY'\n"+preflight+"\nPY")
    run('systemctl start learning-platform-backup.service')
    metadata=json.loads(run("python3 - <<'PY'\nfrom pathlib import Path\nimport json\nr=json.loads(Path('/var/lib/learning-platform/operations/backup.json').read_text())\nassert r['success'] and r['serviceResumed']\nprint(json.dumps(r))\nPY"))
    name=metadata['archive'];assert re.fullmatch(r'learning-platform-[A-Za-z0-9-]+\.lpbak',name)
    dest=(root/'.local/production/backups').resolve();dest.mkdir(parents=True,exist_ok=True);assert dest.is_relative_to(root)
    target=dest/name;part=dest/(name+'.'+uuid.uuid4().hex+'.part')
    with client.open_sftp() as sftp:
        sftp.get('/var/backups/learning-platform/'+name,str(part))
        receipt=json.loads(sftp.file('/var/backups/learning-platform/'+name+'.receipt.json','r').read().decode())
    digest=hashlib.sha256(part.read_bytes()).hexdigest();assert digest==metadata['sha256']==receipt['sha256'];assert receipt['fullPayloadVerifiedAtCreation'] and receipt['releaseVersion']=='20261115-plan-1'
    if target.exists():assert hashlib.sha256(target.read_bytes()).hexdigest()==digest
    else:part.replace(target)
    (dest/(name+'.receipt.json')).write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    (root/'.local/production/backup-downloads.json').write_text(json.dumps([{'name':name,'sha256':digest,'bytes':target.stat().st_size}]),encoding='utf-8')
    print(json.dumps({'archive':name,'verifiedEncryptedHash':digest,'serviceResumed':True,'previousBackupsRetained':True}))
finally:client.close()
