"""สร้าง foods-more.js จาก data/foods_more.txt  (python3 data/build_foods_more.py)"""
import json, re, os
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
raw = re.search(r'const FOOD_RAW=`(.*?)`;', html, re.S).group(1)
existing = {l.split('|')[0] for l in raw.splitlines() if l.strip() and not l.startswith('#')}
out, seen, cat, bad = [], set(), '', []
for ln, line in enumerate(open(os.path.join(here, 'foods_more.txt'), encoding='utf-8'), 1):
    line = line.rstrip('\n')
    if not line.strip() or line.startswith('# '):
        continue
    if line.startswith('#'):
        cat = line[1:].strip(); continue
    a = line.split('|')
    if len(a) < 5:
        bad.append((ln, 'fields', line)); continue
    name, serving, k, p, f = a[0].strip(), a[1].strip(), float(a[2]), float(a[3]), float(a[4])
    alias = a[5].strip() if len(a) > 5 else ''
    en = a[6].strip() if len(a) > 6 else ''
    c = (k - 4 * p - 9 * f) / 4
    if c < -2:
        bad.append((ln, f'carbs {c:.1f}', name))
    if name in seen or name in existing:
        bad.append((ln, 'duplicate', name))
    seen.add(name)
    num = lambda x: int(x) if x == int(x) else x
    out.append([name, cat, serving, num(k), num(p), num(f), alias, en])
for b in bad:
    print('BAD', b)
js = ('/* สร้างอัตโนมัติจาก data/build_foods_more.py — เมนูยอดนิยมเพิ่มเติม ค่าประมาณต่อ 1 หน่วยเสิร์ฟ (src E) */\n'
      'window.FOODS_MORE=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(root, 'foods-more.js'), 'w', encoding='utf-8').write(js)
cats = {}
for r in out: cats[r[1]] = cats.get(r[1], 0) + 1
print(len(out), 'items', cats, 'bad', len(bad))
