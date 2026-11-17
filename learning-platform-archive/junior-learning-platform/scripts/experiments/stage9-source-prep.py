"""Inspect pinned official artifacts and extract selected wheel source; no model calls."""
import json,urllib.request,zipfile,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'.local/stage9';out.mkdir(parents=True,exist_ok=True)
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'junior-learning-research'})
 with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
models=[]
for repo in ['Qwen/Qwen3-0.6B-GGUF','Qwen/Qwen3-Embedding-0.6B-GGUF']:
 info=get('https://huggingface.co/api/models/'+repo)
 tree=get('https://huggingface.co/api/models/'+repo+'/tree/'+info['sha'])
 models.append({'repo':repo,'revision':info['sha'],'license':info.get('cardData',{}).get('license'),'files':[x for x in tree if x.get('path','').endswith('.gguf') or x.get('path') in ['README.md','LICENSE']]})
(out/'models-metadata.json').write_text(json.dumps(models,indent=2),encoding='utf-8')
print(json.dumps([{'repo':m['repo'],'revision':m['revision'],'license':m['license'],'files':[{'path':f['path'],'size':f.get('size'),'sha256':f.get('lfs',{}).get('oid')} for f in m['files']]} for m in models]))
selected=[]
for wheel in Path('C:/Users/Administrator/DeepTutorPrep').glob('deeptutor*.whl'):
 with zipfile.ZipFile(wheel) as z:
  for name in z.namelist():
   if name.endswith('.py') and (name.startswith('deeptutor/services/config/model_catalog') or name.startswith('deeptutor/services/embedding') or name.startswith('deeptutor/services/llm') or name in ['deeptutor/api/routers/knowledge.py','deeptutor/services/config/readiness.py','deeptutor/knowledge/manager.py'] or name.startswith('deeptutor/services/rag/pipelines/llamaindex/')):
    p=out/'source'/name;p.parent.mkdir(parents=True,exist_ok=True)
    data=z.read(name)
    if p.exists() and p.read_bytes()!=data:raise RuntimeError('Existing reference differs; preserve and stop.')
    if not p.exists():p.write_bytes(data)
    selected.append({'path':name,'sha256':hashlib.sha256(data).hexdigest(),'wheel':wheel.name})
(out/'source-hashes.json').write_text(json.dumps(selected,indent=2),encoding='utf-8')
print(json.dumps({'sourceFiles':len(selected)}))
