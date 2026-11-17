"""Run one checked-in Stage 9 Python operation via the existing pinned SSH channel."""
import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import argparse,json
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
p=argparse.ArgumentParser();p.add_argument('file');p.add_argument('--ordinary',action='store_true');args=p.parse_args()
folder=Path(__file__).resolve().parent/'stage9';file=Path(args.file).resolve()
if not file.is_relative_to(folder.resolve()) or file.suffix!='.py':raise SystemExit('Only this task stage9 Python operations are accepted.')
command='python3 -u -B -'
if args.ordinary:command='runuser -u deeptutor -- env PYTHONDONTWRITEBYTECODE=1 DEEPTUTOR_HOME=/var/lib/deeptutor/runtime DEEPTUTOR_WORKSPACE_ROOT=/var/lib/deeptutor/runtime/content /opt/deeptutor/venv/bin/python -u -B -'
try:
 with connect() as client:
  stdin,stdout,stderr=client.exec_command(command,timeout=600);stdin.write(file.read_text(encoding='utf-8'));stdin.channel.shutdown_write()
  for line in stdout:
   # Operations emit deliberate JSON evidence; third-party logging is withheld.
   try:obj=json.loads(line)
   except Exception:continue
   print(json.dumps(obj,ensure_ascii=False),flush=True)
  code=stdout.channel.recv_exit_status()
  if code:raise RuntimeError('remote operation failed')
except Exception:raise SystemExit('Stage9 operation failed; raw remote exception/config values withheld.')
