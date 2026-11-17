from pathlib import Path
import json, re, subprocess, shutil
import pdfplumber
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]
folder=root/'test-results/stage8/pdf'; rendered=folder/'rendered'; rendered.mkdir(exist_ok=True)
files=sorted(folder.glob('*.pdf')); assert len(files)==12
reports=[]
for file in files:
    with pdfplumber.open(file) as pdf:
        text=''.join('\n'.join(p.extract_text() or '' for p in pdf.pages).split())
        assert '隔离' in text and '未发布' in text and '自动校验不等于真人审题' in text
        assert not re.search(r'NaN|Infinity|0/0',text)
        for p in pdf.pages:
            assert abs(p.width-595.28)<1 and abs(p.height-841.89)<1
            assert all(-1<=c['x0']<=c['x1']<=p.width+1 and -1<=c['top']<=c['bottom']<=p.height+1 for c in p.chars)
        if '-source.pdf' in file.name: assert '资料段35' in text and 'SHA256' in text
        if '-pending.pdf' in file.name: assert '待教师逐题审核' in text and '候选解析' in text and '候选答案' in text and '正确答案' not in text
        if '-reviewed.pdf' in file.name: assert '保存版本1' in text and '保存版本2' in text and '不是真人审题' in text
        if '-unavailable.pdf' in file.name: assert 'NOT_CONFIGURED' in text and '生成服务不可用' in text and '正确答案' not in text
        reports.append({'file':file.name,'pages':len(pdf.pages),'a4':True,'chinese':True})
    for old in rendered.glob(file.stem+'-*.png'):
        if re.fullmatch(re.escape(file.stem)+r'-\d+\.png',old.name):
            assert old.resolve().is_relative_to(rendered.resolve()); old.unlink()
    subprocess.run([shutil.which('pdftoppm'),'-r','75','-png',str(file),str(rendered/file.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
pngs=sorted(rendered.glob('*.png'));assert len(pngs)==sum(r['pages'] for r in reports)
for start in range(0,len(pngs),8):
    sheet=Image.new('RGB',(1280,1000),'#e2e8f0');draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(pngs[start:start+8]):
        im=Image.open(path).convert('RGB');im.thumbnail((300,450));x=(i%4)*320+10;y=(i//4)*500+28;draw.text((x,y-20),path.name[:48],fill='black');sheet.paste(im,(x,y))
    sheet.save(folder/f'contact-{start//8+1}.png')
report={'pdfCount':len(files),'pageCount':sum(r['pages'] for r in reports),'reports':reports,'notice':'Isolated integration print fixture, not published website UI or physical phone/printer validation.'}
(folder/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pdfCount':report['pdfCount'],'pageCount':report['pageCount']}))
