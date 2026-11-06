# Genie 최신 1v1 호환성 실험 — 미완성, 배포 금지

## 최신 엔진 비교 결과 · 2026-11-06

다음 작업은 [upstream-58a360a/README.md](upstream-58a360a/README.md)부터 읽는다. 최신 엔진 이식과 기존 ID 연결 유지 실험을 완료했으나 정확도 개선은 확인하지 못했다. 보정 실행은 여전히 약 10분에 멈춘다. 통합 패치는 기존 8개 패치 위에 겹쳐 적용하지 않는다. 배포 없음.

## 사망 집계 실험 (2026-11-06)

사용자 요청으로 부정확한 결과도 비교할 수 있게 [사망 집계 실험](death-experiment/README.md)을 추가했다. [비교 보고서 HTML](death-experiment/comparison.html), 원시 로그와 JSON 포함. 엔진 생존→사망 상태를 기록하며 실제 경기의 사망으로 확정하지 않는다.

## 다음 시작점 (2026-11-06)

**[local-windows-handoff.md](local-windows-handoff.md)의 맨 위 절만 읽으면 바로 이어서 작업할 수 있습니다** (현재 상태, 환경 만들기, 기본 실행, 다음 할 일, 지켜야 할 것). 상세 근거는 [original-vs-engine-518239882.md](original-vs-engine-518239882.md). 이 README의 나머지는 이전 작업 이력입니다.

## 최신 작업: 4 → 3 → 2 → 1 (2026-11-05)

[이번 수정·검증 결과와 재현 방법](ordered-work-summary.md)을 먼저 읽으세요. `ordered-data-and-trace.patch`에 캐시·문명 매핑 수정과 빠른 연구용 빌드 설정, 이동 추적을 포함했습니다. 테스트 213개 통과 및 실제 DAT 캐시 왕복 검증. 리플 8개 중 5개는 1500 updates 실행, 3개는 랜덤/모호한 문명 선택으로 추가 메타데이터가 필요해 거절했습니다. 이동·난수 조사도 실행했지만 **정확한 전체 경기 재현은 여전히 미완성**입니다. 아래는 이전 작업 이력입니다.


기준 소스: librematch/genie `91d81be43402f50d89cfb8da8f168fe43878f83d` (원본 지원 build 158041).
대상: save 68.9 (`new_save_game_version` 0x44e666), build 185872·188329. 리플 8개로 검증.
사용자 게임 파일·리플·빌드 산출물·toolchain은 저장소에 넣지 않는다.

## 현재 상태 (2026-11-04 갱신)

1. **헤더: 8/8 리플이 끝까지 읽히고 바이트 roundtrip 일치** (`header-result.log`, `roundtrip-result.log`).
   `parse`의 "world가 save 끝에서 끝나는지" 검사 통과, `write` 결과가 원본과 같음. 기존 genie-save/genie-rec 테스트 통과.
2. **census(시뮬레이션): 끝까지 돌지만 체크포인트가 곧 어긋남** (`census-result.log`).
   - 518239882: 양 플레이어 모두 첫 체크포인트(499 sync 뒤)는 일치, 999 sync 뒤에서 불일치.
   - 나머지도 대부분 499 또는 999 sync에서 불일치. 경기 재현 성공이 아니다.
   - 불일치 단어는 시뮬레이션 값이 기록보다 일관되게 작다(예: word 3 20 vs 26, word 4 100 vs 400).
     시뮬레이션이 기록보다 "뒤처지는" 모양이라 시간 진행(sync 1회 = update 1회 가정) 문제를 의심 중. 미확인.
   - 명령 디코딩은 실패 0건 (`command_probe`, 518239882 전체 명령 22종 모두 decode OK).
3. 실제 사망/생존 병력·경제 곡선 추출은 아직 불가능 (2번 해결이 먼저).

## 바로 시작 (새 작업자, 2026-11-04 새 clone으로 검증함)

