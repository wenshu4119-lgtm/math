"""Label ONLY delivered synthetic test copies; preserve original print-engine evidence."""
from pathlib import Path
from io import BytesIO
from pypdf import PdfReader,PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
root=Path(__file__).resolve().parents[1]
pdfmetrics.registerFont(TTFont('SampleLabel','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
pairs=[('desktop-ocr-reviewed.pdf','第三阶段_真实本机OCR与教师核对.pdf'),('mobile-ocr-paper-report.pdf','第三阶段_OCR来源的人工阅卷报告.pdf')]
for source,name in pairs:
    reader=PdfReader(root/'test-results/ocr-ui'/source);writer=PdfWriter()
    for page in reader.pages:
        buff=BytesIO();c=canvas.Canvas(buff,pagesize=(float(page.mediabox.width),float(page.mediabox.height)))
        c.setFillColorRGB(1,1,1);c.rect(0,0,float(page.mediabox.width),18,fill=1,stroke=0)
        c.setFillColorRGB(.6,.22,.1);c.setFont('SampleLabel',8.5)
        c.drawString(20,6,'合成样本 · 教师操作为自动化测试 · 不代表真人审题或真实学生成绩')
        c.save();page.merge_page(PdfReader(buff).pages[0]);writer.add_page(page)
    target=root/'output/pdf'/name;target.parent.mkdir(parents=True,exist_ok=True)
    with target.open('wb') as f:writer.write(f)
    assert all('合成样本' in (p.extract_text() or '') for p in PdfReader(target).pages)
print('Two delivered sample PDFs labeled; original test evidence unchanged.')
