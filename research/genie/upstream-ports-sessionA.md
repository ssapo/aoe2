# Session A (2026-11-11): upstream ports, P18, P16 — engine edits on the PC tree

Engine source edited in place on the PC (`genie-replays/genie`, line endings kept: CRLF files
stayed CRLF, checked by md5 after writing). Backups of every touched file (state before this
session) in `genie-replays/backup-A/<relative path>`, the full tree before in
`backup-A/pc-tree-before.tgz`, the md5 lists `backup-A/A-orig*.md5` (before) and `A-new.md5`
(after). No git commit or push. Container copies: `/home/claude/pcA` (PC tree before),
`/home/claude/pcL` (LF copy with one local git commit per step: `git -C /home/claude/pcL log`).
Built with `runs\steer.ps1` (release, ok, 3m07s). `cargo check` of genie-core + census and
`cargo test -p genie-core --lib` in the container: 2059 pass, 2 fail, the same 2 that fail on the
untouched tree (`an_invalidated_action_of_the_order_or_an_attack_stops_the_unit`,
`stop_ends_patrol_order_with_its_secondary_timer_capped`). genie-nickel tests pass.

## 1. Upstream ports (hand ports onto the PC tree)

| Commit | What | Where | Switch |
|---|---|---|---|
| 62064c49 | format crates keep unknown values/commands (num_enum 0.5 -> 0.7, crate versions) | formats/*, Cargo.toml/.lock, 2 Cargo.toml hunks fixed by hand | none (no engine read changes) |
| bd182531 + 1333c40f | monastery relic goods (attrs 225/264/265/191 per minute, gold also to attr 100) instead of the "a monastery's relics' goods" stop; only while its player plays | `construction/building_update.rs`, `players/world_player/income.rs` (`World::relic_goods`), new attribute slots in `builds/158041.ncl`, `contracts/genie.ncl`, `genie-model/src/layer/generated.rs`, `testing/build_158041.rs` | relics present: always (was a stop). A monastery WITHOUT relics adding 0.0 four times (upstream behaviour, a path that ran before): `GENIE_EXPERIMENT_UPSTREAM_RELICS` |
| 5617e484 | ClosestObject workers cap and unbuilt-farm test (were stops); hunter search that finds a farm works it (`UnitAi::task_to_farm`, was a stop) | `map/spatial/search.rs` `closest_kept`, `unit_ai/update.rs` | none. The mule cart's slot 0x140 args (carry test 1, Queued source: a path that ran before) under `GENIE_EXPERIMENT_UPSTREAM_CART` (`gathering/mule_cart.rs`) |
| 12f97a99 | stop of a unit whose top action is a Transport (slot 7 set_state(2)) instead of "a stop of an action whose slot 0x38 is not modelled" | `garrison/transport/work.rs` `halt_transport`, `players/game_status/stops.rs` | none |

Tests that pinned the removed 5617e484 stops updated (`map/spatial/tests.rs`, `unit_ai/tests.rs`, 3 asserts).

Skipped (not portable in reasonable effort; none of the three replays reaches their stops):
- 3ff14783/de226d5a, 5782bd01, 0f104160/f530d2b6 (garrison counts): need new unsaved building-layer
  columns counted in/out on every enter/leave and on load (re-link), relic/livestock counts with
  culture players and relic-paid technology take-back, nested containers; 0f104160 also changes the
  Enter room test (a path that runs). Several hundred lines on renamed upstream APIs.
- 7f4bc8d5 (+fe37a844, 7aa1789e) heal inside / villagers' repair at cost: ~1000 lines, new
  heal/cost modules and production cost changes.
- 961ce91e speed-up building (attr 255): ~470-line module plus movement-damage/combat changes.
Not verified in the 188329 binary: the ports follow upstream's 158041 reading (relic attribute ids
are script constants; plausible but UNCONFIRMED for 188329).

## 2. P18 (GENIE_EXPERIMENT_HUNT_188329)
`gathering/hunt/update.rs` `update_walk`: codes 4/5 with a unit AI whose queue is not empty
(`!QUEUE_EMPTY`) -> target none, sub-actions torn down (MoveTo stop), `HuntState::Done`, timer 0,
stand sprite. `gathering/hunt/hunter.rs` `hunt_part`: new arm `HuntState::Done` -> human player:
`set_done` + stand sprite + release target/second; return `HeadCode::Deletes`.
Check `A_p18` (517426097, OBJECT 18820-18840, 2974/3820): 2974 at 18829 (37.48666763, 22.14219475)
= truth bits; path (37.48891,22.13204)->(37.325485,22.872383) = truth wp; 3820 at 18829
(39.2675629, 23.0420341) and its 3 waypoints = truth.

## 3. P16 part 1 (GENIE_EXPERIMENT_BACKWORK_IGNORE_188329)
`garrison/unload.rs` new `World::back_to_work_inside_188329` (collect last-first with the
existing filter, then per unit: clear own ignore list, add the other collected ids, back_to_work);
used by `go_back_to_work` and `orders/town_bell.rs` `workers_out` when the switch is set (old loops
unchanged otherwise). Check `A_p16` (518470161, 12660-12680): `IGNORE walker=10417 ...
own=[9383]`, path `[(29.21,31.79),(26.8,31.8),(26.8,32.509914)]` = truth; 9383 own=[10417].

## 4. Full runs ($a + BACKWORK_IGNORE, TRACE_RES) vs c1_*
| Replay/P | word 7 | other words | res diff >0.01 | >50 | stop (update, reason) |
|---|---|---|---|---|---|
| 239 P1 | 384.8 = | same | 411.2 = | 596.3 = | 36479 call for help = |
| 239 P2 | 426.8 = | same | 450.9 = | 767.1 = | 36480 stopped player near = |
| 161 P1 | 307.7 = | same | 320.3 = | 324.0 = | 88946 -> 89722 stopped player near |
| 161 P2 | 171.2 -> 216.7 | w4 184.2 -> 229.7 | 218.5 = (S1, other cause) | 345.7 = | 87665 -> 87784 farmer found nothing (0xf3); checkpoints held 25 -> 32 |
| 097 P1 | 230.4 = | w10 379.9 -> 444.9 | 324.0 = | 579.2 = | 62864 -> 73337 stopped player (place unknown) |
| 097 P2 | 249.9 -> 444.9 | w1 282.4->613.9, w4 256.4->561.9, w9 249.9->444.9, w10 327.9->620.4 | 280.5 -> 582.1 | 325.5 -> 707.6 | 62242 -> 73336 commandHorde; checkpoints 37 -> 67 |
| P0 | | | | | 239 36490 =, 161 88579 =, 097 62860 -> 73618 (stopped player, place unknown) |

Nothing got worse. 239: CPWORDS first differ from c1_239 at 682 s (P2 word 7 695625 -> 695621),
after all first mismatches; P2 food at 900 s -259.6 -> -259.71 (cause not traced).
Runs with also `GENIE_EXPERIMENT_UPSTREAM_RELICS=1;GENIE_EXPERIMENT_UPSTREAM_CART=1`
(`A_239u`, `A_161u`, `A_097u`): stderr without OBJECT lines byte-identical to `A_*`.

## Files touched (relative to genie/)
Cargo.lock Cargo.toml builds/158041.ncl contracts/genie.ncl
crates/engine/genie-command-codec/Cargo.toml crates/engine/genie-import/Cargo.toml
crates/engine/genie-model/src/layer/generated.rs
crates/engine/genie-core/src/{construction/building_update.rs, garrison/transport/work.rs,
garrison/unload.rs, gathering/hunt/hunter.rs, gathering/hunt/update.rs, gathering/mule_cart.rs,
map/spatial/search.rs, map/spatial/tests.rs, orders/town_bell.rs, players/game_status/stops.rs,
players/world_player/income.rs, testing/build_158041.rs, unit_ai/tests.rs, unit_ai/update.rs}
crates/formats/genie-cpx/{Cargo.toml, src/lib.rs, src/read.rs, src/write.rs}
crates/formats/genie-dat/{Cargo.toml, src/civ.rs, src/lib.rs, src/tech_tree/mod.rs, src/tech_tree/nodes.rs, src/unit_kind/mod.rs}
crates/formats/genie-formats/{CHANGELOG.md, Cargo.toml, examples/displayaochotkeys.rs, examples/displayhotkey.rs, examples/extractcpx.rs, examples/probe.rs, examples/sethotkey.rs}
crates/formats/genie-hki/{Cargo.toml, src/catalogue.rs, src/file.rs, src/group.rs, src/key.rs, src/tests.rs}
crates/formats/genie-lang/{Cargo.toml, src/lib.rs, src/map.rs}
crates/formats/genie-rec/{Cargo.toml, src/actions/game.rs, src/actions/mod.rs, src/actions/tasks.rs, src/actions/tests.rs, src/de/body.rs, src/element.rs, src/lib.rs, src/unit_action.rs, src/version.rs, tests/de_corpus.rs}
crates/formats/genie-scx/{Cargo.toml, src/ai.rs, src/format/tribe_read.rs, src/header.rs, src/lib.rs, src/values.rs, src/victory.rs}
crates/formats/genie-support/src/{ids.rs, macros.rs, read.rs}
crates/formats/jascpal/src/lib.rs
crates/tools/genie-oracle/Cargo.toml
(70 files; the 62064c49 build downloaded num_enum 0.7.6 from crates.io on the PC.)