```sh
git clone https://github.com/librematch/genie genie && cd genie
git checkout 91d81be43402f50d89cfb8da8f168fe43878f83d
R=<aoe2 clone>/research/genie
git apply $R/experimental-188329-header.patch $R/oracle-cargo.patch $R/experimental-census.patch
cp $R/*_probe.rs crates/tools/genie-oracle/examples/
cargo build --release -p genie-oracle --examples --ignore-rust-version   # 1.99 있으면 마지막 옵션 생략
# 리플 폴더(<dir>/<id>/*.aoe2record)와 dat 폴더 준비 후 (아래 "데이터")
GENIE=$PWD REPLAYS=<dir> $R/tools/run.sh                                 # 8개 모두 "players: 3" 이면 정상
GENIE_CIVILIZATIONS=<dat폴더>/civilizations.json \
  ./target/release/examples/census <dir>/518239882/AgeIIDE_Replay_518239882.aoe2record <dat폴더>/empires2_x2_p1.dat
# 기대 결과: player 1, 2 모두 "1 checkpoints hold; the checkpoint after 999 syncs differs" (census-result.log와 같음)
```

첫 작업: 위 census의 999 sync 불일치 원인 찾기 (아래 "다음 할 일" 1). 시작점은 518239882의 500~999 sync 구간.
`sync_probe`로 그 구간 dt 합(실제 경과 게임 시간)과 census가 진행한 world_time(`RUST_LOG=debug`의 `world_time=`)을 비교해
시간 진행이 맞는지부터 확인. 맞으면 객체 단위 비교로 넘어간다.

## 68.9 형식 변경 (`experimental-188329-header.patch`)

모두 `ver == 0x44e666` 일 때만 읽는다(XS 하나는 XS data version으로 분기). 158041 경로는 그대로.
"확인" = 0이 아닌 값/다른 리플로 위치까지 맞춘 것, "잠정" = 크기만 맞고 값이 0뿐이라 구조체 안 위치를 못 박은 것.

| 구조체 | 변경 | 상태/근거 |
|---|---|---|
| `GameOptionsRead`/`PlayerInfo` | 옵션 v1123, PlayerInfo v15 + 끝 SigString | 이전 작업자 |
| `GameOptions` 끝 | 빈 SigString 2개 (`extra_v1123`) | 확인. 이전 "marker 1바이트 차이"의 실제 원인(8바이트 누락 → AI 분기 오독) |
| `WorldPlayerBase` | `civ_id: u8` 자리에 SigString `civ_data_name` ("FRANKISH-CIV", "GAIA") | 확인. 앞 바이트는 DAT `icon_set`. 숫자는 `civilizations.json` `data_name` 순서 = DAT civ 순서(63개 일치) |
| `TechPlayerTree` | description 뒤 SigString 1개 | 확인 |
| `WorldPlayerEntry1` | 칸당 +1바이트 (23→24) | 크기 확인, 위치 잠정(끝) |
| `TechTree` | `number_units` u8 → u16 (`number_units_wide`) | 확인 (269 units) |
| `WorldPlayer` | end marker 앞 8바이트, end marker 뒤 u32 | 크기 확인. 뒤 u32로 Gaia 늑대 타이머가 0/1000/~1.3e6ms/40.0으로, 플레이어 `PlayerObjects` marker가 맞음 |
| `RgeMasterStaticObject` 끝 | 44바이트 | 확인 (궁수 속도가 +44) |
| `RgeMasterMovingObject` 끝 | 2바이트 + f32 (`min_collision_size_multiplier`) | 확인 (궁수 1.0, 정찰기병 0.5) |
| `RgeMasterActionObject` 끝 | 1바이트 | 확인 |
| `TribeMasterCombatObject` 끝 | 19바이트 (열 단위 비용 블록 + i16 2개) | 확인 (궁수 25/45, TC 275/100, TC upgrade graphic 12297) |
| `TribeMasterBuildingObject` 끝 | 52바이트 | 확인 (TC: tech 722, head 621, transform 444, annex 4개+좌표, can_burn) |
| `ActiveSpriteList` | 종료 0 뒤 1바이트 | 잠정 |
| `RgeMovingObject` 끝 / `RgeActionObject.selected_group_info` | 이동 객체 끝 +4, 액션의 `selected_group_info`(4) 없음 | 확인: kind 30(물고기)은 끝에 4바이트, kind 70/80은 액션 speed-up 쌍이 이동 쪽과 같은 (0, NaN)으로 읽힘. 필드가 옮겨간 건지 빠진 건지는 미상 |
| `RgeCombatObject` | `previous_master_id` 앞 12바이트, `processed_kill` 앞 8바이트 | 크기 확인(동물·TC), 위치 잠정 |
| `UnitAiModule` 끝 | 15바이트 (u8 1, 자기 타일 x/y, 0×6) | 잠정 |
| `TribeCombatObject` 끝 | 1바이트 | 잠정 |
| `BaseScenario` | version 1.59 허용 (구조 변화 없이 통과) | 확인 |
| `TriggerSystem` | trigger_version 5.0 허용 (트리거 0개 경기만 확인) | 트리거 있는 경기 미검증 |
| `BxsData` | XS data version 5면 `unit_id` 뒤 8바이트 (`extra_v5`) | 확인 (v4 리플 4개는 없음, v5 리플 4개는 있음) |
| `World` 끝 | 1바이트 | 확인 (`water_def_index` 3 다음 마지막 바이트) |

