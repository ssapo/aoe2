import io
import json
import unittest
from compare_object_window import compare


def engine(ms, *, x=1.0, player=1, object_id=10, held=0.0):
    return "OBJECT " + json.dumps({"ms": ms, "player": player, "id": object_id,
        "position": [x, 2.0], "held": held, "state": 2, "master": 83}) + "\n"


def truth(ms, *, x=1.0, held=0.0, objects=True, extra=False):
    obj = [10, 83, 2, held, x, 2.0, 0, 0, 0, 0]
    if extra:
        obj.extend(["held_raw", {"k": 5, "m": "raw"}])
    return json.dumps({"ms": ms, "players": [{"p": 1, "o": [obj] if objects else []}]}) + "\n"


class ComparisonTests(unittest.TestCase):
    def run_compare(self, engine_rows, truth_rows, **kwargs):
        return compare(io.StringIO("".join(engine_rows)), io.StringIO("".join(truth_rows)),
                       start_ms=0, end_ms=10000, **kwargs)

    def test_single_torn_sample_is_not_confirmed(self):
        result = self.run_compare([engine(t) for t in (1, 2, 3, 4)],
            [truth(1), truth(2, x=1.1), truth(3), truth(4)])
        self.assertEqual(result["differences"], [])

    def test_three_samples_confirm_the_start_and_field(self):
        result = self.run_compare([engine(t) for t in (1, 2, 3)],
                                 [truth(t, x=1.1, extra=True) for t in (1, 2, 3)])
        row, = result["differences"]
        self.assertEqual((row["first_ms"], row["confirmed_ms"], row["samples"], row["field"]),
                         (1, 3, 3, "position"))

    def test_missing_timestamp_breaks_confirmation(self):
        result = self.run_compare([engine(t) for t in (1, 2, 4, 5)],
                                 [truth(t, x=1.1) for t in (1, 2, 3, 4, 5)])
        self.assertEqual(result["differences"], [])
        self.assertEqual(result["counts"]["truth_samples_without_engine_timestamp"], 1)

    def test_missing_object_breaks_confirmation(self):
        result = self.run_compare([engine(t) for t in range(1, 6)],
            [truth(t, x=1.1, objects=t != 3) for t in range(1, 6)])
        self.assertEqual(result["differences"], [])

    def test_player_is_part_of_object_identity(self):
        with self.assertRaisesRegex(ValueError, "No comparable"):
            self.run_compare([engine(t, player=2) for t in (1, 2, 3)],
                             [truth(t, x=1.1) for t in (1, 2, 3)])

    def test_float32_rounding_is_compared_not_python_double(self):
        result = self.run_compare([engine(t, x=0.1) for t in (1, 2, 3)],
            [truth(t, x=0.10000000149011612) for t in (1, 2, 3)])
        self.assertEqual(result["differences"], [])

    def test_actual_census_three_coordinate_position(self):
        rows = []
        for ms in (1, 2, 3):
            row = json.loads(engine(ms)[7:])
            row["position"].append(7.0)
            rows.append("OBJECT " + json.dumps(row) + "\n")
        result = self.run_compare(rows, [truth(t) for t in (1, 2, 3)])
        self.assertEqual(result["differences"], [])
        self.assertEqual(result["counts"]["compared_object_samples"], 3)

    def test_fields_have_separate_consecutive_runs(self):
        result = self.run_compare([engine(t) for t in (1, 2, 3)],
            [truth(1, x=1.1), truth(2, held=10.0), truth(3, x=1.1)])
        self.assertEqual(result["differences"], [])

    def test_zero_overlap_and_out_of_order_are_errors(self):
        with self.assertRaisesRegex(ValueError, "No comparable"):
            self.run_compare([engine(1)], [truth(2)])
        with self.assertRaisesRegex(ValueError, "increase strictly"):
            self.run_compare([engine(1)], [truth(2), truth(1)])

    def test_duplicate_engine_record_is_not_silently_overwritten(self):
        with self.assertRaisesRegex(ValueError, "Duplicate engine"):
            self.run_compare([engine(1), engine(1, x=2.0)], [truth(1)])

    def test_nonfinite_values_fail(self):
        with self.assertRaisesRegex(ValueError, "finite"):
            self.run_compare([engine(1, x=float("nan"))], [truth(1)])


if __name__ == "__main__":
    unittest.main()
