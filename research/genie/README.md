# Genie 최신 1v1 호환성 실험 — 미완성, 배포 금지

기준 소스: librematch/genie `91d81be43402f50d89cfb8da8f168fe43878f83d` (원본 지원 build 158041).
대상: save 68.9 (`new_save_game_version` 0x44e666), build 185872·188329. 리플 8개로 검증 중.
사용자 게임 파일·리플·빌드 산출물·toolchain은 저장소에 넣지 않는다.

## 현재 상태 (2026-11-04 갱신)

헤더(첫 chapter) 파싱 진행 위치:

| 리플 | build | 도달 위치 |
|---|---|---|
| 518239882, 516956894, 518470161 | 188329 | Gaia 전체 통과 → **플레이어 1 `player_objects`** 에서 실패 |
| 515741992, 516293031, 516746960, 517426097 | 185872 | Gaia `player_objects`(오브젝트 목록 끝) 에서 실패 |
| 516495787 | 185872 | 위와 같음 |

즉 로비·옵션·지도·Gaia의 WorldPlayer·기술 트리·마스터(유닛 정의) 2750개·Gaia 오브젝트 대부분까지 읽힌다.
시뮬레이션(census), 사망/생존 병력 추출은 아직 불가능. 파싱 성공이 아니라 "어디까지 읽히는지"의 진척이다.

## 이번에 확정한 68.9 형식 변경 (패치에 반영)

모두 `ver == 0x44e666` 일 때만 읽는다. 기존 158041 경로는 그대로다.
"확인"은 8개 리플 전부에서 위치·값이 일관된 것, "잠정"은 값이 0뿐이라 필드 안 위치를 못 박은 것.

| 구조체 | 변경 | 근거/상태 |
|---|---|---|
| `GameOptionsRead`/`PlayerInfo` | 옵션 v1123, PlayerInfo v15 + 끝 SigString | 이전 작업자 |
| `GameOptions` 끝 | 빈 SigString 2개 추가 (`extra_v1123`) | 확인. 이전 "지도 marker 1바이트 차이"의 진짜 원인. 0x74f→0x750 차이는 이 8바이트 누락 후 AI 분기 오독 결과였음 |
| `WorldPlayerBase` | `civ_id: u8` 자리에 SigString(`civ_data_name`, 예 "FRANKISH-CIV", "GAIA") | 확인. 앞 바이트는 DAT `icon_set`(culture). 숫자 civ id는 `civilizations.json`의 `data_name` 순서 = DAT civ 순서로 풀어야 함 (63개 일치 확인). 현재 `civ_id`는 0으로 남음 → **엔진 연결 전 반드시 매핑 필요** |
| `TechPlayerTree` | description 뒤 SigString 1개 추가 | 확인 (1510개 모두 빈 문자열) |
| `WorldPlayerEntry1`(per_player 9칸) | 칸당 1바이트 추가 (23→24) | 크기 확인, 칸 안 위치 잠정(끝) |
| `TechTree` | `number_units` u8 → u16 (`number_units_wide`) | 확인 (269 units). ages/buildings/techs는 u8 유지 |
| `WorldPlayer` 끝 | end marker 앞 8바이트 | 크기 확인, 의미 미상 |
| `WorldPlayerGaia` | 늑대 타이머 구간 u32 1개 추가 | 크기 확인, 위치 잠정 |
| `RgeMasterStaticObject` 끝 | name 뒤 44바이트 | 확인. 궁수 속도가 +44에 위치. 자원 저장 3종·충돌/여유 크기와 비슷한 값 |
| `RgeMasterMovingObject` 끝 | 2바이트 + f32 | 확인. f32 = DAT `min_collision_size_multiplier`(궁수 1.0, 정찰기병 0.5) |
| `RgeMasterActionObject` 끝 | 1바이트 | 확인 (궁수·정찰기병 base_armor 10000 정렬) |
| `TribeMasterCombatObject` 끝 | 19바이트 | 확인. 열 단위 비용 블록(궁수 25/45/1) + i16 2개(TC에서 spawning -1, upgrade graphic 12297과 일치) |
| `TribeMasterBuildingObject` 끝 | 52바이트 | 확인. TC에서 tech 722, head 621, transform 444, annex 618/619/620/890 + 좌표 4쌍, can_burn과 일치 |
| `ActiveSpriteList` | 목록 종료 0 뒤 1바이트 | 잠정 |
| `RgeCombatObject` | `previous_master_id` 앞 12바이트, `processed_kill` 앞 8바이트 | 크기는 Gaia 동물(유닛 1245, 730바이트 객체) 1종으로만 확인. 위치 잠정 |
| `UnitAiModule` 끝 | 15바이트 (u8 1, 자기 타일 x/y f32, 0 6바이트) | 잠정 |
| `TribeCombatObject` 끝 | 1바이트 | 잠정 |

DAT: 63 civs, 1510 techs, roundtrip 93,272,287바이트 일치 (이전 작업). 음수 class task 381개 의미는 아직 미구현.

## 다음 할 일 (우선순위)

1. **188329 리플의 플레이어 1 오브젝트 실패** (`518239882` 0x26c5ce, `player_objects` in `HumanOrCoopPlayer`).
   방법: `tools/dbgrun.sh "ObjectListEntry1 RgeStaticObject"`로 마지막으로 읽힌 오브젝트(kind, master_obj)를 찾고,
   다음 오브젝트 시작 위치를 바이트 검색으로 찾아 실제 길이와 비교 (Gaia 동물 때와 같은 방법, 아래 "작업 방법").
   일꾼/건물/정찰기병 등 다양한 오브젝트가 있어 위 "잠정" 필드의 위치를 확정할 좋은 표본이다.
