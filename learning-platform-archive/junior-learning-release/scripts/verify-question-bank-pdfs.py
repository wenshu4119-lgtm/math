"""Read-only checks and Poppler rendering of generated browser-test PDFs."""
from pathlib import Path
import json, subprocess
import pdfplumber
out = Path(__file__).resolve().parents[1] / 'test-results' / 'question-bank'
results = []
for file in sorted(out.glob('*.pdf')):
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ''
            assert '待教师审核' in text and '学习规划' in text
            assert '老师已审核' not in text
            assert abs(page.width - 595.28) < 1 and abs(page.height - 841.89) < 1
            assert all(-1 <= c['x0'] <= c['x1'] <= page.width+1 and -1 <= c['top'] <= c['bottom'] <= page.height+1 for c in page.chars)
        results.append({'file': file.name, 'pages': len(pdf.pages), 'chinese': True, 'unreviewedLabel': True, 'bounds': True})
    subprocess.run(['pdftoppm', '-r', '90', '-png', str(file), str(out / file.stem)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
(out / 'pdf-validation.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results))
