from pathlib import Path
import json,re,shutil,subprocess
import pdfplumber
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1];folder=root/'test-results/stage6';rendered=folder/'rendered';rendered.mkdir(exist_ok=True)
files=sorted(folder.glob('*.pdf'));assert len(files)==16
reports=[]
for file in files:
    with pdfplumber.open(file) as pdf:
        raw='\n'.join(p.extract_text() or '' for p in pdf.pages);text=''.join(raw.split())
        assert '知行' in text and not re.search(r'NaN|Infinity|0/0',text)
        for page in pdf.pages:
            assert abs(page.width-595.28)<1 and abs(page.height-841.89)<1
            assert all(-1<=c['x0']<=c['x1']<=page.width+1 and -1<=c['top']<=c['bottom']<=page.height+1 for c in page.chars)
        if 'pack' in file.name:
            assert '一元一次方程' in text and '有理数' in text and '同加同减' in text and '先通分，再算分子' in text
            if 'draft' in file.name:assert '尚未批准' in text
            else:assert '合成教师指导' in text and '本包仅覆盖两个示例知识点' in text
        elif 'worksheet' in file.name:assert '正确答案' not in text and '参考答案' not in text
        elif 'practice-report' in file.name or 'retest-report' in file.name:
            page=pdf.pages[0];word=next(w for w in page.extract_words() if w['text']=='答对');numerator='2' if 'practice-report' in file.name else '1'
            chars=[c for c in page.chars if c['text'] in ['1','2'] and word['x1']<c['x0']<word['x1']+25 and abs(c['top']-word['top'])<22]
            assert any(n['text']==numerator and d['text']=='2' and abs(n['x0']-d['x0'])<1 and n['bottom']<d['top'] for n in chars for d in chars)
        elif 'growth' in file.name:
            assert '不直接换算能力增长率' in text
            region=''
            for page in pdf.pages:
                words=[w for w in page.extract_words() if '同一学习包的前后记录' in w['text']]
                if words:region+=''.join((page.crop((0,words[0]['bottom'],page.width,page.height)).extract_text() or '').split())
            assert '0/2' in region and '1/2' in region
            if 'parent' in file.name:assert '合成教师指导' not in text and '正确答案' not in text
        reports.append({'file':file.name,'pages':len(pdf.pages),'a4':True,'selectableChinese':True})
    for old in rendered.glob(file.stem+'-*.png'):
        if re.fullmatch(re.escape(file.stem)+r'-\d+\.png',old.name):assert old.resolve().is_relative_to(rendered.resolve());old.unlink()
    subprocess.run([shutil.which('pdftoppm'),'-r','75','-png',str(file),str(rendered/file.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
pngs=sorted(rendered.glob('*.png'));assert len(pngs)==sum(x['pages'] for x in reports)
for start in range(0,len(pngs),8):
    sheet=Image.new('RGB',(1280,1000),'#e2e8f0');draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(pngs[start:start+8]):
        im=Image.open(path).convert('RGB');im.thumbnail((300,450));x=(i%4)*320+10;y=(i//4)*500+28;draw.text((x,y-20),path.name[:47],fill='black');sheet.paste(im,(x,y))
    sheet.save(folder/f'contact-{start//8+1}.png')
result={'pdfCount':len(reports),'pageCount':sum(x['pages'] for x in reports),'reports':reports}
(folder/'pdf-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pdfCount':result['pdfCount'],'pageCount':result['pageCount'],'checks':'full materials independent of selected tab, saved teacher note, no worksheet answers, real score glyphs, parent boundary, A4/Chinese'},ensure_ascii=False))
