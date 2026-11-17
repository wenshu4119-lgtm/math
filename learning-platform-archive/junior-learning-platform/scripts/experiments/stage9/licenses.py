import pathlib,urllib.request,hashlib,json
root=pathlib.Path('/opt/deeptutor-models/licenses');root.mkdir(exist_ok=True)
sources={
 'Qwen-generation-LICENSE.txt':'https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/23749fefcc72300e3a2ad315e1317431b06b590a/LICENSE',
 'Qwen-embedding-model-card.md':'https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF/resolve/370f27d7550e0def9b39c1f16d3fbaa13aa67728/README.md',
 'Qwen-generation-model-card.md':'https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/23749fefcc72300e3a2ad315e1317431b06b590a/README.md'}
report=[]
for name,url in sources.items():
 with urllib.request.urlopen(url,timeout=20) as r:data=r.read(100000)
 path=root/name
 if path.exists() and path.read_bytes()!=data:raise RuntimeError('License artifact changed; preserve original')
 if not path.exists():path.write_bytes(data)
 report.append({'file':name,'url':url,'sha256':hashlib.sha256(data).hexdigest()})
report.append({'bundledLlamaLicense':'/opt/deeptutor-models/llama-b12375/llama-b12375/LICENSE','runtimeLibraryCopyright':'/opt/deeptutor-models/runtime-library/extracted/usr/share/doc/libgomp1/copyright'})
(root/'manifest.json').write_text(json.dumps(report,indent=2));print(json.dumps({'licenseFilesPreserved':len(sources),'llamaLicense':'MIT','modelsLicense':'Apache-2.0','runtimeLibrary':'GCC runtime exception; original Debian copyright retained'}))
