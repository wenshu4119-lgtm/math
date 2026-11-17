import pathlib,subprocess,json,os
os.environ['LD_LIBRARY_PATH']='/opt/deeptutor-models/runtime-library/extracted/usr/lib/x86_64-linux-gnu'
binary='/opt/deeptutor-models/llama-b12375/llama-b12375/llama-server'
r=subprocess.run([binary,'--version'],capture_output=True,text=True)
print(json.dumps({'versionExit':r.returncode,'version':(r.stdout+r.stderr)[:800]}))
h=subprocess.run([binary,'--help'],capture_output=True,text=True)
lines=(h.stdout+h.stderr).splitlines()
need=['--api-key','--chat-template','--reasoning','--embedding','--pooling','--no-webui','--threads','--parallel','--ctx-size','--metrics','--no-warmup']
print(json.dumps({'flags':[l for l in lines if any(word in l for word in need)]}))
print(json.dumps({'bundledLicenseFiles':[str(p.relative_to('/opt/deeptutor-models')) for p in pathlib.Path('/opt/deeptutor-models/llama-b12375').rglob('*') if p.is_file() and ('LICENSE' in p.name.upper() or 'NOTICE' in p.name.upper())]}))
