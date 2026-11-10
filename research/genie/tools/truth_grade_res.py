#!/usr/bin/env python3
"""grade_res.py - score the engine's resource numbers against the ground truth of replay 518239882.

usage: grade_res.py <engine stderr file> [--truth-dir DIR] [--out DIR] [--offset-ms N] [--refund-step N]
       grade_res.py --self-test [--truth-dir DIR] [--out DIR]

Engine file: any text (UTF-8 or UTF-16 with BOM), lines of interest
  RES {"ms":<int>,"player":<1|2>,"res":[food,wood,stone,gold]}
  CPWORDS syncs=<n> world_ms=<ms> player=<p> rec=[11 ints] eng=[11 ints]
Truth: <truth-dir>/cache_res.csv  (no header: ms,p1 food,wood,stone,gold,p2 food,wood,stone,gold)
       optional <truth-dir>/resources_10s.csv, resources_10s_deposits.csv (cross-check / deposit reference)
Standard library only.
"""
import sys, os, re, json, csv, bisect, argparse

RN = ['food', 'wood', 'stone', 'gold']
THR = [0.01, 1.0, 10.0, 50.0]
HERE = os.path.dirname(os.path.abspath(__file__))
ALIGN_RULE = ("Alignment: at every truth sample time t (game ms; truth has a sample for nearly every tick up to "
              "120 s, about every 224 ms afterwards) the truth value is compared with the engine value of the "
              "latest RES line whose ms <= t (+ --offset-ms, default 0). Truth samples earlier than the first "
              "engine RES line or later than the last one are not compared. If several RES lines carry the same "
              "ms and player, the last one wins. 10 s tables use, for each side, its own latest sample <= t.")


def read_text_lines(path):
    with open(path, 'rb') as f:
        head = f.read(4)
    enc = 'utf-8'
    if head[:2] in (b'\xff\xfe', b'\xfe\xff'):
        enc = 'utf-16'
    elif head[:3] == b'\xef\xbb\xbf':
        enc = 'utf-8-sig'
    elif len(head) == 4 and head[1] == 0 and head[3] == 0:
        enc = 'utf-16-le'
    with open(path, 'r', encoding=enc, errors='replace', newline=None) as f:
        for line in f:
            yield line


CP_RE = re.compile(r'CPWORDS\s+syncs=(\d+)\s+world_ms=(-?\d+)\s+player=(\d+)\s+rec=\[([^\]]*)\]\s+eng=\[([^\]]*)\]')


def parse_engine(path):
    """-> (series {player: (ms list, [4 lists])}, cps list, stats)"""
    raw = {}
    cps = []
    st = dict(lines=0, res_ok=0, res_bad=0, res_dup=0, res_other_player=0, cp_ok=0, cp_bad=0, res_out_of_order=0)
    lastms = {}
    for line in read_text_lines(path):
        st['lines'] += 1
        i = line.find('RES ')
        if i >= 0 and (i == 0 or not line[i - 1].isalnum()):
            j = line.find('{', i)
            k = line.rfind('}')
            try:
                if j < 0:
                    raise ValueError('no json')
                d = json.loads(line[j:k + 1])
                ms = int(d['ms']); p = int(d['player']); r = [float(x) for x in d['res'][:4]]
                if len(r) != 4 or any(x != x or x in (float('inf'), float('-inf')) for x in r):
                    raise ValueError('res')
            except Exception:
                st['res_bad'] += 1
                continue
            st['res_ok'] += 1
            if p not in (1, 2):
                st['res_other_player'] += 1
                continue
            dd = raw.setdefault(p, {})
            if ms in dd:
                st['res_dup'] += 1
            if ms < lastms.get(p, -1 << 62):
                st['res_out_of_order'] += 1
            lastms[p] = ms
            dd[ms] = r
            continue
        if 'CPWORDS' in line:
            m = CP_RE.search(line)
            try:
                rec = [int(x) for x in m.group(4).split(',')]
                eng = [int(x) for x in m.group(5).split(',')]
                if len(rec) != len(eng) or not rec:
                    raise ValueError
                cps.append((int(m.group(1)), int(m.group(2)), int(m.group(3)), rec, eng))
                st['cp_ok'] += 1
            except Exception:
                st['cp_bad'] += 1
    series = {}
    for p, dd in raw.items():
        mss = sorted(dd)
        series[p] = (mss, [[dd[m][x] for m in mss] for x in range(4)])
    return series, cps, st


