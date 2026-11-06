# Upstream 58a360a comparison (2026-11-06)

Research only; no main merge or deployment. The site is unchanged.

## Reproduce

Start from librematch/genie `58a360a6178fbec326278d0f2986f63acfa58127` (60 commits after old `91d81be43402f50d89cfb8da8f168fe43878f83d`). Apply `research-port.patch` to a clean checkout, **not on top of the old eight patches**. Optional `keep-pairs.patch` applies after it. Build `cargo build --release -p genie-oracle --example census --ignore-rust-version`.

Common comparison environment: `GENIE_DEATHS=1 GENIE_NO_STOP=1 GENIE_EXPERIMENT_CAPTURE_SETUP=1 GENIE_EXPERIMENT_SEARCH_CLEAR=tick GENIE_PRINT_CHECKPOINTS=1`. Add `GENIE_CORRECT=ids` for ID correction. Input: replay 518239882 and the user's uploaded build-188329 DAT/sidecar JSON files. Civilization and unitlines JSON are absent; fixed lobby civilization fallback is used.

## Comparison observed before workspace cleanup

Both old and latest engine completed the 92,503-update loop. Without correction: deaths 4/2, player stops 23:42 / 23:26. With correction: deaths 1/0, stops 10:00 / 10:03. First mismatch unchanged at 999 sync / 15,977ms for player 1 (word9 17000 vs 16445), and 1499 / 22,477ms for player 2 (18273 vs 18149). First object-structure mismatch (words 2/6/10) at 9499 / 188,089ms for both: ID sum one below the recording. All 370 CPWORDS rows per mode matched old vs latest byte-for-byte.

These are observations from completed runs. Automated workspace cleanup then removed the new worktrees and raw run logs before they were pushed. The port has been reconstructed from the original committed patches and observed API changes. Rebuilt runs will be stored here separately; do not fabricate the deleted raw logs.

Upstream changes include kill attribution/count handling, master-speed checks, gathering searches, capture-flag storage and task changes. They did not resolve this replay's mismatch. `movement/step.rs` still documents missing obstruction avoidance. The supported build layer remains 158041; the 188329 compatibility additions are experimental.

## Newly isolated correction bug

At 431,930ms the correction records `4401 -> 4399`. At 600,408ms simulation object 4401 has master217, HP0 and no action; object4399 has master120, HP40 and a work action. At 600,436ms a queued move for recorded4401 is delivered to simulation4401, because the correction prefers ownership of the raw number over its already-established pair. The move stops player1.

`keep-pairs.patch` adds opt-in `GENIE_CORRECT_KEEP_PAIRS=1`: established pairs take precedence in command unit lists. If the paired object is no longer held by that player, the slot becomes None rather than switching identities. `GENIE_LOG_KEPT_PAIRS=1` records these decisions. This does not prove the original ±4 pairing correct and does not fix movement or initial timer divergence.

STATUS: reconstructed build and keep-pairs A/B validation in progress. Do not describe the optional change as validated until results below are appended.
