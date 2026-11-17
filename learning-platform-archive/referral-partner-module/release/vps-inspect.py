import sys,json
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import run
command="""uname -m
command -v node || true
node --version 2>/dev/null || true
command -v cloudflared || true
free -m
df -h /opt
ss -ltn | head -15
test ! -e /opt/junior-learning-trial && echo TRIAL_PATH_UNUSED
systemctl list-units --type=service --state=running --no-pager | grep -E 'deep|proxy|tunnel|nginx|caddy' || true
"""
code,out,err=run(command)
print(out)
if code:raise SystemExit('VPS read-only check failed')
