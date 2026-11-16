import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

root = Path(__file__).resolve().parents[1]


class BuildPreviewTests(unittest.TestCase):
    def test_civ_icons_are_inlined(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'p.html'
            subprocess.run([sys.executable, str(root / 'scripts/build_preview.py'), str(out)], check=True, capture_output=True)
            html = out.read_text(encoding='utf-8')
        self.assertNotIn('assets/civs/', html)
        self.assertIn('const civIconData={', html)
        self.assertIn('data:image/png;base64,', html)


if __name__ == '__main__':
    unittest.main()
