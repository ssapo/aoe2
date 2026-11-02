"""Build a portable, self-contained HTML preview with no backend requirement."""
import argparse
import json
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('output',type=Path)
args=parser.parse_args()
html=(root/'site/index.html').read_text(encoding='utf-8')
css=(root/'site/style.css').read_text(encoding='utf-8')
html=re.sub(r'<link rel="stylesheet" href="style\.css(?:\?[^"]*)?">',lambda _:f'<style>{css}</style>',html)
html=html.replace('<link rel="manifest" href="manifest.webmanifest">','')
html=html.replace('<link rel="icon" href="icon.svg" type="image/svg+xml">','')
html=re.sub(r'<script defer src="(?:collection-watch|app)\.js(?:\?[^"]*)?"></script>','',html)
bootstrap=json.dumps(json.loads((root/'site/data/report.json').read_text(encoding='utf-8')),ensure_ascii=False).replace('<','\\u003c')
js='window.SSAPO_BOOTSTRAP='+bootstrap+';\n'+(root/'site/collection-watch.js').read_text(encoding='utf-8')+'\n'+(root/'site/app.js').read_text(encoding='utf-8')
html=html.replace('</body>',f'<script>{js}</script></body>')
html=html.replace('href="./" aria-label="SSAPO 홈"','href="#overview" aria-label="SSAPO 홈"')
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(html,encoding='utf-8')
print(args.output)
