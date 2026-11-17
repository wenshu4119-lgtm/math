from pathlib import Path
import json,re,shutil,subprocess
import pdfplumber
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1];folder=root/'test-results/stage7';rendered=folder/'rendered';rendered.mkdir(exist_ok=True)
files=sorted(folder.glob('*.pdf'));assert len(files)==16
reports=[]
for file in files:
    with pdfplumber.open(file) as pdf:
        raw='\n'.join(p.extract_text() or '' for p in pdf.pages);text=''.join(raw.split())
        assert '知行' in text and not re.search(r'NaN|Infinity|0/0',text)
        for p in pdf.pages:
            assert abs(p.width-595.28)<1 and abs(p.height-841.89)<1
            assert all(-1<=c['x0']<=c['x1']<=p.width+1 and -1<=c['top']<=c['bottom']<=p.height+1 for c in p.chars)
        if 'plan-draft' in file.name:assert 'SAVED_PLAN_DRAFT' in text and 'UNSAVED_PLAN_ONLY' not in text and '尚未批准' in text
        if 'plan-approved' in file.name:assert 'PRIVATE_PLAN_SAVED' in text and '已批准' in text
        if 'worksheet' in file.name:assert '正确答案' not in text and '参考答案' not in text
        if 'submitted-no-grade' in file.name:assert '尚未人工批改' in text and '没有成绩' in text and '教师人工分数' not in text and '步骤25' in text
        if 'graded-feedback' in file.name or 'student-feedback' in file.name:
            assert '教师人工分数：1.5/2' in text and 'PRIVATE_FEEDBACK' in text and 'PRIVATE_STUDENT_WORK' in text
            assert '步骤25' in text and '反馈段24' in text and 'PUBLIC_FAMILY_SUMMARY' in text
        if 'summary' in file.name:
            assert 'PUBLIC_FAMILY_SUMMARY' in text and '1.5/2' in text
            assert all(v not in text for v in ['PRIVATE_PLAN','PRIVATE_FEEDBACK','PRIVATE_STUDENT_WORK','参考答案'])
        reports.append({'file':file.name,'pages':len(pdf.pages),'a4':True,'selectableChinese':True})
    for old in rendered.glob(file.stem+'-*.png'):
        if re.fullmatch(re.escape(file.stem)+r'-\d+\.png',old.name):assert old.resolve().is_relative_to(rendered.resolve());old.unlink()
    subprocess.run([shutil.which('pdftoppm'),'-r','75','-png',str(file),str(rendered/file.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
pngs=sorted(rendered.glob('*.png'));assert len(pngs)==sum(r['pages'] for r in reports)
for start in range(0,len(pngs),8):
    sheet=Image.new('RGB',(1280,1000),'#e2e8f0');draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(pngs[start:start+8]):
        im=Image.open(path).convert('RGB');im.thumbnail((300,450));x=(i%4)*320+10;y=(i//4)*500+28;draw.text((x,y-20),path.name[:48],fill='black');sheet.paste(im,(x,y))
    sheet.save(folder/f'contact-{start//8+1}.png')
result={'pdfCount':len(reports),'pageCount':sum(r['pages'] for r in reports),'reports':reports}
(folder/'pdf-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pdfCount':result['pdfCount'],'pageCount':result['pageCount'],'checks':'A4/Chinese, saved not unsaved plan, long work/feedback complete, manual partial score, parent privacy'},ensure_ascii=False))
