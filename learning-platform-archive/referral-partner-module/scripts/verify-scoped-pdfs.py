from pathlib import Path
import json,re,shutil,subprocess
import pdfplumber
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1];folder=root/'test-results/stage5';rendered=folder/'rendered';rendered.mkdir(exist_ok=True)
files=sorted(folder.glob('*.pdf'));assert len(files)==20
reports=[]
for file in files:
    with pdfplumber.open(file) as pdf:
        text=''.join(('\n'.join(p.extract_text() or '' for p in pdf.pages)).split())
        # The 4-column tables wrap scope labels. Whole-page extraction interleaves
        # adjacent score/source cells, so validate the actual scope column too.
        columnText=''
        for p in pdf.pages:
            margin=16/25.4*72;col=(p.width-2*margin)/4
            columnText+=''.join((p.crop((margin+col,0,margin+2*col,p.height)).extract_text() or '').split())
        assert '知行' in text and not re.search(r'NaN|Infinity|0/0',text)
        for p in pdf.pages:
            assert abs(p.width-595.28)<1 and abs(p.height-841.89)<1
            assert all(-1<=c['x0']<=c['x1']<=p.width+1 and -1<=c['top']<=c['bottom']<=p.height+1 for c in p.chars)
        if 'scoped-open' in file.name or 'scoped-submitted' in file.name:
            assert '专项筛查：一元一次方程：等式的性质v1' in text and '不补0分' in text
            assert '有理数：分数加减' not in text
        if 'scoped-open' in file.name or 'subject-default-open' in file.name or 'legacy-scope' in file.name:assert '正确答案' not in text and '尚未提交' in text
        if 'subject-default-open' in file.name:assert '本科目示例筛查' in text and '有理数：分数加减v1' in text
        if 'scoped-practice' in file.name:assert '学习包范围：一元一次方程：等式的性质v1' in text
        if 'scoped-growth' in file.name:
            assert '专项筛查：一元一次方程：等式的性质v1' in columnText and '学习包范围：一元一次方程：等式的性质v1' in columnText
            assert '有理数：分数加减' not in text
        if 'growth-pending' in file.name:assert '同一学习包的前后记录' not in text
        if 'growth-complete' in file.name:assert '同一学习包的前后记录' in text
        if 'parent-scopes' in file.name:assert '专项筛查：一般现在时：be动词v1' in columnText and '教师录入' in text
        if 'records-scopes' in file.name:assert all(x in columnText for x in ['专项筛查','学习包范围','本科目示例筛查'])
        if 'legacy-scope' in file.name:assert '历史题目范围（未保存选择模式）' in text and 'english-bev1' in text and '本科目示例筛查' not in text
        reports.append({'file':file.name,'pages':len(pdf.pages),'a4':True,'selectableChinese':True})
    for old in rendered.glob(file.stem+'-*.png'):
        if re.fullmatch(re.escape(file.stem)+r'-\d+\.png',old.name):assert old.resolve().is_relative_to(rendered.resolve());old.unlink()
    subprocess.run([shutil.which('pdftoppm'),'-r','75','-png',str(file),str(rendered/file.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
pngs=sorted(rendered.glob('*.png'));assert len(pngs)==sum(r['pages'] for r in reports)
for start in range(0,len(pngs),8):
    sheet=Image.new('RGB',(1280,1800),'#e2e8f0');draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(pngs[start:start+8]):
        im=Image.open(path).convert('RGB');im.thumbnail((300,410));x=(i%4)*320+10;y=(i//4)*900+30;sheet.paste(im,(x,y));draw.text((x,y-20),path.name[:48],fill='black')
    sheet.save(folder/f'contact-{start//8+1}.png')
result={'pdfCount':len(reports),'pageCount':sum(r['pages'] for r in reports),'reports':reports}
(folder/'pdf-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pdfCount':result['pdfCount'],'pageCount':result['pageCount'],'checks':'saved scope labels, legacy honesty, no pre-submit keys, A4/Chinese/page bounds'},ensure_ascii=False))
