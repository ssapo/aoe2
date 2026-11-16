"""Build a portable, self-contained HTML preview with no backend requirement."""
import argparse
import base64
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
html=re.sub(r'<script defer src="(?:collection-watch|building-map|player-search|collection-client|field-control|state-curve|housing|engine-income|civ-info|report-store|app)\.js(?:\?[^"]*)?"></script>','',html)
bootstrap=json.dumps(json.loads((root/'site/data/report.json').read_text(encoding='utf-8')),ensure_ascii=False).replace('<','\\u003c')
js='window.SSAPO_BOOTSTRAP='+bootstrap+';\n'+(root/'site/collection-watch.js').read_text(encoding='utf-8')+'\n'+(root/'site/building-map.js').read_text(encoding='utf-8')+'\n'+(root/'site/player-search.js').read_text(encoding='utf-8')+'\n'+(root/'site/report-store.js').read_text(encoding='utf-8')+'\n'+(root/'site/collection-client.js').read_text(encoding='utf-8')+'\n'+(root/'site/field-control.js').read_text(encoding='utf-8')+'\n'+(root/'site/state-curve.js').read_text(encoding='utf-8')+'\n'+(root/'site/housing.js').read_text(encoding='utf-8')+'\n'+(root/'site/engine-income.js').read_text(encoding='utf-8')+'\n'+(root/'site/civ-info.js').read_text(encoding='utf-8')+'\n'+(root/'site/app.js').read_text(encoding='utf-8')
# Civilization icons are relative paths in app.js; inline them so the single file still shows them when shared alone.
icon_src='src="assets/civs/${civIconFiles[civ]||civ.toLowerCase()}.png"'
if js.count(icon_src)!=1:raise SystemExit('app.js civ icon src changed; update build_preview.py')
icons={p.stem:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for p in sorted((root/'site/assets/civs').glob('*.png'))}
js=js.replace(icon_src,'src="${civIconData[civIconFiles[civ]||civ.toLowerCase()]||\'\'}"')
js='const civIconData='+json.dumps(icons)+';\n'+js
html=html.replace('</body>',f'<script>{js}</script></body>')
html=html.replace('href="./" aria-label="SSAPO 홈"','href="#overview" aria-label="SSAPO 홈"')
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(html,encoding='utf-8')
print(args.output)
