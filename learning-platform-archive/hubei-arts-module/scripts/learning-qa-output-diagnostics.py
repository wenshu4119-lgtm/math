"""Preserve actual outputs for three synthetic regression questions, never learner input."""
import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import json
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1];code=(root/'integrations/learning-qa/bridge.py').read_text(encoding='utf-8')
remote="namespace={'__name__':'qa_diagnostics'}\nexec("+repr(code)+",namespace)\n"+r'''
import asyncio,json
original=namespace['validate_output']
def diagnostic(raw,subject,scope):
 accepted=original(raw,subject,scope)
 print(json.dumps({'stage':'raw-validation','subject':subject,'expected':scope.get('expected'),'rawOutput':raw,'accepted':accepted is not None,'syntheticRegressionOnly':True},ensure_ascii=False),flush=True)
 return accepted
namespace['validate_output']=diagnostic
async def main():
 for subject,question in [('math','解方程 3x + 4 = 19，怎样检验这个解？'),('math','计算 3 + 4 * 2，请说明运算顺序。'),('english','一般现在时，She ___ a student，am、is、are应该选哪个？')]:
  result=await namespace['answer_question'](subject,question)
  print(json.dumps({'stage':'result','question':question,'result':result},ensure_ascii=False),flush=True)
asyncio.run(main())
'''
with connect() as client:
 command='runuser -u deeptutor -- env PYTHONDONTWRITEBYTECODE=1 DEEPTUTOR_HOME=/var/lib/deeptutor/runtime DEEPTUTOR_WORKSPACE_ROOT=/var/lib/deeptutor/runtime/content /opt/deeptutor/venv/bin/python -u -B -'
 stdin,stdout,stderr=client.exec_command(command,timeout=600);stdin.write(remote);stdin.channel.shutdown_write();events=[]
 for line in stdout:
  try:row=json.loads(line)
  except Exception:continue
  events.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
 status=stdout.channel.recv_exit_status()
 target=root/'test-results/learning-qa/output-diagnostics.json';target.write_text(json.dumps({'exitCode':status,'events':events,'syntheticOnly':True,'realModelExecution':True},ensure_ascii=False,indent=2),encoding='utf-8')
 if status:raise SystemExit('Real diagnostics failed; raw remote errors withheld.')