def load_truth(tdir):
    mss = []; vals = {1: [[], [], [], []], 2: [[], [], [], []]}
    bad = 0
    with open(os.path.join(tdir, 'cache_res.csv'), newline='') as f:
        for r in csv.reader(f):
            try:
                v = [float(x) for x in r]
                if len(v) < 9:
                    raise ValueError
            except Exception:
                bad += 1
                continue
            ms = int(v[0])
            if mss and ms <= mss[-1]:
                bad += 1
                continue
            mss.append(ms)
            for x in range(4):
                vals[1][x].append(v[1 + x]); vals[2][x].append(v[5 + x])
    return {1: (mss, vals[1]), 2: (mss, vals[2])}, bad


def value_at(mss, vals, t):
    i = bisect.bisect_right(mss, t) - 1
    return None if i < 0 else vals[i]


def cum_positive(vals, refund_step=0.0):
    """running sum of positive changes; -> (cum list, refund cum list).
    A positive change is a 'probable refund' when it is >= refund_step and within 0.005 of a multiple of it."""
    cum = [0.0]; ref = [0.0]
    for a, b in zip(vals, vals[1:]):
        d = b - a
        c = cum[-1]; r = ref[-1]
        if d > 0:
            c += d
            if refund_step > 0 and d >= refund_step - 0.005:
                q = d / refund_step
                if abs(q - round(q)) * refund_step <= 0.005:
                    r += d
        cum.append(c); ref.append(r)
    return cum, ref


def fmt(x, n=3):
    if x is None:
        return ''
    return ('%.*f' % (n, x)).rstrip('0').rstrip('.') if x == x else 'nan'


def fs(ms):
    return 'never' if ms is None else '%.3f' % (ms / 1000.0)


def grade_cp(cps):
    """per player: verified-until for word 1 and for all words"""
    out = {}
    rows = []
    byp = {}
    for c in cps:
        byp.setdefault(c[2], []).append(c)
    for p in sorted(byp):
        lst = byp[p]
        info = dict(n=len(lst), first_ms=lst[0][1], last_ms=lst[-1][1], w1_until=None, all_until=None, w4_until=None,
                    w1_first_bad=None, all_first_bad=None, w4_first_bad=None, w1_matches=0, all_matches=0)
        w1ok = allok = w4ok = True
        for (syncs, ms, _, rec, eng) in lst:
            diff = [i for i in range(min(len(rec), len(eng))) if rec[i] != eng[i]]
            m1 = len(rec) > 1 and rec[1] == eng[1]
            m4 = len(rec) > 4 and rec[4] == eng[4]
            ma = not diff
            info['w1_matches'] += m1; info['all_matches'] += ma
            if w1ok:
                if m1: info['w1_until'] = ms
                else:
                    w1ok = False; info['w1_first_bad'] = (ms, syncs, rec[1], eng[1])
            if w4ok:
                if m4: info['w4_until'] = ms
                else:
                    w4ok = False; info['w4_first_bad'] = (ms, syncs, rec[4], eng[4])
            if allok:
                if ma: info['all_until'] = ms
                else:
                    allok = False; info['all_first_bad'] = (ms, syncs, [(i, rec[i], eng[i]) for i in diff])
            rows.append([syncs, ms, p, int(m1), int(m4), int(ma), ' '.join(map(str, diff)),
                         rec[1] if len(rec) > 1 else '', eng[1] if len(eng) > 1 else '',
                         rec[4] if len(rec) > 4 else '', eng[4] if len(eng) > 4 else ''])
        out[p] = info
    return out, rows


