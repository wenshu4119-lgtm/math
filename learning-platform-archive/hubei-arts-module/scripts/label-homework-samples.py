"""Label delivered copies only; original browser-generated evidence stays unchanged."""
from pathlib import Path
from io import BytesIO
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
root = Path(__file__).resolve().parents[1]
pdfmetrics.registerFont(TTFont('SampleLabel', 'C:/Windows/Fonts/msyh.ttc', subfontIndex=0))
pairs = [('desktop-published-sheet.pdf', '第四阶段_独立作业单.pdf'),
         ('desktop-graded-feedback.pdf', '第四阶段_人工批改反馈.pdf'),
         ('mobile-graded-summary.pdf', '第四阶段_家长作业摘要.pdf')]
for source, name in pairs:
    reader = PdfReader(root / 'test-results/homework/pdf' / source)
    writer = PdfWriter()
    for page in reader.pages:
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=(float(page.mediabox.width), float(page.mediabox.height)))
        c.setFillColorRGB(1, 1, 1)
        c.rect(0, 0, float(page.mediabox.width), 18, fill=1, stroke=0)
        c.setFillColorRGB(.6, .22, .1)
        c.setFont('SampleLabel', 8.5)
        c.drawString(20, 6, '合成样本 · 教师操作为自动化测试 · 不代表真人审题或真实学生成绩')
        c.save()
        page.merge_page(PdfReader(buffer).pages[0])
        writer.add_page(page)
    target = root / 'output/pdf' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('wb') as file:
        writer.write(file)
    assert all('合成样本' in (page.extract_text() or '') for page in PdfReader(target).pages)
print('Three labeled homework sample copies created; raw print evidence preserved.')
