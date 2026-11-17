from pathlib import Path
from io import BytesIO
from pypdf import PdfReader,PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
root=Path(__file__).resolve().parents[1]
pdfmetrics.registerFont(TTFont('SyntheticLabel','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
reader=PdfReader(root/'test-results/stage8/pdf/desktop-pending.pdf');writer=PdfWriter()
for page in reader.pages:
    buf=BytesIO();c=canvas.Canvas(buf,pagesize=(float(page.mediabox.width),float(page.mediabox.height)))
    c.setFillColorRGB(1,1,1);c.rect(0,0,float(page.mediabox.width),18,fill=1,stroke=0)
    c.setFillColorRGB(.6,.22,.1);c.setFont('SyntheticLabel',8.5);c.drawString(20,6,'合成测试 · 待真人审核 · 未发布 · 未运行真实模型');c.save()
    page.merge_page(PdfReader(buf).pages[0]);writer.add_page(page)
target=root/'output/pdf/第八阶段_隔离候选题样例.pdf';target.parent.mkdir(parents=True,exist_ok=True)
with target.open('wb') as stream:writer.write(stream)
assert all('合成测试' in (p.extract_text() or '') for p in PdfReader(target).pages)
print('Labeled isolated candidate example created; raw test evidence preserved.')
