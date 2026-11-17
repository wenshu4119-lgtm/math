from pathlib import Path
import json, re, shutil, subprocess
import pdfplumber
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parents[1]
folder=root/'test-results/missing-evidence'
rendered=folder/'rendered';rendered.mkdir(exist_ok=True)
files=sorted(folder.glob('*.pdf'));assert len(files)==12
reports=[]
def color_is(shape,color):
    found=shape.get('non_stroking_color')
    return isinstance(found,tuple) and len(found)==3 and all(abs(x-y)<.001 for x,y in zip(found,color))
for file in files:
    checks=[]
    with pdfplumber.open(file) as pdf:
        raw='\n'.join(p.extract_text() or '' for p in pdf.pages);text=''.join(raw.split())
        assert '知行' in text and not re.search(r'NaN|Infinity|预警|0/0',text)
        for page in pdf.pages:
            assert abs(page.width-595.28)<1 and abs(page.height-841.89)<1
            assert all(-1<=c['x0']<=c['x1']<=page.width+1 and -1<=c['top']<=c['bottom']<=page.height+1 for c in page.chars)
        if 'growth' in file.name:
            assert '暂无有效作答或未覆盖，不代表0分' in text
            assert text.count('0/1')>=4 and text.count('1/1')>=2
            assert '0/4分（卷面得分率0%）' in text
            assert 'be动词' not in text and '第三人称单数' not in text
            shapes=[s for page in pdf.pages for s in page.rects+page.curves]
            gray=[s for s in shapes if color_is(s,(229/255,235/255,223/255)) and s['width']>1]
            green=[s for s in shapes if color_is(s,(69/255,110/255,87/255)) and s['width']>1]
            assert len(gray)==3 and len(green)==1, 'Only 3 sampled bars; only the real 1/1 has foreground ink'
            assert all(abs(s['width']-green[0]['width'])<1 for s in gray)
            checks.append('3 real sampled vector rows, 2 zero labels, 1 full nonzero foreground; absent categories not drawn')
        elif 'practice-zero' in file.name:
            # MathML is a real stacked fraction, not slash text. Check the PDF glyph positions.
            page=pdf.pages[0];word=next(w for w in page.extract_words() if w['text']=='答对')
            nums=[c for c in page.chars if c['text'] in ['0','1'] and word['x1']<c['x0']<word['x1']+25 and abs(c['top']-word['top'])<22]
            assert any(n['text']=='0' and d['text']=='1' and abs(n['x0']-d['x0'])<1 and n['bottom']<d['top'] for n in nums for d in nums)
            checks.append('actual PDF has numerator 0 above denominator 1 at score position')
        elif 'english-unsubmitted' in file.name:
            assert '尚未提交，不能导出标准答案或成绩' in text and '正确答案' not in text and '卷面得分率' not in text
            checks.append('unsubmitted is explicitly unscored, with no answer key')
        elif 'draft-missing' in file.name:
            assert '草稿尚未确认' in text and '满分：4；实际得分：0' in text
            assert '满分：待填写；实际得分：待填写' in text and '卷面得分率' not in text
            checks.append('zero and missing points coexist; no fabricated total or percentage')
        elif 'confirmed-zero' in file.name:
            assert '实际得分0/4；卷面得分率0%' in text and '有理数：分数加减' not in text
            checks.append('real 0/4 and 0%; absent scope not added')
        reports.append({'file':file.name,'pages':len(pdf.pages),'a4':True,'selectableChinese':True,'checks':checks})
    for old in rendered.glob(file.stem+'-*.png'):
        if re.fullmatch(re.escape(file.stem)+r'-\d+\.png',old.name):assert old.resolve().is_relative_to(rendered.resolve());old.unlink()
    subprocess.run([shutil.which('pdftoppm'),'-r','80','-png',str(file),str(rendered/file.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
pngs=sorted(rendered.glob('*.png'));assert len(pngs)==sum(r['pages'] for r in reports)
for start in range(0,len(pngs),6):
    sheet=Image.new('RGB',(1240,1800),'#e2e8f0');draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(pngs[start:start+6]):
        im=Image.open(path).convert('RGB');im.thumbnail((590,550));x=(i%2)*620+12;y=(i//2)*600+30
        draw.text((x,y-20),path.name,fill='black');sheet.paste(im,(x,y))
    sheet.save(folder/f'contact-{start//6+1}.png')
result={'pdfCount':len(reports),'pageCount':sum(r['pages'] for r in reports),'reports':reports}
(folder/'pdf-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pdfCount':result['pdfCount'],'pageCount':result['pageCount'],'checks':'A4, Chinese, PDF vector bar count/colors, exact zero ratio glyph geometry, missing != zero'},ensure_ascii=False))
