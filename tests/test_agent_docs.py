"""Every AI tool gets the same instructions: AGENTS.md is the only rule file.

Tool-specific entry files (CLAUDE.md for Claude Code, GEMINI.md, .github/copilot-instructions.md,
.cursorrules) may exist only as pointers to AGENTS.md, so no tool can see a rule the others do not."""
import re,unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
POINTERS=['CLAUDE.md','GEMINI.md','.github/copilot-instructions.md','.cursorrules']
REQUIRED=['ONBOARDING.md','회사 메일','noreply@anthropic.com','noreply@openai.com','모든 경기에서 같은 칸']


class AgentDocsTests(unittest.TestCase):
    def test_agents_md_holds_the_rules(self):
        text=(ROOT/'AGENTS.md').read_text(encoding='utf-8')
        for needle in REQUIRED:
            self.assertIn(needle,text)

    def test_tool_specific_files_only_point_to_agents_md(self):
        for name in POINTERS:
            path=ROOT/name
            if not path.exists():continue
            text=path.read_text(encoding='utf-8')
            self.assertIn('AGENTS.md',text,name)
            body=[l for l in text.splitlines() if l.strip() and not l.startswith('#') and 'AGENTS.md' not in l]
            self.assertEqual(body,[],f'{name} must not carry its own rules')

    def test_shared_docs_do_not_give_one_tool_its_own_author_rule(self):
        for name in ['ONBOARDING.md','DEVELOPMENT.md','README.md']:
            text=(ROOT/name).read_text(encoding='utf-8')
            self.assertIsNone(re.search(r'커밋 작성자는 `Claude <noreply@anthropic\.com>`\.',text),name)


if __name__=='__main__':unittest.main()
