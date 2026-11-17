"""No-model security regression. Contract tests are explicitly not model evidence."""
import sys
sys.dont_write_bytecode=True
import asyncio,importlib.util,json,pathlib,threading,unittest,urllib.request,urllib.error,uuid
path=pathlib.Path(__file__).resolve().parents[1]/'integrations/deeptutor-lab/bridge.py'
spec=importlib.util.spec_from_file_location('bridge',path);bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
class BridgeTests(unittest.TestCase):
 def test_wrong_english_answer_is_blocked(self):
  self.assertFalse(bridge.validate_answer(json.dumps({'answer':'am','explanation':'She takes is.'}),'english-be'))
  self.assertTrue(bridge.validate_answer(json.dumps({'answer':'is','explanation':'She takes is.'}),'english-be'))
 def test_math_check_is_fixed_not_general_grading(self):
  self.assertFalse(bridge.validate_answer(json.dumps({'answer':'7','explanation':'unsupported'}),'math-equation'))
  self.assertTrue(bridge.validate_answer(json.dumps({'answer':'3','explanation':'Subtract 2.'}),'math-equation'))
 def test_outside_scope_does_not_load_models_or_sources(self):
  original=bridge.check_local_configuration
  bridge.check_local_configuration=lambda: (_ for _ in ()).throw(AssertionError('must not load a model'))
  try:
   result=asyncio.run(bridge.run_preset('outside-scope'))
   self.assertEqual(result['modelCalls'],0);self.assertEqual(result['outcome'],'no_match');self.assertIsNone(result['answer'])
  finally:bridge.check_local_configuration=original
 def test_private_http_boundary_and_arbitrary_input_rejection(self):
  server=bridge.LabServer(('127.0.0.1',0),'T'*43)
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  base=f'http://127.0.0.1:{server.server_address[1]}'
  try:
   with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(base+'/status')
   self.assertEqual(error.exception.code,404)
   for body in [{'jobId':str(uuid.uuid4()),'preset':'arbitrary'},{'jobId':str(uuid.uuid4()),'preset':'english-be','text':'private data'}]:
    req=urllib.request.Request(base+'/jobs',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+'T'*43,'Content-Type':'application/json'})
    with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(req)
    self.assertEqual(error.exception.code,400)
   self.assertEqual(len(server.jobs),0)
  finally:server.shutdown();server.server_close()
if __name__=='__main__':unittest.main()