def grade(engine_path, tdir, out, offset_ms=0, refund_step=25.0, quiet=False):
    os.makedirs(out, exist_ok=True)
    eng, cps, st = parse_engine(engine_path)
    truth, tbad = load_truth(tdir)
    L = []   # summary.md lines
    P = L.append
    P('# Resource grade: engine vs truth (replay 518239882)')
    P('')
    P('- engine file: `%s` (%d lines; RES ok %d, invalid %d, same-ms overwrites %d, other players %d, out of order %d; CPWORDS ok %d, invalid %d)'
      % (engine_path, st['lines'], st['res_ok'], st['res_bad'], st['res_dup'], st['res_other_player'],
         st['res_out_of_order'], st['cp_ok'], st['cp_bad']))
    tm = truth[1][0]
    P('- truth: `%s` cache_res.csv, %d samples, %.3f s .. %.3f s (%d rows rejected)'
      % (tdir, len(tm), tm[0] / 1000.0, tm[-1] / 1000.0, tbad))
    P('- ' + ALIGN_RULE)
    if offset_ms:
        P('- offset applied: engine time = truth time + %d ms' % offset_ms)
    P('- player 1 = ssapo, player 2 = opponent. Times are game seconds.')
    P('')

    result = dict(stats=st, players={}, cp={})
    thr_rows = []; stock_rows = []; gath_rows = []
    tend = (tm[-1] // 10000 + (1 if tm[-1] % 10000 else 0)) * 10
    steps = list(range(0, tend + 1, 10))

    # optional truth reference files
    ref10 = {}; dep10 = {}
    try:
        with open(os.path.join(tdir, 'resources_10s.csv'), newline='') as f:
            for r in csv.DictReader(f):
                ref10[int(float(r['time_s']))] = r
    except Exception:
        pass
    try:
        with open(os.path.join(tdir, 'resources_10s_deposits.csv'), newline='') as f:
            for r in csv.DictReader(f):
                dep10[int(float(r['time_s']))] = r
    except Exception:
        pass

    verdict = []
    for p in (1, 2):
        tms, tv = truth[p]
        pr = dict(have=False)
        result['players'][p] = pr
        if p not in eng or not eng[p][0]:
            P('## Player %d: no RES lines in the engine file' % p); P('')
            verdict.append('player %d: no engine RES data' % p)
            continue
        ems, ev = eng[p]
        pr['have'] = True
        # compared truth indices
        lo = bisect.bisect_left(tms, ems[0] - offset_ms)
        hi = bisect.bisect_right(tms, ems[-1] - offset_ms)   # exclusive
        idx = range(lo, hi)
        pr['compared'] = len(idx)
        pr['from_ms'] = tms[lo] if lo < hi else None
        pr['to_ms'] = tms[hi - 1] if lo < hi else None
        P('## Player %d' % p)
        P('')
        P('Engine RES samples: %d, %.3f s .. %.3f s. Truth samples compared: %d (%s s .. %s s).'
          % (len(ems), ems[0] / 1000.0, ems[-1] / 1000.0, len(idx), fs(pr['from_ms']), fs(pr['to_ms'])))
        if lo > 0:
            P('Not compared: %d truth samples before the first engine sample.' % lo)
        if hi < len(tms):
            P('Not compared: %d truth samples after the last engine sample (engine ends at %.3f s, truth at %.3f s).'
              % (len(tms) - hi, ems[-1] / 1000.0, tms[-1] / 1000.0))
        P('')
        # engine resampled at truth times
        eidx = [bisect.bisect_right(ems, tms[i] + offset_ms) - 1 for i in idx]
        first = {x: {} for x in range(4)}      # resource -> thr -> (ms, truth, eng)
        mx = {}
        any_first = {}
        for x in range(4):
            best = (-1.0, None, None, None)
            tvx = tv[x]; evx = ev[x]
            pend = list(THR)
            for n, i in enumerate(idx):
                a = tvx[i]; b = evx[eidx[n]]
                d = abs(b - a)
                if d > best[0] + 1e-9:      # first sample reaching the maximum (ignores float noise)
                    best = (d, tms[i], a, b)
                while pend and d > pend[0]:
                    first[x][pend[0]] = (tms[i], a, b); pend.pop(0)
            mx[x] = best
            for th in THR:
                f1 = first[x].get(th)
                thr_rows.append([p, RN[x], th, fs(f1[0]) if f1 else '', fmt(f1[1]) if f1 else '', fmt(f1[2]) if f1 else '',
                                 fmt(f1[2] - f1[1]) if f1 else ''])
                if f1 and (th not in any_first or f1[0] < any_first[th][0]):
                    any_first[th] = (f1[0], RN[x], f1[1], f1[2])
            thr_rows.append([p, RN[x], 'max', fs(best[1]), fmt(best[2]), fmt(best[3]),
                             fmt(best[3] - best[2]) if best[1] is not None else ''])
        pr['first'] = first; pr['max'] = mx; pr['any_first'] = any_first
        P('First truth sample time (s) at which |engine - truth| exceeds each threshold, and the maximum:')
        P('')
        P('|resource|>0.01|>1|>10|>50|max abs diff|at (s)|truth|engine|')
        P('|---|---|---|---|---|---|---|---|---|')
        for x in range(4):
            b = mx[x]
            P('|%s|%s|%s|%s|%s|%s|%s|%s|%s|' % (RN[x], *[fs(first[x][th][0]) if th in first[x] else 'never' for th in THR],
                                             fmt(b[0], 4), fs(b[1]), fmt(b[2]), fmt(b[3])))
        P('')
        for th in THR:
            if th in any_first:
                a = any_first[th]
                P('- first difference > %g: %.3f s, %s truth %s engine %s (diff %s)'
                  % (th, a[0] / 1000.0, a[1], fmt(a[2]), fmt(a[3]), fmt(a[3] - a[2])))
        P('')

        # "until" times: last compared truth sample before the first exceedance
        def until(th):
            if not len(idx):
                return None, False
            if th not in any_first:
                return tms[hi - 1], True
            k = bisect.bisect_left(tms, any_first[th][0])
            return (tms[k - 1] if k - 1 >= lo else None), False
        u = [until(th) for th in (0.01, 1.0, 10.0)]
        pr['until'] = u

        def us(v):
            if v[0] is None:
                return 'not even at the first compared sample'
            return '%.3f s%s' % (v[0] / 1000.0, ' (end of compared data, never exceeded)' if v[1] else '')
        verdict.append('player %d: resources exact (|diff| <= 0.01) until %s, within 1 until %s, within 10 until %s'
                       % (p, us(u[0]), us(u[1]), us(u[2])))

        # gathered curves
        t_cum = []; t_ref = []; e_cum_s = []; e_ref_s = []; e_cum_n = []; e_ref_n = []
        for x in range(4):
            c, r = cum_positive(tv[x], refund_step); t_cum.append(c); t_ref.append(r)
            # engine resampled at the truth times it covers (same netting as truth)
            res_vals = [ev[x][k] for k in eidx]
            c, r = cum_positive(res_vals, refund_step); e_cum_s.append(c); e_ref_s.append(r)
            c, r = cum_positive(ev[x], refund_step); e_cum_n.append(c); e_ref_n.append(r)
        # truth cum at the first compared sample is the baseline, so both curves start at the same point
        base = [t_cum[x][lo] if lo < hi else 0.0 for x in range(4)]
        baser = [t_ref[x][lo] if lo < hi else 0.0 for x in range(4)]
        pr['gath_final'] = {}
        chk = 0.0
        for t in steps:
            tms_t = t * 1000
            ti = bisect.bisect_right(tms, tms_t) - 1
            ei = bisect.bisect_right(ems, tms_t + offset_ms) - 1
            si = min(ti, hi - 1) - lo if ti >= lo else -1      # index into resampled series
            for x in range(4):
                a = tv[x][ti] if ti >= 0 else None
                b = ev[x][ei] if ei >= 0 else None
                stock_rows.append([t, p, RN[x], fmt(a), fmt(b), fmt(b - a) if a is not None and b is not None else ''])
                if ti >= 0 and t in ref10:
                    try:
                        chk = max(chk, abs(float(ref10[t]['p%d_%s_cum' % (p, RN[x])]) - t_cum[x][ti]))
                    except Exception:
                        pass
                tc = t_cum[x][ti] if ti >= 0 else None
                tr = (t_cum[x][ti] - t_ref[x][ti]) if ti >= 0 else None
                td = None
                if t in dep10:
                    try:
                        td = float(dep10[t]['p%d_%s_deposited' % (p, RN[x])])
                    except Exception:
                        td = None
                beyond = ei >= 0 and tms_t + offset_ms > ems[-1] + 10000
                if si >= 0 and not beyond:
                    ec = e_cum_s[x][si] + base[x]
                    er = ec - (e_ref_s[x][si] + baser[x])
                else:
                    ec = er = None
                en = e_cum_n[x][ei] if ei >= 0 and not beyond else None
                enr = (e_cum_n[x][ei] - e_ref_n[x][ei]) if ei >= 0 and not beyond else None
                gath_rows.append([t, p, RN[x], fmt(tc, 2), fmt(ec, 2), fmt(ec - tc, 2) if ec is not None and tc is not None else '',
                                  fmt(en, 2), fmt(tr, 2), fmt(er, 2),
                                  fmt(er - tr, 2) if er is not None and tr is not None else '',
                                  fmt(enr, 2), fmt(td, 2), fmt(er - td, 2) if er is not None and td is not None else ''])
                if ec is not None:
                    pr['gath_final'][x] = (t, tc, ec, tr, er, td, en)
        pr['truth_cum_check'] = chk
        P('Stockpile every 10 s: see stock_10s.csv. Extract (every 60 s; truth / engine / diff):')
        P('')
        P('|t (s)|' + '|'.join(RN) + '|')
        P('|---|---|---|---|---|')
        byt = {}
        for r in stock_rows:
            if r[1] == p:
                byt.setdefault(r[0], {})[r[2]] = r
        for t in steps:
            if t % 60 == 0 and t in byt:
                P('|%d|' % t + '|'.join('%s / %s / %s' % (byt[t][n][3] or '-', byt[t][n][4] or '-', byt[t][n][5] or '-') for n in RN) + '|')
        P('')
        P('Gathered at the last 10 s step both sides cover (details in gathered_10s.csv):')
        P('')
        P('|resource|t (s)|truth sum of + changes|engine same method (resampled at truth times)|diff|engine native (every update)|truth excl. probable refunds|engine excl. probable refunds|diff|truth deposit-based (villager data)|')
        P('|---|---|---|---|---|---|---|---|---|---|')
        for x in range(4):
            g = pr['gath_final'].get(x)
            if g:
                P('|%s|%d|%s|%s|%s|%s|%s|%s|%s|%s|' % (RN[x], g[0], fmt(g[1], 2), fmt(g[2], 2), fmt(g[2] - g[1], 2), fmt(g[6], 2),
                                                    fmt(g[3], 2), fmt(g[4], 2), fmt(g[4] - g[3], 2), fmt(g[5], 2)))
        P('')
        if ref10:
            P('Check: truth "sum of positive changes" recomputed here vs resources_10s.csv: max deviation %.3f (that file is rounded to 0.01).' % chk)
            P('')

    # CPWORDS
    cpinfo, cprows = grade_cp(cps)
    result['cp'] = cpinfo
    P('## Checkpoint words (CPWORDS)')
    P('')
    if not cpinfo:
        P('No CPWORDS lines in the engine file.')
    else:
        P('"verified until" = world time of the last checkpoint up to which the word(s) matched at every checkpoint '
          '(rec = original game, eng = engine). Word 1 = checksum sum of the player\'s resources, word 4 = sum of amounts held by the player\'s objects.')
        P('')
        P('|player|checkpoints|range (s)|word 1 verified until (s)|first word-1 mismatch|word 4 verified until (s)|all words verified until (s)|first mismatch (word: rec/eng)|word-1 matches|all-word matches|')
        P('|---|---|---|---|---|---|---|---|---|---|')
        for p in sorted(cpinfo):
            c = cpinfo[p]
            b1 = c['w1_first_bad']; ba = c['all_first_bad']
            P('|%d|%d|%.3f-%.3f|%s|%s|%s|%s|%s|%d/%d|%d/%d|' % (
                p, c['n'], c['first_ms'] / 1000.0, c['last_ms'] / 1000.0,
                fs(c['w1_until']) if c['w1_until'] is not None else 'none',
                ('%.3f s (syncs %d): rec %d eng %d' % (b1[0] / 1000.0, b1[1], b1[2], b1[3])) if b1 else 'none (matches to the last checkpoint)',
                fs(c['w4_until']) if c['w4_until'] is not None else 'none',
                fs(c['all_until']) if c['all_until'] is not None else 'none',
                ('%.3f s (syncs %d): ' % (ba[0] / 1000.0, ba[1]) + ', '.join('w%d %d/%d' % t for t in ba[2])) if ba else 'none (matches to the last checkpoint)',
                c['w1_matches'], c['n'], c['all_matches'], c['n']))
    P('')
    P('## What the "gathered" numbers are and are not')
    P('')
    P('- Method 1 (truth and engine): sum of positive stockpile changes between consecutive samples. Includes refunds; a deposit and a spend inside one sample interval net out. '
      'For a like-for-like comparison the engine series is first resampled at the truth sample times (column engine_cum_resampled); '
      'engine_cum_native uses every engine update and can only be >= the resampled one.')
    P('- Method 2 for the truth (resources_10s_deposits.csv) uses villager carried amounts near drop-off buildings. That cannot be reproduced from RES lines: '
      'they contain stockpiles only, no villager data. From a stockpile series alone one can NOT tell a deposit from a refund or other income, '
      'can NOT see a deposit that is netted by a spend in the same sample, and can NOT attribute income to a source.')
    P('- What is derived instead (both sides, same rule): "excluding probable refunds" = method 1 minus every positive change that is >= %g and within 0.005 of a multiple of %g '
      '(villager 50 food, house 25 wood...; --refund-step changes it, 0 disables). It misses refunds of other sizes (e.g. 60, 35, partial refunds) and would wrongly drop '
      'a set of deposits that happens to add up to such a number in one sample. The column truth_deposit_based is given next to it as the reference.' % (refund_step, refund_step))
    P('')
    P('## Verdict')
    P('')
    for v in verdict:
        P('- ' + v)
    for p in sorted(cpinfo):
        c = cpinfo[p]
        if p in (1, 2):
            P('- player %d: checkpoint word 1 (resource checksum) verified until %s s, all words verified until %s s'
              % (p, fs(c['w1_until']) if c['w1_until'] is not None else 'none', fs(c['all_until']) if c['all_until'] is not None else 'none'))
    P('')

    def wcsv(name, head, rows):
        with open(os.path.join(out, name), 'w', newline='') as f:
            w = csv.writer(f); w.writerow(head); w.writerows(rows)
    wcsv('thresholds.csv', ['player', 'resource', 'threshold', 'first_time_s', 'truth', 'engine', 'diff'], thr_rows)
    wcsv('stock_10s.csv', ['time_s', 'player', 'resource', 'truth', 'engine', 'diff'], stock_rows)
    wcsv('gathered_10s.csv', ['time_s', 'player', 'resource', 'truth_cum', 'engine_cum_resampled', 'diff_cum', 'engine_cum_native',
                              'truth_excl_refunds', 'engine_excl_refunds', 'diff_excl_refunds', 'engine_excl_refunds_native',
                              'truth_deposit_based', 'engine_excl_refunds_minus_truth_deposit'], gath_rows)
    wcsv('cpwords.csv', ['syncs', 'world_ms', 'player', 'word1_match', 'word4_match', 'all_match', 'differing_words',
                         'rec_w1', 'eng_w1', 'rec_w4', 'eng_w4'], cprows)
    with open(os.path.join(out, 'summary.md'), 'w') as f:
        f.write('\n'.join(L) + '\n')
    if not quiet:
        print('\n'.join(L))
        print('written: %s (summary.md, thresholds.csv, stock_10s.csv, gathered_10s.csv, cpwords.csv)' % out)
    return result


def self_test(tdir, out):
    truth, _ = load_truth(tdir)
    tms = truth[1][0]
    os.makedirs(out, exist_ok=True)
    ok = True

    def write(path, inject):
        n = 0
        with open(path, 'w') as f:
            f.write('PIG_INITIAL player=0 id=1 capture=Some(0)\nRES not json\nRES {"ms":12,"player":1,"res":[1,2\n'
                    'RES {"ms":"x","player":1,"res":[1,2,3,4]}\nCPWORDS broken line\n')
            for i, ms in enumerate(tms):
                for p in (1, 2):
                    r = [truth[p][1][x][i] for x in range(4)]
                    for (ip, ix, ifrom, iamt) in inject:
                        if ip == p and ms >= ifrom:
                            r[ix] += iamt
                    f.write('RES {"ms":%d,"player":%d,"res":[%r,%r,%r,%r]}\n' % (ms, p, r[0], r[1], r[2], r[3]))
                    n += 1
                if i % 500 == 0:
                    f.write('TIMING update=%d garbage RESULT {"ms":1}\n' % i)
                    f.write('CPWORDS syncs=%d world_ms=%d player=1 rec=[0, 600, 1, 2, 3, 4, 5, 6, 7, 8, 9] eng=[0, %d, 1, 2, 3, 4, 5, 6, 7, 8, 9]\n'
                            % (i, ms, 600 if ms < 400000 else 601))
        return n

    # test 1: truth fed back
    p1 = os.path.join(out, 'selftest1.err')
    n = write(p1, [])
    r = grade(p1, tdir, os.path.join(out, 'selftest1'), quiet=True)
    print('SELF-TEST 1 (truth fed back as engine output, %d RES lines + 3 invalid RES lines)' % n)
    for p in (1, 2):
        pr = r['players'][p]
        mxd = max(pr['max'][x][0] for x in range(4))
        gd = max(abs(g[2] - g[1]) for g in pr['gath_final'].values())
        gr = max(abs(g[4] - g[3]) for g in pr['gath_final'].values())
        good = (mxd == 0.0 and not pr['any_first'] and pr['compared'] == len(tms) and gd < 1e-9 and gr < 1e-9
                and pr['until'][0] == (tms[-1], True))
        ok &= good
        print('  player %d: compared %d/%d samples, max abs diff %r, thresholds exceeded %d, gathered diff %r, excl-refund diff %r, exact until %.3f s -> %s'
              % (p, pr['compared'], len(tms), mxd, len(pr['any_first']), gd, gr, pr['until'][0][0] / 1000.0, 'PASS' if good else 'FAIL'))
        print('    truth cum vs resources_10s.csv max deviation %.4f; probable refunds found in truth: %s'
              % (pr['truth_cum_check'], ', '.join('%s %s' % (RN[x], fmt(g[1] - g[3], 2)) for x, g in sorted(pr['gath_final'].items()))))
    good = r['stats']['res_bad'] == 3 and r['stats']['cp_bad'] == 1
    ok &= good
    print('  invalid RES lines counted %d (expect 3), invalid CPWORDS %d (expect 1) -> %s'
          % (r['stats']['res_bad'], r['stats']['cp_bad'], 'PASS' if good else 'FAIL'))
    c = r['cp'].get(1)
    exp_until = max(ms for i, ms in enumerate(tms) if i % 500 == 0 and ms < 400000)
    exp_bad = min(ms for i, ms in enumerate(tms) if i % 500 == 0 and ms >= 400000)
    good = bool(c) and c['w1_until'] == exp_until and c['w1_first_bad'][0] == exp_bad and c['all_until'] == exp_until
    ok &= good
    print('  synthetic CPWORDS: word 1 verified until %s s (expect %.3f), first mismatch %s s (expect %.3f) -> %s'
          % (fs(c['w1_until']) if c else '?', exp_until / 1000.0, fs(c['w1_first_bad'][0]) if c else '?', exp_bad / 1000.0,
             'PASS' if good else 'FAIL'))

    # test 2: injected offsets
    inj = [(2, 1, 300000, 7.5), (1, 0, 600000, -60.0), (1, 3, 450000, 0.5)]
    p2 = os.path.join(out, 'selftest2.err')
    write(p2, inj)
    r = grade(p2, tdir, os.path.join(out, 'selftest2'), quiet=True)
    print('SELF-TEST 2 (injected: P2 wood +7.5 from 300 s; P1 gold +0.5 from 450 s; P1 food -60 from 600 s)')

    def first_at(ms):
        return tms[bisect.bisect_left(tms, ms)]
    exp = {  # (player, resource) -> (first sample, size, thresholds exceeded)
        (2, 1): (first_at(300000), 7.5, [0.01, 1.0]),
        (1, 0): (first_at(600000), 60.0, [0.01, 1.0, 10.0, 50.0]),
        (1, 3): (first_at(450000), 0.5, [0.01]),
    }
    for p in (1, 2):
        pr = r['players'][p]
        for x in range(4):
            e = exp.get((p, x))
            got = pr['first'][x]; mxd = pr['max'][x]
            if e is None:
                good = not got and mxd[0] == 0.0
                desc = 'no injection, max diff %r' % mxd[0]
            else:
                good = (sorted(got) == e[2] and all(got[t][0] == e[0] for t in got) and abs(mxd[0] - e[1]) < 1e-4
                        and mxd[1] == e[0])
                desc = ('expected first at %.3f s size %g; reported first >0.01 at %s s, thresholds exceeded %s, max abs diff %.4f at %s s'
                        % (e[0] / 1000.0, e[1], fs(got[0.01][0]) if 0.01 in got else 'never', sorted(got), mxd[0], fs(mxd[1])))
            ok &= good
            print('  player %d %-5s: %s -> %s' % (p, RN[x], desc, 'PASS' if good else 'FAIL'))
    u1 = r['players'][1]['until']; u2 = r['players'][2]['until']
    k = bisect.bisect_left(tms, 450000); k6 = bisect.bisect_left(tms, 600000); k3 = bisect.bisect_left(tms, 300000)
    good = (u1[0][0] == tms[k - 1] and u1[1][0] == tms[k6 - 1] and u1[2][0] == tms[k6 - 1]
            and u2[0][0] == tms[k3 - 1] and u2[1][0] == tms[k3 - 1] and u2[2] == (tms[-1], True))
    ok &= good
    print('  verdict P1: exact until %.3f s, within 1 until %.3f s, within 10 until %.3f s; P2: exact until %.3f s, within 1 until %.3f s, within 10 until %.3f s%s -> %s'
          % (u1[0][0] / 1000.0, u1[1][0] / 1000.0, u1[2][0] / 1000.0, u2[0][0] / 1000.0, u2[1][0] / 1000.0, u2[2][0] / 1000.0,
             ' (end)' if u2[2][1] else '', 'PASS' if good else 'FAIL'))
    for f in (p1, p2):
        try:
            os.remove(f)
        except OSError:
            pass   # deletion may not be permitted in this folder; the files are harmless
    print('SELF-TEST RESULT: %s' % ('ALL PASS' if ok else 'FAILED'))
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description='Grade engine RES/CPWORDS trace against the truth of replay 518239882.')
    ap.add_argument('engine', nargs='?', help='engine stderr file')
    ap.add_argument('--truth-dir', default=os.path.join(HERE, '..', 'truth', 'analysis'))
    ap.add_argument('--out', default=os.path.join(HERE, 'grade'))
    ap.add_argument('--offset-ms', type=int, default=0, help='engine time = truth time + offset (default 0)')
    ap.add_argument('--refund-step', type=float, default=25.0, help='positive changes that are multiples of this count as probable refunds (0 = off)')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    tdir = os.path.normpath(a.truth_dir)
    if a.self_test:
        return self_test(tdir, a.out)
    if not a.engine:
        ap.error('engine stderr file required (or --self-test)')
    if not os.path.exists(a.engine):
        print('engine file not found: %s' % a.engine, file=sys.stderr)
        return 2
    grade(a.engine, tdir, a.out, a.offset_ms, a.refund_step)
    return 0


if __name__ == '__main__':
    sys.exit(main())
