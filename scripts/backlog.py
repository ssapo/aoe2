"""Print how many stored analyses are still below the current analysis revision and can be retried.

The collection workflow runs this before and after collecting: while the number goes down, it starts one
more run itself (GitHub's half-hourly schedule often fires only every few hours), so a revision change
reaches every stored match without anyone pressing "Run workflow".
"""
import json
from pathlib import Path

from collect import ANALYSIS_REVISION, ROOT


def outdated(report):
    count = 0
    for row in report.get('matches', []) if isinstance(report, dict) else []:
        if not isinstance(row, dict) or row.get('analysis_status') != 'complete':
            continue
        if (row.get('analysis') or {}).get('analysis_revision', 0) >= ANALYSIS_REVISION:
            continue
        state = row.get('analysis_upgrade') or {}
        if state.get('revision') == ANALYSIS_REVISION and state.get('attempts', 0) >= 3:
            continue  # given up on for this revision (its replay is gone)
        count += 1
    return count


def backlog(data_root=None):
    root = Path(data_root or ROOT / 'site/data')
    total = 0
    for path in [root / 'report.json', *sorted(root.glob('profiles/*/report.json'))]:
        try:
            total += outdated(json.loads(path.read_text(encoding='utf-8')))
        except (OSError, ValueError):
            continue
    return total


if __name__ == '__main__':
    print(backlog())
