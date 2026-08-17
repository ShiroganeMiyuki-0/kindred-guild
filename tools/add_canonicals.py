from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = {
    'auth.html', 'profile.html', 'dm.html', 'notifications.html',
    'admin_dashboard_ui.html', 'coin_purchase_ui.html'
}

for path in sorted(ROOT.rglob('*.html')):
    if 'node_modules' in path.parts:
        continue
    text = path.read_text(encoding='utf-8')
    if 'rel="canonical"' in text:
        continue
    rel = path.relative_to(ROOT).as_posix()
    canonical_path = '/' if rel == 'index.html' else f'/{rel}'
    tag = f'  <link rel="canonical" href="https://kindredguild.org{canonical_path}">\n'
    if path.name in PRIVATE and 'name="robots"' not in text:
        tag += '  <meta name="robots" content="noindex,follow">\n'
    marker = '</head>'
    if marker not in text:
        continue
    path.write_text(text.replace(marker, tag + marker, 1), encoding='utf-8')
    print(path)
