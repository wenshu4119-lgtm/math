from pathlib import Path
import json,re,shutil,subprocess
import pdfplumber
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1];folder=root/'test-results/homework/pdf';rendered=folder/'rendered';rendered.mkdir(exist_ok=True)
reports=[]
for file in sorted(folder.glob('*.pdf')):
    with pdfplumber.open(file) as pdf:
        raw='\n'.join(p.extract_text() or '' for p in pdf.pages);text=''.join(raw.split())
        assert '知行' in text and '作业' in text
        for p in pdf.pages:
            assert abs(p.width-595.28)<1 and abs(p.height-841.89)<1
            assert all(-1<=c['x0']<=c['x1']<=p.width+1 and -1<=c['top']<=c['bottom']<=p.height+1 for c in p.chars)
        if 'sheet' in file.name or 'published-record' in file.name or 'submitted-record' in file.name:assert '参考答案' not in text
        if 'summary' in file.name or 'growth-with-homework' in file.name:assert 'PRIVATE_STUDENT_RESPONSE' not in text and 'PRIVATE_TEACHER_FEEDBACK' not in text and 'PRIVATE_ITEM_NOTE' not in text
        if 'graded-feedback' in file.name:
            assert '教师人工分数：0/10' in text and 'PRIVATE_TEACHER_FEEDBACK' in text
            assert '过程35' in text and '1.5/2' in text
            assert '学生选择' in (pdf.pages[0].extract_text() or ''), 'Long work must not leave the introductory page mostly blank'
        if 'submitted-record' in file.name:assert '尚未人工批改' in text and '没有成绩' in text and '过程35' in text
        if 'graded-summary' in file.name:assert '0/10' in text and 'PUBLIC_FAMILY_SUMMARY' in text
        reports.append({'file':file.name,'pages':len(pdf.pages),'selectableChinese':True,'a4':True})
    for old in rendered.glob(file.stem+'-*.png'):
        if re.fullmatch(re.escape(file.stem)+r'-\d+\.png',old.name):assert old.resolve().is_relative_to(rendered.resolve());old.unlink()
    subprocess.run([shutil.which('pdftoppm'),'-r','65','-png',str(file),str(rendered/file.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
pngs=sorted(rendered.glob('*.png'));assert len(pngs)==sum(r['pages'] for r in reports)
for start in range(0,len(pngs),20):
    sheet=Image.new('RGB',(1225,1460),'#dfe5df');draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(pngs[start:start+20]):
        im=Image.open(path).convert('RGB');im.thumbnail((225,325));x=(i%5)*245+10;y=(i//5)*365+10;sheet.paste(im,(x,y));draw.text((x,y+330),path.name[:36],fill='black')
    sheet.save(folder/f'contact-{start//20+1}.png')
(folder/'pdf-validation.json').write_text(json.dumps({'pdfCount':len(reports),'pageCount':sum(r['pages'] for r in reports),'reports':reports},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pdfCount':len(reports),'pageCount':sum(r['pages'] for r in reports),'checks':'A4, Chinese, long work text, no pre-grade keys, family privacy, true zero'},ensure_ascii=False))
