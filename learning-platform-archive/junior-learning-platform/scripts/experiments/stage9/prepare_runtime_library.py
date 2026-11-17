import subprocess,pathlib,json,hashlib
root=pathlib.Path('/opt/deeptutor-models');binary=root/'llama-b12375/llama-b12375/llama-server'
r=subprocess.run(['ldd',str(binary)],capture_output=True,text=True)
missing=[line.strip() for line in r.stdout.splitlines() if 'not found' in line]
print(json.dumps({'missingLibraries':missing}))
if missing and all(line.startswith('libgomp.so.1 ') for line in missing):
 metadata=subprocess.check_output(['apt-cache','show','--no-all-versions','libgomp1'],text=True)
 fields=dict(line.split(': ',1) for line in metadata.splitlines() if ': ' in line and not line.startswith(' '))
 if not fields.get('SHA256') or fields.get('Architecture')!='amd64':raise RuntimeError('No verified native libgomp package metadata')
 folder=root/'runtime-library';folder.mkdir(exist_ok=True)
 subprocess.run(['apt-get','download','libgomp1='+fields['Version']],cwd=folder,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 packages=list(folder.glob('libgomp1_*_amd64.deb'));assert len(packages)==1
 package=packages[0];assert hashlib.file_digest(package.open('rb'),'sha256').hexdigest()==fields['SHA256']
 dest=folder/'extracted'
 if not dest.exists():subprocess.run(['dpkg-deb','--extract',str(package),str(dest)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 (folder/'package-verification.json').write_text(json.dumps({k:fields[k] for k in ['Package','Version','Architecture','SHA256','Filename']}))
 print(json.dumps({'privateLibraryExtracted':True,'package':fields['Package'],'version':fields['Version'],'sha256':fields['SHA256'],'systemPackageInstalled':False}))
elif missing:raise RuntimeError('Different missing runtime libraries need inspection')
