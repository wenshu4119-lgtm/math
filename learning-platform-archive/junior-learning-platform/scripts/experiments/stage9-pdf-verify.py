from pathlib import Path
import json,subprocess,shutil
import pdfplumber
from pypdf import PdfReader,PdfWriter
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
root=Path(__file__).resolve().parents[2];folder=root/'test-results/stage9/pdf';reports=[]
pdfmetrics.registerFont(TTFont('Sample','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
for file in sorted(folder.glob('*-pending.pdf')):
 with pdfplumber.open(file) as pdf:
  text=''.join('\n'.join(p.extract_text() or '' for p in pdf.pages).split());assert '待教师逐题审核' in text and '候选答案' in text and '未发布' in text
  if 'english' in file.name:assert '答案预检失败' in text and 'am' in text
  for p in pdf.pages:
   assert abs(p.width-595.28)<1 and abs(p.height-841.89)<1
   assert all(-1<=c['x0']<=c['x1']<=p.width+1 for c in p.chars)
  reports.append({'file':file.name,'pages':len(pdf.pages)})
 if file.name.startswith('desktop'):
  writer=PdfWriter()
  for page in PdfReader(file).pages:
   buf=BytesIO();c=canvas.Canvas(buf,pagesize=(float(page.mediabox.width),float(page.mediabox.height)));c.setFillColorRGB(1,1,1);c.rect(0,0,float(page.mediabox.width),18,fill=1,stroke=0);c.setFillColorRGB(.6,.2,.1);c.setFont('Sample',8);c.drawString(18,6,'真实本地模型输出 · 仅合成资料 · 待真人审核 · '+('本题答案预检失败' if 'english' in file.name else '简单自动预检不代表真人审题'));c.save();page.merge_page(PdfReader(buf).pages[0]);writer.add_page(page)
  name='数学' if 'math' in file.name else '英语_预检失败';target=root/f'output/pdf/第九阶段_{name}候选待审.pdf'
  with target.open('wb') as f:writer.write(f)
  subprocess.run([shutil.which('pdftoppm'),'-r','95','-png',str(target),str(folder/('delivery-'+name))],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
(folder/'validation.json').write_text(json.dumps({'reports':reports,'pdfCount':len(reports),'pages':sum(r['pages'] for r in reports)},indent=2),encoding='utf-8');print(json.dumps({'pdfCount':len(reports),'pages':sum(r['pages'] for r in reports)}))
