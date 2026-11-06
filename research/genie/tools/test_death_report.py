import unittest
from death_report import parse, render
class DeathReportTests(unittest.TestCase):
 def test_deaths_separate_from_disappearance_and_conversion(self):
  d=parse('DEATH_EVENT ms=1500 player=1 id=30 master=83 class=4 degraded=false\nDEATH_EVENT ms=2000 player=1 id=30 master=83 class=4 degraded=false\nDEATH_UNRESOLVED ms=2000 player=1 id=31 master=83\nDEATH_OWNER ms=2000 id=32 from=1 to=2\nDEATH_STOP ms=2500 player=1\nDEATH_END ms=3000 updates=10 syncs=20')
  self.assertEqual(len(d['events']),1);self.assertEqual(len(d['unresolved']),1);self.assertEqual(len(d['ownership']),1)
  self.assertFalse(d['events'][0]['degraded']);self.assertEqual(d['stops'][0]['ms'],2500)
  self.assertIn('0:02',render({'<test>':d}));self.assertNotIn('<test>',render({'<test>':d}))
 def test_empty_log_is_not_success(self):
  d=parse('engine error');self.assertIsNone(d['end']);self.assertIn('완료 기록 없음',render({'run':d}))
if __name__=='__main__': unittest.main()
