"""Write site/data/version.json: which site code, analysis revision and engine made the published data.

Run by the collection workflow before the report is kept. GITHUB_SHA is the site commit; the engine values
come from the workflow's engine step (ENGINE_RESEARCH_COMMIT, ENGINE_PATCH_SHA) and are absent when the
engine was not built in that run.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from collect import ANALYSIS_REVISION, ROOT
from engine_income import engine_version


def version(env=None):
    env = os.environ if env is None else env
    out = {'schema_version': 1, 'analysis_revision': ANALYSIS_REVISION,
           'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds')}
    site = env.get('GITHUB_SHA', '').strip()[:7]
    if site:
        out['site_commit'] = site
    engine = engine_version(env)
    if engine:
        out['engine'] = engine
    return out


def main(path=None):
    path = Path(path or ROOT / 'site/data/version.json')
    path.write_text(json.dumps(version(), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