2. **185872 리플 Gaia 오브젝트 실패**: 같은 방법. 다른 Gaia 오브젝트 종류(물고기·멧돼지 등)의 차이일 가능성.
3. 잠정 필드 위치 확정: 0이 아닌 값이 나오는 오브젝트로 검증. 값이 0뿐이면 위치를 확정했다고 쓰지 말 것.
4. 헤더 끝까지 읽히면 `parse`의 "world가 save 끝에서 끝나는지" 검사와 바이트 roundtrip(쓰기 결과 = 원본) 확인.
5. `civ_data_name` → civ id 매핑 (`civilizations.json` 필요; import 단계에서 읽게 하거나 lobby의 civ와 대조).
6. 그 다음에 census(시뮬레이션) 연결, 음수 class task 의미 구현, 1v1 전체 경기 checkpoint 대조.

## 재현

1. `git clone https://github.com/librematch/genie genie-check && git -C genie-check checkout 91d81be4…` (전체 해시는 위).
2. genie 루트에서 `git apply <this>/experimental-188329-header.patch` 와 `git apply <this>/oracle-cargo.patch`
   (genie-oracle에 `binrw` 의존성 추가, lobby_probe용).
3. `*_probe.rs`를 `crates/tools/genie-oracle/examples/`에 복사.
4. Rust: 워크스페이스는 1.99.0을 요구하지만 1.97.0에서 `--ignore-rust-version`으로 빌드·실행됨
   (이 세션은 static.rust-lang.org가 막혀 1.99를 못 받았다). 1.99가 있으면 그 옵션은 빼도 된다.
5. 실행:
   - `cargo run --release -p genie-oracle --example header_probe --ignore-rust-version -- <replay>` — 헤더 파싱
   - `... --example lobby_probe -- <inflated header>` — 로비(SaveGameFileHeader)만 읽고 끝 위치 출력
   - `... --example civ_probe -- <dat>` / `... --example unit_probe -- <dat> <civ> <unit>` — DAT 값 대조용
   - 원래 전체 검증: `... --example census -- <replay> <dat>` (헤더가 다 읽혀야 의미 있음)
6. 도구 (`tools/`, 경로는 환경변수): `GENIE=<genie-check> REPLAYS=<리플 폴더> tools/run.sh` 는 모든 리플의 실패 위치 요약,
   `GENIE=… tools/dbgrun.sh "구조체 이름들" <replay> [줄수]` 는 해당 구조체 필드에 binrw `dbg`를 임시로 붙여 `offset] field = value` 를 출력하고 파일을 복구한다.
   `tools/inflate.py <replay>…` 는 헤더를 풀어 `.hdr`로 저장(오프셋은 이 파일 기준). `techtree.py`, `combat_obj.py` 는 가설 검증용 일회성 스크립트.

### 데이터 받기

- 리플: `https://aoe.ms/replay/?gameId=<id>&profileId=26260702` (ZIP). 경기 목록은
  `https://aoe-api.worldsedgelink.com/community/leaderboard/getRecentMatchHistory?title=age2&profile_ids=[26260702]`.
  이번에 쓴 8개: 518470161, 518239882, 517426097, 516956894 (188329) / 516746960, 516495787, 516293031, 515741992 (185872).
  **클라우드 세션에서는 aoe.ms가 막혀 있었다** → 사용자 PC(PowerShell)에서 받아 `%TEMP%\genie-replays\`에 두고 옮겼다.
- 게임 데이터: `…\AoE2DE\resources\_common\dat\` 의 `empires2_x2_p1.dat`, `dropsites.json`, `linkedTechs.json`, `linkedUnits.json`, `civilizations.json`(새로 필요).

## 작업 방법 (다음 작업자용 요령)

- 실패 오프셋 근처를 `.hdr`에서 덤프 → 알려진 값(시간 스탬프, 이름 SigString `60 0a len`, 0x0b/0x16/0x21 marker, DAT 값)을 닻으로 실제 필드 경계를 찾는다.
- 유닛 정의(master)는 DAT `unit_probe` 값과 대조하면 빠르다 (속도·비용·훈련 시간·사거리 등).
- 오브젝트는 같은 종류가 연속되는 경우가 많다. kind/owner/master_obj/inside_obj=-1/id 패턴으로 다음 오브젝트 시작을 찾아 실제 길이를 잰 뒤, 필드 합과의 차이를 0이 아닌 값 기준으로 배치한다.
- 임의 패딩·marker 검색으로 건너뛰기 금지. 0만 있는 구간에 넣은 필드는 README에 "잠정"으로 남긴다.

## 해석상 주의

- DAT roundtrip 성공은 구조를 손실 없이 읽는다는 뜻이지, 엔진 계산이 맞다는 뜻이 아니다.
- 새 필드 이름 대부분은 값 대조로 붙인 추정이다. 게임 바이너리로 확인한 것이 아니다.
- 명령상 생산 요청 수 ≠ 생존 일꾼 수, sync object 수 ≠ 군대 수. 기존 로컬 초안(`scripts/turning_point.py`, parser revision 10, 복기 요약 UI)은 이 브랜치에 없고 자동 배포 금지.

## 작업 규칙

의미 있는 단위로 이 작업 브랜치에 커밋/푸시. main 반영·배포 브랜치 푸시·배포 workflow 실행은 사용자가 명시할 때만.
원본 게임 데이터, 빌드 산출물, toolchain은 공개 저장소에 올리지 않는다.
