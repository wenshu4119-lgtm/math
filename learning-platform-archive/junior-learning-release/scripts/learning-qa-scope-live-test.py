"""Execute tightened scope rules on the VPS without changing the installed service."""
import sys
sys.dont_write_bytecode=True
sys.stdout.reconfigure(encoding='utf-8')
import json,hashlib,importlib.util
from pathlib import Path
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('qa_scope_cases',root/'tests/learning_qa_bridge_test.py');cases=importlib.util.module_from_spec(spec);spec.loader.exec_module(cases)
code=(root/'integrations/learning-qa/bridge.py').read_text(encoding='utf-8')
remote="namespace={'__name__':'qa_scope_remote'}\nexec("+repr(code)+",namespace)\nPOSITIVE="+repr(cases.POSITIVE)+"\nNEGATIVE="+repr(cases.NEGATIVE)+"\n"+r'''
import asyncio,json,logging
entered_model_path=0
def forbidden_model_path(*args,**kwargs):
 global entered_model_path
 entered_model_path+=1
 raise AssertionError('A rejected query must not enter model configuration, retrieval or inference')
namespace['check_local_configuration']=forbidden_model_path
async def main():
 positives=[];negatives=[]
 for subject,question in POSITIVE:
  scope=namespace['classify'](subject,question)
  assert scope.get('source')
  positives.append({'subject':subject,'question':question,'source':scope['source']})
 for subject,question in NEGATIVE:
  result=await namespace['answer_question'](subject,question)
  assert result['outcome']=='refused' and result['modelCalls']==0 and result['answer'] is None
  negatives.append({'subject':subject,'question':question,'reason':result['reason'],'modelCalls':result['modelCalls']})
 assert entered_model_path==0
 assert logging.root.manager.disable>=100
 print(json.dumps({'positiveScopeAccepted':len(positives),'negativeScopeRejected':len(negatives),'modelPathEntries':entered_model_path,'inferenceCalls':0,'queryLoggingDisabled':True,'positiveCases':positives,'negativeCases':negatives,'installedServiceChanged':False,'notice':'Finite regression set only; not a claim of perfect general classification.'},ensure_ascii=False))
asyncio.run(main())
'''
with connect() as client:
 command='runuser -u deeptutor -- env PYTHONDONTWRITEBYTECODE=1 /opt/deeptutor/venv/bin/python -u -B -'
 stdin,stdout,stderr=client.exec_command(command,timeout=60);stdin.write(remote);stdin.channel.shutdown_write();raw=stdout.read();status=stdout.channel.recv_exit_status()
 if status:raise SystemExit('Real VPS scope regression failed; no service was changed.')
 result=json.loads(raw);result['bridgeSha256']=hashlib.sha256(code.encode()).hexdigest()
 target=root/'test-results/learning-qa/scope-regression-v2.json';target.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({k:v for k,v in result.items() if k not in ['positiveCases','negativeCases']},ensure_ascii=False))
