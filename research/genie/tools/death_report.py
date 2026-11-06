"""Build an offline, read-only view of GENIE_DEATHS logs. No game-state claims."""
import argparse
import html
import json
import re
from collections import Counter
from pathlib import Path


def parse(text):
    events, unresolved, ownership, stops = [], [], [], []
    seen = set()
    end = None
    for line in text.splitlines():
        if not line.startswith('DEATH_'):
            continue
        tag = line.split()[0]
        row = {k: (v == 'true' if v in ('true', 'false') else int(v))
               for k, v in re.findall(r'(\w+)=(-?\d+|true|false)', line)}
        if tag == 'DEATH_EVENT' and row.get('id') not in seen:
            seen.add(row['id']); events.append(row)
        elif tag == 'DEATH_UNRESOLVED': unresolved.append(row)
        elif tag == 'DEATH_OWNER': ownership.append(row)
        elif tag == 'DEATH_STOP': stops.append(row)
        elif tag == 'DEATH_END': end = row
    return dict(events=events, unresolved=unresolved, ownership=ownership, stops=stops, end=end)


def clock(ms):
    s = ms // 1000
    return f'{s//60}:{s%60:02}'


def render(runs):
    parts = []
    for name, data in runs.items():
        counts = Counter(e['player'] for e in data['events'])
        rows = []
        for player, label, lost, converted in [(1, 'ssapo', 39, 3), (2, 'Maerlin', 73, 0)]:
            villagers = sum(e['class'] == 4 for e in data['events'] if e['player'] == player)
            stop = next((clock(s['ms']) for s in data['stops'] if s['player'] == player), '정지 기록 없음')
            rows.append(f'<tr><th>{label}</th><td>{counts[player]}</td><td>{villagers}</td><td>{lost}</td><td>{converted}</td><td>{stop}</td></tr>')
        events = ''.join(f'<tr><td>{clock(e["ms"])}</td><td>{e["player"]}</td><td>{e["id"]}</td><td>{e["master"]}</td><td>{e["class"]}</td><td>{"정지 이후" if e.get("degraded") else "정지 이전"}</td></tr>' for e in data['events'])
        missing = len(data['unresolved'])
        end = data['end']
        parts.append(f'''<section><h2>{html.escape(name)}</h2><p>루프 마지막 시각 {clock(end['ms']) if end else '완료 기록 없음'} · 사망 여부 미해결 {missing}건</p>
<div class="scroll"><table><tr><th>선수</th><th>엔진 사망</th><th>그중 주민</th><th>원본 손실</th><th>원본 전향 손실</th><th>엔진 정지 시각</th></tr>{''.join(rows)}</table></div>
<details open><summary>사망 이벤트 {len(data['events'])}건</summary><div class="scroll"><table><tr><th>시각</th><th>선수</th><th>개체 ID</th><th>유닛 종류 ID</th><th>분류 ID</th><th>진행 상태</th></tr>{events}</table></div></details></section>''')
    return '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>사망 집계 실험 · 518239882</title><style>body{font:16px system-ui;margin:24px auto;padding:0 16px;max-width:1000px;background:#f5f5ef;color:#243b30}section{background:white;padding:20px;margin:20px 0;border:1px solid #ccd5c9;border-radius:12px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:10px;text-align:left;border-bottom:1px solid #ddd;white-space:nowrap}.scroll{overflow-x:auto}h1{font-size:25px}p{line-height:1.6}summary{cursor:pointer;margin-top:20px}</style><h1>사망 집계 실험 · 경기 518239882</h1><p>엔진이 관찰한 사망 상태 전환. 원본 손실은 Claude가 실제 게임 종료 화면에서 읽은 비교값이며 전향을 포함할 수 있어 집계 기준이 다릅니다. 원본 시각별 사망 정답은 없습니다. 엔진이 멈춘 뒤 루프가 끝까지 진행돼도 전체 경기 재현 성공이 아닙니다.</p>'''+''.join(parts)+'</html>'


def main():
    p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('logs',nargs='+');a=p.parse_args()
    runs={Path(f).stem:parse(Path(f).read_text()) for f in a.logs}
    base=Path(a.output);base.with_suffix('.json').write_text(json.dumps(runs,ensure_ascii=False,indent=2));base.with_suffix('.html').write_text(render(runs))

if __name__ == '__main__': main()
