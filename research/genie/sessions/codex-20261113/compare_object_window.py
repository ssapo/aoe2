"""Compare a bounded engine OBJECT trace with v4/v5 truth samples.

Exact game milliseconds only: no interpolation or nearest-tick matching.
Exit 0 means no sustained difference in the samples compared, 1 a sustained
difference, and 2 invalid input or no comparison coverage. This is a diagnostic,
not a proof that the complete simulation matches the original game.
"""
import argparse
import json
import math
import struct
import sys
from collections import defaultdict


FIELDS = ("position", "held", "state", "master")


def f32_bits(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Expected a finite float32 value")
    return struct.pack(">f", value).hex()


def signature(field, value):
    if field == "position":
        if not isinstance(value, (list, tuple)) or len(value) != 2:
            raise ValueError("Expected an x/y position pair")
        return tuple(f32_bits(v) for v in value)
    if field == "held":
        return f32_bits(value)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError("Expected an integer state/master")
    return value


def integer(value):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("Expected a nonnegative integer timestamp/player/id")
    return value


def decode(line, number):
    try:
        return json.loads(line)
    except (ValueError, TypeError) as error:
        raise ValueError(f"Invalid JSON on line {number}") from error


def compare(engine_lines, truth_lines, *, start_ms, end_ms, samples=3,
            players=None, ids=None, fields=FIELDS):
    if start_ms < 0 or end_ms < start_ms or samples < 1:
        raise ValueError("Invalid time window or sample count")
    indexed = defaultdict(dict)
    for number, line in enumerate(engine_lines, 1):
        if not line.startswith("OBJECT "):
            continue
        row = decode(line[7:], number)
        ms = integer(row["ms"])
        if not start_ms <= ms <= end_ms:
            continue
        player, object_id = integer(row["player"]), integer(row["id"])
        if players is not None and player not in players or ids is not None and object_id not in ids:
            continue
        key = player, object_id
        if key in indexed[ms]:
            raise ValueError(f"Duplicate engine object at ms={ms}, player={player}, id={object_id}")
        values = {f: row[f] for f in fields}
        if "position" in values:
            position = values["position"]
            # Census serializes Position as [x, y, height]; v4/v5 truth columns
            # 4/5 contain only x/y. Height is deliberately outside this tool.
            if not isinstance(position, list) or len(position) not in (2, 3):
                raise ValueError("Expected engine position [x, y] or [x, y, height]")
            values["position"] = position[:2]
        for field, value in values.items():
            signature(field, value)
        indexed[ms][key] = values

    runs, confirmed, counts = {}, {}, defaultdict(int)
    previous_ms = None
    for number, line in enumerate(truth_lines, 1):
        row = decode(line, number)
        ms = integer(row["ms"])
        if previous_ms is not None and ms <= previous_ms:
            raise ValueError("Truth timestamps must increase strictly; split restarted recordings")
        previous_ms = ms
        if ms < start_ms:
            continue
        if ms > end_ms:
            break
        counts["truth_samples_in_window"] += 1
        engine = indexed.get(ms)
        if not engine:
            counts["truth_samples_without_engine_timestamp"] += 1
            runs.clear()  # An unobserved sample cannot extend a consecutive run.
            continue
        counts["aligned_timestamps"] += 1
        seen = set()
        for player_row in row["players"]:
            player = integer(player_row["p"])
            if players is not None and player not in players:
                continue
            for obj in player_row["o"]:
                object_id = integer(obj[0])
                if ids is not None and object_id not in ids:
                    continue
                key = player, object_id
                if key in seen:
                    raise ValueError(f"Duplicate truth object at ms={ms}, player={player}, id={object_id}")
                seen.add(key)
                expected = {"position": obj[4:6], "held": obj[3], "state": obj[2], "master": obj[1]}
                actual = engine.get(key)
                if actual is None:
                    counts["truth_objects_without_engine_object"] += 1
                    continue
                counts["compared_object_samples"] += 1
                for field in fields:
                    wanted, got = expected[field], actual[field]
                    run_key = player, object_id, field
                    wanted_bits, got_bits = signature(field, wanted), signature(field, got)
                    if wanted_bits == got_bits:
                        runs.pop(run_key, None)
                        continue
                    counts["different_field_samples"] += 1
                    run = runs.setdefault(run_key, {"player": player, "id": object_id, "field": field,
                        "first_ms": ms, "samples": 0, "truth": wanted, "engine": got,
                        "truth_bits": wanted_bits, "engine_bits": got_bits})
                    run["samples"] += 1
                    if run["samples"] >= samples and run_key not in confirmed:
                        confirmed[run_key] = dict(run, confirmed_ms=ms)
        # Missing objects (or an ownership change) break a run, too.
        for run_key in list(runs):
            key = run_key[:2]
            if key not in seen or key not in engine:
                del runs[run_key]

    if not counts["compared_object_samples"]:
        raise ValueError("No comparable object samples: check replay identity, window, IDs, and trace coverage")
    differences = sorted(confirmed.values(), key=lambda r: (r["first_ms"], r["player"], r["id"], r["field"]))
    return {"status": "sustained_difference" if differences else "no_sustained_difference_in_compared_samples",
            "window_ms": [start_ms, end_ms], "minimum_consecutive_samples": samples,
            "matching": "exact_game_ms_and_player_and_object_id", "counts": dict(counts),
            "differences": differences,
            "limits": ["No interpolation; missing coverage breaks a run.",
                       "Input files must describe the same replay/build/configuration; identity is not encoded in truth logs.",
                       "Three truth samples are not necessarily three engine ticks; later truth sampling is sparse.",
                       "Position differences do not establish the cause or prove a resource error."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("engine", help="census stderr containing OBJECT JSON lines")
    parser.add_argument("truth", help="Original-game truth v4/v5 JSONL from the same replay")
    parser.add_argument("--start-ms", type=int, required=True)
    parser.add_argument("--end-ms", type=int, required=True)
    parser.add_argument("--samples", type=int, default=3)
    parser.add_argument("--player", type=int, action="append")
    parser.add_argument("--id", type=int, action="append")
    parser.add_argument("--field", choices=FIELDS, action="append")
    args = parser.parse_args()
    try:
        with open(args.engine, encoding="utf-8") as engine, open(args.truth, encoding="utf-8-sig") as truth:
            result = compare(engine, truth, start_ms=args.start_ms, end_ms=args.end_ms,
                samples=args.samples, players=set(args.player) if args.player else None,
                ids=set(args.id) if args.id else None, fields=tuple(args.field or FIELDS))
        print(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2))
        return int(bool(result["differences"]))
    except (OSError, ValueError, KeyError, IndexError, TypeError, OverflowError, struct.error) as error:
        print(json.dumps({"status": "invalid_or_uncovered", "error": str(error)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