## 실험용 엔진 변경 (`experimental-census.patch`, 헤더 패치 위에 적용)

- `Header::resolve_civ_ids` + `Player::world_player_mut` (genie-save): 문명 이름 → 번호.
  census는 환경변수 `GENIE_CIVILIZATIONS=<…/civilizations.json>`이 있을 때만 적용. 다른 oracle 경로(survey 등)는 아직 미적용.
  번호 매핑 확인됨(Turks 10, Chinese 6). 단, 매핑 유무와 관계없이 census 결과는 같았다.
- `dat_work.rs`: action 154/155/157 task의 음수 class(-1288, -1256, -1448; `task_probe` 결과 3종뿐)를
  "아무 class" 로 바꾸지 않고 값 그대로 보존 (`ClassId::of_master`). 어떤 객체 class와도 같지 않아 class 매칭으로는 안 뽑힌다.
  154(LOOT)는 엔진이 어차피 kill bonus를 unsupported로 멈춘다. 의미는 미확인. ClassId의 serde는 음수를 거부하므로 **cache 경로(`install::load`)에서는 깨질 수 있음** — census example은 cache 없는 `install::read`라 문제없었다.

## 다음 할 일 (우선순위)

1. **census 불일치 원인**. 후보:
   - 체크포인트 시점: census는 "N sync 뒤 체크포인트 = N update 뒤 상태"로 비교. `sync_probe` 결과 518239882는 sync 92503회,
     dt 합 2,043,060ms(≈1256초×1.7배속). dt는 13~104ms로 매우 불규칙(158041 리플과 분포 비교 필요).
     census는 51232 update에서 AllDone으로 멈춤. sync 간격·체크포인트 간격(Pregame `checkpoint_interval: 500`) 처리가 새 build에서 바뀌었는지 확인.
   - 잠정 필드의 위치 오류(유닛 AI·전투 객체) → 0이 아닌 값을 가진 객체로 검증.
   - 새 마스터 필드(44/19/52바이트 등)의 동작 의미가 엔진에 반영 안 됨.
   - 518239882에서 player 1의 첫 불일치 시점 전후로 `tick_trace` 계열 도구로 객체 단위 비교.
2. 문명 매핑을 정식 경로로: `install`이 `civilizations.json`을 읽어 MasterTable에 넣고 모든 header 사용처에서 적용.
3. 음수 class task 의미 확인 후 ClassId 모델링 정리(serde 포함).
4. 트리거 있는 경기, AI 플레이어(kind 3, `TribeMainDecisionAi`) 경기로 추가 검증.
5. 그 다음: 1v1 전체 경기 체크포인트 대조 → 사망/생존 병력, 경제 곡선 추출.

## 재현

1. `git clone https://github.com/librematch/genie genie-check && git -C genie-check checkout 91d81be43402f50d89cfb8da8f168fe43878f83d`
2. genie 루트에서 `git apply` 순서: `experimental-188329-header.patch` → `oracle-cargo.patch`(genie-oracle에 binrw 의존성) → (선택) `experimental-census.patch`.
3. `*_probe.rs`를 `crates/tools/genie-oracle/examples/`에 복사.
4. Rust: 워크스페이스는 1.99.0을 요구하지만 1.97.0에서 `--ignore-rust-version`으로 빌드·실행됨(이 세션은 1.99 다운로드가 막혔음). 1.99가 있으면 옵션 빼도 됨.
5. 실행 (`cargo run --release -p genie-oracle --ignore-rust-version --example <이름> -- …`):
   - `header_probe <replay>` 헤더 파싱 / `roundtrip_probe <inflated .hdr>` 파싱→쓰기 바이트 비교
   - `lobby_probe <.hdr>` 로비만 읽고 끝 위치 / `civ_probe <dat>` / `unit_probe <dat> <civ> <unit>` / `task_probe <dat>` 음수 class task 목록
   - `command_probe <replay>` 명령 id별 decode 성공/실패 / `sync_probe <replay>` sync dt 분포
   - `census <replay> <dat>` (문명 매핑: `GENIE_CIVILIZATIONS=…/civilizations.json`)
