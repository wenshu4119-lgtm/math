from pathlib import Path
import json,subprocess,shutil
import pdfplumber
from PIL import Image,ImageDraw
folder=Path(__file__).resolve().parents[1]/'test-results/remote'
rendered=folder/'rendered';rendered.mkdir(exist_ok=True)
results=[]
for file in sorted(folder.glob('live-*.pdf')):
 with pdfplumber.open(file)as pdf:
  text=''.join((p.extract_text()or'')for p in pdf.pages)
  assert '智学方舟' in text and '\ufffd' not in text
  for p in pdf.pages:
   assert abs(p.width-595.28)<1 and abs(p.height-841.89)<1
   assert all(-1<=c['x0']<=c['x1']<=p.width+1 and -1<=c['top']<=c['bottom']<=p.height+1 for c in p.chars)
  if 'parent'in file.name:assert 'PUBLIC_QA_SUMMARY'in text and 'PRIVATE_QA'not in text
  if 'teacher'in file.name:assert '2.5 / 5'in text or '2.5/5'in text
  results.append({'file':file.name,'pages':len(pdf.pages),'a4':True,'chinese':True})
 subprocess.run([shutil.which('pdftoppm'),'-png','-r','95',str(file),str(rendered/file.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
files=sorted(rendered.glob('*.png'));sheet=Image.new('RGB',(1280,620*((len(files)+3)//4)),'#dbe5ea');draw=ImageDraw.Draw(sheet)
for i,file in enumerate(files):
 im=Image.open(file).convert('RGB');im.thumbnail((300,570));x=(i%4)*320+10;y=(i//4)*620+30;sheet.paste(im,(x,y));draw.text((x,y-20),file.name,fill='black')
sheet.save(folder/'pdf-contact.png')
(folder/'pdf-validation.json').write_text(json.dumps(results,indent=2))
print(json.dumps({'pdfs':len(results),'pages':sum(r['pages']for r in results),'checks':'A4 Chinese page bounds parent privacy partial score'}))
