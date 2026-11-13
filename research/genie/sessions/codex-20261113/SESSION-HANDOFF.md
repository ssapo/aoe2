# Codex engine investigation handoff — 2026-11-13

## Current outcome

The user requested parallel work on engine/original-game divergence, after rereading
the handoff. Two independent investigation agents ran: deer/Ctrl movement, and
drop-off/shelter return. The parent prepared the pinned engine source and built a
tested object comparison diagnostic. This session has **not executed a replay,
read the original binary, fixed engine behavior, or extended a verified interval**.

The original handoff's numerical tables remain historical results, not new runs.

## Reproducible source state

- Research: `ssapo/aoe2`, `research/genie-188329`, commit
  `2aef3a21c6fef404be9e33456edb45b68cf4ac80` (fetched during this session).
- Historical notes and patch are at repository `research/genie/`, also extracted
  locally under `/workspace/aoe2-engine-research/research/genie/`.
- Source clone: `/workspace/genie-engine-investigation`, detached at `91d81be4`.
- The research patch passed `git apply --check` and was applied to that source.
- Patch SHA-256:
  `82bbf6cf244138f6483d610407a8454b39eeed666db12e16403091609e2ece67`.
- The clone's local changes are the supplied research patch, not new engine fixes.
- Original application checkout `/workspace/aoe2` remains unchanged.
- The coordination ledger and these diagnostic results are saved on the research
  branch at the user's request. No application/main push, deployment, or PC
  operation was performed.

## Findings checked by the parent

1. `deer-movement-investigation.md` separates the 520596921 P1 10.1-second
   Ctrl MOVE case from the deer FOLLOW hypothesis. Historical notes conflate
   them; findings 55 records the Ctrl association explicitly.
2. Engine `world/checkpoint.rs:80-100` and oracle `header_runs.rs:146-169`
   show that word 7 sums truncated coordinate components for a player's listed
   objects. A checksum delta is not one unit's travel distance. Gaia deer are
   not directly included in the P1 list. Height also contributes to the checksum.
3. `groups/place.rs:477-478` really uses the two-point path `[w, centroid]`.
   The surrounding comments acknowledge a straight-line substitute. Its causal
   role in the Ctrl replay remains unknown until object/group traces are read.
4. `unit_ai/idle_animals.rs:189-193` explicitly leaves map clamp, second target,
   and four-direction alternatives unimplemented in the evade path. An observed
   failing branch is required before choosing one to implement.
5. Investigation B found that `garrison/unit.rs:477-491,578-604` records less
   work-return information than `orders/town_bell.rs:653-720`. This is a concrete
   source gap, not a confirmed replay cause. If the unit is already sheltered,
   the entry path does not write a new record, which rules this candidate out
   for that entry. Existing BACKWORK_ORDER cleanup should not be reimplemented.
6. Existing `truth_cmp_pos.py` accepts a single differing sample. The held
   comparator has a three-sample counter but does not reset it across missing
   samples/objects and keys only by object ID. The new diagnostic makes those
   observation gaps explicit rather than silently confirming a streak.

## Implemented diagnostic

`compare_object_window.py` accepts existing census `OBJECT` stderr and original
truth v4/v5 JSONL, with an explicit game-millisecond window. It compares x/y
position and held values at float32 bit precision, state, and master ID.

- Exact `(game_ms, player, object_id)` alignment; no interpolation.
- Default confirmation: three consecutive comparable truth samples per field.
- Missing timestamps or objects break confirmation runs.
- Duplicate/invalid input, restarted timestamps, and zero object coverage fail
  explicitly; zero coverage cannot be called a passing comparison.
- Exit 0: no sustained difference in the compared samples; exit 1: sustained
  difference; exit 2: unusable input or no coverage.
- It does not compare height, action-node internals, or complete checkpoints.
  Three truth samples are not necessarily three simulation ticks.
- Truth logs do not identify the replay. Matching replay/build/configuration
  must be established before interpreting a report.

Verified here:

```sh
cd /workspace/aoe2-engine-research
python3 -m unittest -v test_compare_object_window.py
python3 compare_object_window.py --help
```

All **11 synthetic diagnostic tests passed**. They cover torn single samples,
three-sample confirmation, timestamp/object gaps, ownership separation, float32
rounding, independent field streaks, no coverage, timestamp order, duplicates,
nonfinite values, and census's actual three-coordinate position shape (x/y only
are compared). These tests do not validate any real replay or Rust build.

Example once same-replay trace files become available (not executed here):

```sh
python3 /workspace/aoe2-engine-research/compare_object_window.py \
  /path/to/518239882-object-trace.err /path/to/truth4.jsonl \
  --start-ms 690000 --end-ms 710000 --player 2
```

Use latest `M6_envs.txt` plus the setup flags from `go.ps1` for new engine runs;
the old helper example omits later default switches. Preserve source and config
identities in each run's metadata, and keep separate run prefixes for helpers.

## Concrete blockers observed

- Native read-only Git request
  `git ls-remote https://github.com/ssapo/aoe2-data.git HEAD` returned HTTP 403.
  The error text says repository access is not granted. The public source Git
  requests succeed. No credentials were printed or requested in chat.
- Current environment reports no configured secret bindings/runtime variables.
- Active tool inventory exposes no remote-device/PC shell or callable REA
  provider. A skill listing alone does not supply those capabilities.
- Workspace/tmp searches found no target replay, game DAT, original EXE,
  original truth JSONL, or re-kit archive.
- Rust tools are not installed in the current command environment. Installation
  was not started because the required execution data is already inaccessible.

These are current-session limits. Paths and successful PC runs mentioned in old
notes do not establish that this session can access the same PC.

## Resume in priority order

1. Provide either access to the existing research PC or the relevant local
   research files. Existing same-replay engine OBJECT traces plus the matching
   truth window are sufficient for first-object diagnosis without rebuilding.
2. With replay and DAT access, reproduce the latest 29-switch baseline before
   trying a behavior change. Check the game's DAT hash against the workflow.
3. Run the independent short Ctrl and FOLLOW traces described in investigation
   A. With existing truth4 available, investigate 518239882 P2 at 696.6 seconds
   as the parallel comparison target. Do not substitute truth4 for the other
   replays.
4. Review investigation B's remaining drop-off/shelter hypotheses using its
   exact trace conditions. Reconfirm what BACKWORK_ORDER already solved.
5. Read the corresponding original 188329 function for the first concrete
   divergent object, implement one switch-guarded change, and compare the full
   11-replay baseline. Only one integrator edits engine source at a time.
6. Record real before/after times and update the original handoff/findings only
   after execution. Do not merge/publish speculative behavior changes.

No engine jobs are left running by this session.

## Shared coordination

Historical note: `CONTINUE.md` first received a ledger in commit `0f21078`.
The user subsequently requested a common entry point that is independent of
engine research. The authoritative task ledger is now **main's root
ONBOARDING.md**, not this research branch or this historical report.
This investigation's outcome remains static investigation complete / runtime
materials blocked. A new worker should claim the narrow next task in the common
ledger, then read the engine handoff only when taking on engine research.
Status is advisory, not a distributed mutex; do not reserve the whole engine
indefinitely.
