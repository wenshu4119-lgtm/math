"""Read-only PDF validation + raster contact sheets for human/model visual QA."""
from pathlib import Path
import json, subprocess, shutil, re
import pdfplumber
from pypdf import PdfReader
from PIL import Image, ImageOps, ImageDraw

root = Path(__file__).resolve().parents[1]
folder = root / 'test-results' / 'pdf'
rendered = folder / 'rendered'
rendered.mkdir(exist_ok=True)
poppler = shutil.which('pdftoppm')
if not poppler:
    raise SystemExit('pdftoppm is required for final visual QA')
reports=[]
for file in sorted(folder.glob('*.pdf')):
    reader=PdfReader(file)
    with pdfplumber.open(file) as pdf:
        extracted=[]
        for number,page in enumerate(pdf.pages,1):
            assert abs(page.width-595.28)<1 and abs(page.height-841.89)<1, (file.name,'not A4')
            text=page.extract_text() or ''
            assert len(text.strip())>10, (file.name,number,'blank page')
            assert all(-1 <= c['x0'] <= c['x1'] <= page.width+1 and -1 <= c['top'] <= c['bottom'] <= page.height+1 for c in page.chars), (file.name,number,'text outside page')
            assert all(i['x0']>=-1 and i['x1']<=page.width+1 and i['top']>=-1 and i['bottom']<=page.height+1 for i in page.images), (file.name,number,'image clipped')
            extracted.append(text)
        text='\n'.join(extracted)
        compact=''.join(text.split())
        assert '智学方舟' in text, (file.name,'Chinese text not preserved')
        assert len([c for c in text if '\u4e00'<=c<='\u9fff'])>20, (file.name,'missing Chinese')
        assert '\ufffd' not in text, (file.name,'replacement glyph')
        if 'long-text' in file.name:
            assert '第1段' in text and '第70段' in text, (file.name,'long text truncated')
            assert len(pdf.pages)>1
        if file.stem.endswith('-growth'):
            assert '真实学习时间线' in text and '数学' in text and '英语' in text
        if file.stem.endswith('-assignment'):
            assert '正确答案' not in text, (file.name,'worksheet leaked answers')
        if file.stem.endswith('-paper-report'):
            assert '2.5' in text and '3.5' in text and '60%' in text, (file.name,'partial-score report lost values')
            assert '1.5/2' in compact and '1/2.5' in compact, (file.name,'decimal division was altered')
            assert 'AI未参与评分' in compact
        if file.stem.endswith('-observation'):
            assert '不换算分数' in compact and '2档' in compact, (file.name,'observation provenance missing')
        if file.stem.endswith('-draft-paper'):
            assert '草稿尚未确认' in compact and '待填写' in compact, (file.name,'draft disguised as final marks')
        if file.stem.endswith('-paper-summaries'):
            assert '逐题 / 小题人工复核' not in text, (file.name,'parent summary contains detailed marks')
        reports.append({'file':file.name,'pages':len(pdf.pages),'chineseCharacters':sum('\u4e00'<=c<='\u9fff' for c in text),'images':sum(len(p.images) for p in pdf.pages),'a4':True,'selectableChinese':True,'bounds':'inside-page'})
    # Render every page. Raster output is QA evidence, not a replacement for vector PDFs.
    for old in rendered.glob(file.stem+'-*.png'):
        if re.fullmatch(re.escape(file.stem)+r'-\d+\.png',old.name):
            assert old.resolve().is_relative_to(rendered.resolve())
            old.unlink()
    subprocess.run([poppler,'-r','65','-png',str(file),str(rendered/file.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)

pngs=sorted(rendered.glob('*.png'))
assert len(pngs)==sum(report['pages'] for report in reports), 'Rendered page inventory does not match PDF pages'
cols,rows=5,4
for start in range(0,len(pngs),cols*rows):
    subset=pngs[start:start+cols*rows]
    sheet=Image.new('RGB',(cols*245,rows*365),'#dfe5df')
    draw=ImageDraw.Draw(sheet)
    for index,path in enumerate(subset):
        thumb=Image.open(path).convert('RGB');thumb.thumbnail((225,325))
        x=(index%cols)*245+10;y=(index//cols)*365+10
        sheet.paste(thumb,(x,y));draw.text((x,y+330),path.name[:36],fill='black')
    sheet.save(folder/f'contact-{start//(cols*rows)+1}.png')
result={'pdfCount':len(reports),'pageCount':sum(r['pages'] for r in reports),'reports':reports,'visualStatus':'rendered; inspect contact sheets and representative full pages before final approval'}
(folder/'pdf-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'pdfCount':result['pdfCount'],'pageCount':result['pageCount'],'contactSheets':(len(pngs)+cols*rows-1)//(cols*rows),'checks':'A4, selectable Chinese, page bounds, required content, long-text completeness, worksheet answer exclusion'},ensure_ascii=False))
