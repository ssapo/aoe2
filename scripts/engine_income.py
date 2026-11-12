"""Cumulative income per resource from the re-simulation engine.

The engine (librematch/genie plus the research patch of branch research/genie-188329)
replays the recording with the game's data and prints every player's stockpile after
each update and, at each of the recording's checkpoints, the checkpoint words it
computes beside the recorded ones. Income here is the sum of the stockpile's
increases per resource between updates (about 13-28 ms apart): what was dropped
off, plus refunds and market or tribute gains; a gain and a spending inside one
update net out.

The curves are kept only up to the last checkpoint at which the engine's stockpile
word still equals the recording's for both players ("verified"); past it the
simulation has left the real game. Without the engine or its data (environment
AOE2_ENGINE_BIN, AOE2_ENGINE_DATA) nothing is produced.
"""
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

STEP = 10                 # seconds between stored points
MIN_VERIFIED = 300        # a shorter verified span is not shown
TIMEOUT = 600
UPDATES = '90000'         # about 20 game minutes: longer than any span verified so far
ORDER = (0, 1, 3, 2)      # engine: food, wood, stone, gold -> stored: food, wood, gold, stone
_CP = re.compile(r'CPWORDS syncs=\d+ world_ms=(\d+) player=(\d+) rec=\[(.*?)\] eng=\[(.*?)\]')


def parse_output(lines):
    """({player: [(ms, [food, wood, stone, gold])]}, {player: verified_ms}) from the engine's stderr."""
    stock, checks = {}, {}
    for line in lines:
        if line.startswith('RES '):
            try:
                row = json.loads(line[4:])
                stock.setdefault(int(row['player']), []).append((int(row['ms']), [float(v) for v in row['res'][:4]]))
            except (ValueError, KeyError, TypeError):
                continue
        elif line.startswith('CPWORDS'):
            m = _CP.match(line)
            if m:
                rec, eng = m.group(3).split(','), m.group(4).split(',')
                same = len(rec) > 1 and len(eng) > 1 and rec[1].strip() == eng[1].strip()
                checks.setdefault(int(m.group(2)), []).append((int(m.group(1)), same))
    verified = {}
    for player, rows in checks.items():
        last = 0
        for ms, same in rows:
            if not same:
                break
            last = ms
        verified[player] = last
    return stock, verified


def _cumulative(rows, until_ms):
    """[(seconds, [food, wood, gold, stone])] every STEP seconds up to until_ms."""
    out, total, prev, mark = [], [0.0] * 4, None, 0
    for ms, res in rows:
        if ms > until_ms:
            break
        if prev is not None:
            for i in range(4):
                if res[i] > prev[i]:
                    total[i] += res[i] - prev[i]
        prev = res
        while ms >= mark * 1000:
            out.append((mark, [round(total[i]) for i in ORDER]))
            mark += STEP
    return out, [round(total[i]) for i in ORDER]


def income(lines, own_number, opponent_number, offset=0.0):
    """The stored income curve of a 1v1, or None when too little is verified."""
    stock, verified = parse_output(lines)
    if own_number not in stock or opponent_number not in stock:
        return None
    until = min(verified.get(own_number, 0), verified.get(opponent_number, 0))
    if until < MIN_VERIFIED * 1000:
        return None
    mine, mine_total = _cumulative(stock[own_number], until)
    theirs, theirs_total = _cumulative(stock[opponent_number], until)
    points = [[round(t + offset, 1)] + a + b for (t, a), (_, b) in zip(mine, theirs)]
    if len(points) < 2:
        return None
    return {
        'source': 'engine_resimulation',
        'columns': ['seconds', 'own_food', 'own_wood', 'own_gold', 'own_stone',
                    'opponent_food', 'opponent_wood', 'opponent_gold', 'opponent_stone'],
        'points': points,
        'verified_until_seconds': round(until / 1000 + offset, 1),
        'own_total': mine_total, 'opponent_total': theirs_total,
    }


def _switches(path):
    env = {}
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env[key] = value
    return env


def run_engine(recording):
    """The engine's stderr lines for the recording's bytes (.aoe2record), or None."""
    binary, data = os.environ.get('AOE2_ENGINE_BIN'), os.environ.get('AOE2_ENGINE_DATA')
    if not binary or not data or not Path(binary).is_file() or not Path(data).is_file():
        return None
    switches = Path(__file__).resolve().parent.parent / 'engine' / 'switches.env'
    env = dict(os.environ, **_switches(switches), GENIE_TRACE_RES='1', GENIE_PRINT_CHECKPOINTS='1')
    with tempfile.TemporaryDirectory() as folder:
        rec, err = Path(folder) / 'replay.aoe2record', Path(folder) / 'engine.err'
        rec.write_bytes(recording)
        try:
            with err.open('wb') as sink:
                subprocess.run([binary, str(rec), data, UPDATES], env=env, stdout=subprocess.DEVNULL,
                               stderr=sink, timeout=TIMEOUT, check=False)
        except (OSError, subprocess.TimeoutExpired):
            return None
        return err.read_text(encoding='utf-8', errors='replace').splitlines()


def engine_income(recording, match, own):
    """`analysis.engine_income` of `own` and its 1v1 opponent, or None."""
    opponents = [p for p in match.players if p.number != own.number]
    if len(opponents) != 1 or match.restored_at.total_seconds() > 0:
        return None
    lines = run_engine(recording)
    if not lines:
        return None
    return income(lines, own.number, opponents[0].number)
