from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace as O
from unittest import TestCase
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from mgz import fast
from movement import command_activity


class MovementTests(TestCase):
    def test_raw_selections_are_not_reused_across_players_or_missing_commands(self):
        own = O(number=1, team=[])
        match = O(players=[own, O(number=2)], map=O(dimension=120),
                  restored_at=timedelta(seconds=60))
        def action(kind, pid, ids, x=20, y=30):
            return fast.Operation.ACTION, (kind, dict(player_id=pid, object_ids=ids, x=x, y=y))
        ops = [(fast.Operation.SYNC, (2000, None, None)),
               action(fast.Action.MOVE, 1, [11, 12, 12]),
               action(fast.Action.MOVE, 2, []),
               action(fast.Action.MOVE, 1, []),
               action(fast.Action.PATROL, 1, [12, 11]),
               action(fast.Action.MOVE, 2, [11, 12]),
               action(fast.Action.GATHER_POINT, 1, [11]),
               action(fast.Action.BUILD, 1, [11]),
               action(fast.Action.MOVE, 3, [11]),
               action(fast.Action.MOVE, 1, [11], x=-1),
               action(fast.Action.MOVE, 1, [11], x=float('nan')), EOFError()]
        with patch('mgz.fast.header.parse'), patch('mgz.fast.meta'), patch('mgz.fast.operation', side_effect=ops):
            result = command_activity(b'', match, own)
        self.assertEqual(len(result), 5)
        self.assertEqual([e['selected_count'] for e in result], [2, None, None, 2, 2])
        self.assertEqual(result[0]['seconds'], 62)
        self.assertEqual(result[1]['side'], 'theirs')
        self.assertEqual(result[0]['group'], result[3]['group'])
        self.assertNotEqual(result[0]['group'], result[4]['group'])
        self.assertNotIn('group', result[1])
        self.assertNotIn('object_ids', result[0])
