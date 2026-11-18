"""Version stamps (engine result, site/data/version.json) and the outdated-analysis backlog."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import backlog
import collect
import engine_income
import site_version


class VersionTests(unittest.TestCase):
    def test_engine_version_from_the_workflow_environment(self):
        self.assertIsNone(engine_income.engine_version({}))
        env = {'ENGINE_RESEARCH_COMMIT': '6780a04abcdef', 'ENGINE_PATCH_SHA': '26c6a1700ef167a8befe71b7'}
        self.assertEqual(engine_income.engine_version(env), {'research_commit': '6780a04', 'patch_sha256': '26c6a1700ef1'})
        self.assertEqual(engine_income.engine_version({'ENGINE_PATCH_SHA': 'abc'}), {'patch_sha256': 'abc'})

    def test_site_version(self):
        v = site_version.version({'GITHUB_SHA': 'e988460123', 'ENGINE_RESEARCH_COMMIT': '6780a04aa'})
        self.assertEqual(v['analysis_revision'], collect.ANALYSIS_REVISION)
        self.assertEqual(v['site_commit'], 'e988460')
        self.assertEqual(v['engine'], {'research_commit': '6780a04'})
        self.assertNotIn('engine', site_version.version({}))
        self.assertNotIn('site_commit', site_version.version({}))

    def test_backlog_counts_retryable_outdated_analyses(self):
        r = collect.ANALYSIS_REVISION
        rows = [
            {'analysis_status': 'complete', 'analysis': {'analysis_revision': r}},
            {'analysis_status': 'complete', 'analysis': {'analysis_revision': r - 1}},
            {'analysis_status': 'complete', 'analysis': {'analysis_revision': r - 1},
             'analysis_upgrade': {'revision': r, 'attempts': 3}},
            {'analysis_status': 'complete', 'analysis': {'analysis_revision': r - 1},
             'analysis_upgrade': {'revision': r, 'attempts': 1}},
            {'analysis_status': 'pending', 'analysis': None},
        ]
        self.assertEqual(backlog.outdated({'matches': rows}), 2)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'profiles/5').mkdir(parents=True)
            (root / 'report.json').write_text(json.dumps({'matches': rows}), encoding='utf-8')
            (root / 'profiles/5/report.json').write_text(json.dumps({'matches': rows[1:2]}), encoding='utf-8')
            (root / 'profiles/6').mkdir()
            (root / 'profiles/6/report.json').write_text('not json', encoding='utf-8')
            self.assertEqual(backlog.backlog(root), 3)


if __name__ == '__main__':
    unittest.main()
