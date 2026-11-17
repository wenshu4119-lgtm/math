import pathlib,json,hashlib,urllib.request
root=pathlib.Path('/var/lib/deeptutor/runtime');paths=[p for p in root.glob('**/stage9-synthetic-20261114') if p.is_dir() and p.parent.name=='knowledge_bases'];assert len(paths)==1
kb=paths[0];files=[]
for p in kb.rglob('*'):
 if p.is_file() and 'version-' in str(p):files.append({'file':str(p.relative_to(kb)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
from deeptutor.services.rag.pipelines.llamaindex.config import retrieval_config_from_settings
try:settings=str(retrieval_config_from_settings())
except Exception:settings='inspect actual configuration separately'
report={'kbName':kb.name,'indexFiles':files,'retrievalSettings':settings,'sourceReferenceLimit':'TXT has file_path/file_name, not native page digest metadata.'}
pathlib.Path('/var/lib/deeptutor/local-models/index-evidence.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
