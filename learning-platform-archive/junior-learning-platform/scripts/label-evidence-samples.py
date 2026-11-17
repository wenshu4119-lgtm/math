"""Create labeled delivery copies, preserving all raw browser PDF evidence."""
from pathlib import Path
from io import BytesIO
from pypdf import PdfReader,PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
root=Path(__file__).resolve().parents[1]
pdfmetrics.registerFont(TTFont('SampleLabel','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
pairs=[('desktop-growth-missing-vs-zero.pdf','数据边界_未覆盖与真实零分.pdf'),('desktop-draft-missing-and-zero.pdf','数据边界_缺失分值待核对.pdf')]
for source,name in pairs:
    reader=PdfReader(root/'test-results/missing-evidence'/source);writer=PdfWriter()
    for page in reader.pages:
        buffer=BytesIO();c=canvas.Canvas(buffer,pagesize=(float(page.mediabox.width),float(page.mediabox.height)))
        c.setFillColorRGB(1,1,1);c.rect(0,0,float(page.mediabox.width),18,fill=1,stroke=0)
        c.setFillColorRGB(.6,.22,.1);c.setFont('SampleLabel',8.5)
        c.drawString(20,6,'合成样本 · 教师操作为自动化测试 · 不代表真人审题或真实学生成绩')
        c.save();page.merge_page(PdfReader(buffer).pages[0]);writer.add_page(page)
    target=root/'output/pdf'/name;target.parent.mkdir(parents=True,exist_ok=True)
    with target.open('wb') as stream:writer.write(stream)
    assert all('合成样本' in (page.extract_text() or '') for page in PdfReader(target).pages)
print('Two labeled evidence samples created; raw PDFs preserved.')