6. `tools/`: `GENIE=<genie-check> REPLAYS=<리플 폴더> tools/run.sh` 전 리플 실패 위치 요약,
   `GENIE=… tools/dbgrun.sh "구조체들" <replay> [줄수]` 구조체 필드에 binrw `dbg`를 임시로 붙여 `offset] field = value` 출력 후 원복,
   `tools/inflate.py <replay>…` 헤더를 `.hdr`로 풀기(오프셋 기준 파일). `techtree.py`, `combat_obj.py`는 일회성 가설 검증용.

### 데이터

- 리플: `https://aoe.ms/replay/?gameId=<id>&profileId=26260702` (ZIP). 목록: `https://aoe-api.worldsedgelink.com/community/leaderboard/getRecentMatchHistory?title=age2&profile_ids=[26260702]`.
  사용 리플: 518470161, 518239882, 517426097, 516956894 (188329) / 516746960, 516495787, 516293031, 515741992 (185872).
  클라우드 세션에서는 aoe.ms·static.rust-lang.org가 막혀 있었음 → 사용자 PC에서 받아 `%TEMP%\genie-replays\`에 두고 옮김.
  같은 이유로 GitHub push도 사용자 PC(`%TEMP%\genie-replays\aoe2-push`)에서 git bundle로 함.
- 게임 데이터 `…\AoE2DE\resources\_common\dat\`: `empires2_x2_p1.dat`, `dropsites.json`, `linkedTechs.json`, `linkedUnits.json`, `unitlines.json`, `civilizations.json`.

## 작업 요령

- 실패 오프셋을 `.hdr`에서 덤프 → 닻(SigString `60 0a len`, marker 0x0b/0x16/0x21, 타임스탬프, DAT 값)으로 실제 경계 찾기.
- 마스터는 `unit_probe`의 DAT 값(속도·비용·훈련시간·사거리)과 대조하면 빠르다.
- 객체는 같은 종류가 연속된다. kind/owner/master_obj/inside_obj=-1/id 패턴으로 다음 객체 시작을 찾아 실제 길이를 잰다.
- 임의 패딩·marker 검색으로 건너뛰기 금지. 0만 있는 구간에 넣은 필드는 "잠정"으로 남긴다.
- `dbgrun.sh` 출력을 `head`로 자르면 SIGPIPE로 원복이 안 될 수 있었음 → 현재 버전은 trap으로 원복. 그래도 결과는 파일로 받아서 보기.

## 해석 주의

- DAT·헤더 roundtrip 성공은 구조를 손실 없이 읽는다는 뜻이지 엔진 계산이 맞다는 뜻이 아니다.
- 새 필드 이름 대부분은 값 대조로 붙인 추정이다. 게임 바이너리로 확인한 것이 아니다.
- 명령상 생산 요청 수 ≠ 생존 일꾼 수, sync object 수 ≠ 군대 수. 기존 로컬 초안(`scripts/turning_point.py`, parser revision 10, 복기 요약 UI)은 이 브랜치에 없고 자동 배포 금지.

## 작업 규칙

의미 있는 단위로 이 작업 브랜치에 커밋/푸시. main 반영·배포 브랜치 푸시·배포 workflow 실행은 사용자가 명시할 때만.
원본 게임 데이터, 빌드 산출물, toolchain은 공개 저장소에 올리지 않는다.


## 후속 진단: 시간 합계·가축 소유권 (2026-11-04)

기존 3개 패치 뒤 `capture-timing-diagnostic.patch`를 추가 적용. `capture_probe.rs`도 examples에 복사.
이 패치는 census의 499/999 update에서 시간·돼지 ID를 출력하며, 선택적 환경변수 `GENIE_EXPERIMENT_CAPTURE_SETUP=1`로 **진단용 초기화 가설**을 시험한다. 환경변수 없으면 기존 capture 해석을 유지한다. 정식 호환 수정이나 검증된 게임 동작으로 취급하지 말 것.

### 관측 결과

- 518239882: 499 sync의 dt 합/엔진 경과 시간 모두 9477ms, 999 sync 모두 15977ms. 단순 dt 누락·배속 곱셈 오류 증거 없음. 체크포인트 시점 자체를 완전히 입증한 것은 아님.
- 불일치 word2의 3735=1245×3, 6225=1245×5. DAT 참조에서 master1245는 Pig. word6 차이도 3/5, word4 차이도 300/500.
- 모든 초기 Pig의 저장 capture_flag는 0, baseline 시뮬레이션은 양측 Pig가 계속 1마리씩.
- `GENIE_EXPERIMENT_CAPTURE_SETUP=1`은 save68.9에서 saved flag 대신 기존 엔진의 capture_kind(player,class,master,roles)를 사용한다. 전체 객체에 적용하는 진단이며 보유 객체 상태를 무시할 수 있어 운영 채택 금지. game-start 전용 여부/원본 load 초기화 순서를 추가 확인해야 함.
- 518239882 999 sync: 실험 시 양측 Pig가 4/6마리. player1은 word9만 17000 vs16445(차555), player2는 두 체크포인트 전체 일치. 5000 updates까지 실행하면 player2 첫 차이는1499 sync word9(18273 vs18149). player1 첫 차이는 여전히999.
- 독립 경기518470161: 실험 시 player1은499/999 전체 일치. player2는499 word7(좌표 합)103728 vs103619만 남음. baseline과 실험 로그 모두 첨부.

### 지금 바로 다음 작업

1. 초기 capture_flag가 0으로 저장되는 이유를 원본 로드/초기화 경로나 다른 버전·중간 저장 리플로 확인. 단순 기본값 강제는 정식 해결이 아님.
2. 518239882 player1 999 sync word9 차555를 객체별 action kind/state/retarget_timer 합으로 분해. 같은 체크포인트의 다른 모든 항목이 맞는다는 점을 이용. player2는1499 word9가 다음 대상.
3. 518470161 player2 499 sync의 word7 좌표 차109를 이동·정찰/가축 위치로 추적.
4. 실제 생성 동작/이동이 맞고 첫 체크포인트가 늘어나는지 확인한 후 전체 경기를 재검증. 아직 정확한 전체 재생은 불가능.

실행 예: `GENIE_EXPERIMENT_CAPTURE_SETUP=1 ./target/release/examples/census replay.aoe2record empires2_x2_p1.dat 5000`.
게임 원본 데이터는 공개 브랜치에 추가하지 않음. 이번 환경은 `genie-check/target-current`로 빌드했음(기존 target 캐시 일부가 손실돼 새 target 필요).



## 후속 작업: 객체별 체크포인트 분해 (2026-11-04)

`capture-timing-diagnostic.patch` 다음에 `object-trace-diagnostic.patch` 적용.
`GENIE_TRACE_OBJECTS=1`을 추가하면 499/999/1499 update에서 양 플레이어의 각 객체 ID, master, position, action kind/state, retarget_timer를 JSON으로 stderr에 출력한다. 이 출력은 시뮬레이터의 상태이며 원본 게임의 객체별 상태가 아니다.

```sh
GENIE_TRACE_OBJECTS=1 GENIE_EXPERIMENT_CAPTURE_SETUP=1 ./target/release/examples/census match.aoe2record empires2_x2_p1.dat 1500 > object.log 2>&1
python <aoe2>/research/genie/tools/object_summary.py object.log
```

두 경기에서 3시점×2플레이어=12개 word9를 객체별 데이터로 재합산했고 census의 시뮬레이션 합계와 일치했다. action이 없을 때 -1 처리와 u32 wrapping도 확인했다. 로그와 요약 JSON을 함께 저장했다.

### 이번 확인으로 좁혀진 것

- 518239882 player1 999 update의 15개 객체에서 action/state 합 + retarget 합이 정확히17000. 원본 합계16445와 차555는 여전히 남음.
- 같은 시점 player2는17개 객체, 합계18068로 원본과 일치. 1499에서 처음18273 vs18149(차124).
- player1의499→999에는 기존 TC/부속 객체와 scout, 집의 retarget timer가 갱신됨. 신규 소유 Pig3개의 타이머는953/1180/983. 정확히 어느 객체의 값이 원본과 다른지는 합계만으로 식별할 수 없다.
- 518470161 player1은1499에서 좌표 합1, word9 차-148까지 발생. player2는499부터 좌표 합109 차이. 이를 첫 두 체크포인트 성공과 혼동하지 않는다.

### 다음 진입점

1. 소유권 초기화 실험을 켠 상태에서 518239882 player1의500~999 update retarget RNG draw와 소유권 변경/명령 발생 시각을 추가 추적. 최초499에서는 합계가 맞고999에서 timer/action만 다르다는 조건을 활용한다.
2. `crates/engine/genie-core/src/unit_ai/retarget.rs`의 `retarget_check`, `UnitAi::with_side`, World의 frame seed/reseed 순서, 신규 객체 AI 초기화의 난수 소비를 확인. **원본 객체별 타이머가 없으므로 특정 객체나 RNG가 원인이라고 확정하지 말 것.**
3. 원본 체크포인트의 world_time도 비교할 것. 이전 진단은 dt 합과 시뮬레이터 시간의 일치만 검증했으며 그것만으로 원본 전체 시간 의미를 입증하지 않는다.
4. 좌표 차이는 별도 검증: 518470161 player2의499 update 객체별 이동/가축 좌표와 명령을 추적.

이번에는 새로운 게임 동작 수정은 없고, 진단 도구·재현 로그를 추가했다. 완성도나 정확한 재생 가능 구간을 더 늘렸다고 보고하지 않는다.


## 갱신 단계 대조 (2026-11-05)

`object-trace-diagnostic.patch` 다음에 `phase-observer-diagnostic.patch` 적용.
`GENIE_TRACE_PHASE=1 GENIE_EXPERIMENT_CAPTURE_SETUP=1 census replay dat 1500` 실행.
체크포인트가 붙은 틱의 갱신 전 상태 및 Commands/각 플레이어 단계/세계 후처리 단계 직후를 비교한다.

### 결과

- 518239882 원본 checkpoint world_time: 9490/15990/22490ms. 직전499/999/1499 sync dt 합은9477/15977/22477ms. 원본 시각은 다음 틱dt13ms를 포함한다.
- 첫 체크포인트는 Commands 이후(원본과 world_time도 같은 상태)에서 양측 모두11개 checksum 단어가 일치. clock+dt, objects 갱신 이전에 기록된다는 기존 비교 방식과 양립한다.
- 999 sync player1은 **어느 갱신 단계에도 완전 일치가 없음**. word9 17000 vs16445가 그대로 남고, 다음 틱 객체 갱신까지 하면 word7도117212 vs117210으로 어긋난다.
- 1499 sync player2도 어느 단계에도 완전 일치 없음(word9 차124). 518470161의 초기 좌표 불일치도 단계를 옮겨 해결되지 않는다.
- 동일한 두 경기에서1500 updates를 observer OFF/ON 각각 실행, census 요약 결과(각 선수 첫 mismatch·중단·통과수)가 정확히 같음. 관찰 코드의 결과 변경은 발견되지 않았다.
- 이 실험은 한 틱 내 비교 시점 이동만으로 해결되는 가설을 배제한다. 새 엔진 동작 수정은 없고, 정확한 전체 경기 재현도 여전히 안 됨.

### 다음 단계와 필요한 근거

리플의 체크포인트는 객체별 정답이 아닌 합계다. 현재 simulator의 객체별 값을 합산하는 도구만 추가하는 것으로는 어느 retarget timer가 원본과 다른지 특정할 수 없다. 다음 유효한 검증은 (a) 원본 엔진의 객체별 상태/retarget RNG trace를 얻거나 (b) 같은 버전 게임 실행 파일의 retarget/owner-load 코드를 대조하는 것. 이 절을 작성할 당시에는 원본 실행파일이 없었다. 이후 2026-11-05 `AoE2DE_s.exe`를 받았으며 현재 상태와 다음 작업은 [로컬 Windows 인계 문서](local-windows-handoff.md)를 따른다. repo에서 참조한 aoe2de-exe-re 개발 자료의 공개 접근은 확인하지 못했다. 실행파일이 있어도 분석 성공을 보장하는 것은 아니다.

실행파일은 이미 받았으므로 새 작업에서는 기존 업로드나 로컬 설치 경로부터 확인한다. 공개 git에 바이너리를 올리지 않는다. 새 helper가 Windows game 연동을 완료했다거나 웹에서 원본 엔진을 돌릴 수 있다고 주장하지 않는다.

반복 빌드 주의: 이번 release의 Nickel 설정 파서 최적화와 fat LTO에 긴 시간이 걸렸다. 후속 실험에는 제공된 forced profile 또는 Nickel parser opt-level0/codegen16 설정 등 빠른 빌드 설정을 우선 검토한다. 빌드 소요 시간은 리플 분석 성능이 아니다.
