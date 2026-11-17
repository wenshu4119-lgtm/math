"""Delivery copies of real browser PDFs, visibly labeled as synthetic test evidence."""
from pathlib import Path
from io import BytesIO
from pypdf import PdfReader,PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
root=Path(__file__).resolve().parents[1]
pdfmetrics.registerFont(TTFont('SampleLabel','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
for source,name in [('desktop-scoped-submitted.pdf','第五阶段_专项筛查与保存范围.pdf'),('desktop-parent-scopes.pdf','第五阶段_带范围的成长档案.pdf')]:
    reader=PdfReader(root/'test-results/stage5'/source);writer=PdfWriter()
    for page in reader.pages:
        buffer=BytesIO();c=canvas.Canvas(buffer,pagesize=(float(page.mediabox.width),float(page.mediabox.height)))
        c.setFillColorRGB(1,1,1);c.rect(0,0,float(page.mediabox.width),18,fill=1,stroke=0)
        c.setFillColorRGB(.6,.22,.1);c.setFont('SampleLabel',8.5);c.drawString(20,6,'合成样本 · 教师操作为自动化测试 · 不代表真人审题或真实学生成绩');c.save()
        page.merge_page(PdfReader(buffer).pages[0]);writer.add_page(page)
    target=root/'output/pdf'/name;target.parent.mkdir(parents=True,exist_ok=True)
    with target.open('wb') as file:writer.write(file)
    assert all('合成样本' in (p.extract_text() or '') for p in PdfReader(target).pages)
print('Two scoped-learning delivery samples labeled; original evidence unchanged.')
