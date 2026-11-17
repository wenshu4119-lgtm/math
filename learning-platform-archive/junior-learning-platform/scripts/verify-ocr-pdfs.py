from pathlib import Path
import json,subprocess,shutil,re
import pdfplumber
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
folder=root/'test-results'/'ocr-ui'
rendered=folder/'rendered'
rendered.mkdir(exist_ok=True)
reports=[]
for file in sorted(folder.glob('*.pdf')):
    with pdfplumber.open(file) as pdf:
        texts=[]
        for p in pdf.pages:
            assert abs(p.width-595.28)<1 and abs(p.height-841.89)<1
            assert all(-1<=c['x0']<=c['x1']<=p.width+1 and -1<=c['top']<=c['bottom']<=p.height+1 for c in p.chars)
            texts.append(p.extract_text() or '')
        text=''.join(''.join(texts).split())
        assert 'tesseract-local' in text
        if 'pending' in file.name:
            assert '待教师审核' in text and 'OCR原文' in text
            assert '教师核对后的文字' not in text
        if 'reviewed' in file.name:
            assert 'OCR原文' in text and '教师核对后的文字' in text
        if 'paper-report' in file.name:
            assert '教师核对过的OCR文字' in text and '2.5' in text and '62.5%' in text
        if 'ocr-failed' in file.name:
            assert '识别失败' in text and 'OCR_EMPTY' in text and '教师核对后的文字' not in text
        reports.append({'file':file.name,'pages':len(pdf.pages),'images':sum(len(p.images) for p in pdf.pages)})
    for old in rendered.glob(file.stem+'-*.png'):
        if re.fullmatch(re.escape(file.stem)+r'-\d+\.png',old.name):
            assert old.resolve().is_relative_to(rendered.resolve())
            old.unlink()
    subprocess.run([shutil.which('pdftoppm'),'-r','85','-png',str(file),str(rendered/file.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
pngs=sorted(rendered.glob('*.png'))
assert len(pngs)==sum(r['pages'] for r in reports)
cols=4;cellw=280;cellh=405
for start in range(0,len(pngs),12):
    sheet=Image.new('RGB',(cols*cellw,3*cellh),'#dfe5df');draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(pngs[start:start+12]):
        im=Image.open(path).convert('RGB');im.thumbnail((260,365));x=(i%4)*cellw+10;y=(i//4)*cellh+10;sheet.paste(im,(x,y));draw.text((x,y+370),path.name[:40],fill='black')
    sheet.save(folder/f'contact-{start//12+1}.png')
(folder/'pdf-validation.json').write_text(json.dumps({'pdfCount':len(reports),'pageCount':sum(x['pages'] for x in reports),'reports':reports},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'pdfCount':len(reports),'pageCount':sum(x['pages'] for x in reports),'checks':'A4/Chinese/provenance/review boundary/images/page bounds'},ensure_ascii=False))
