## 4 → 3 → 2 → 1 작업 결과 (2026-11-05)

이 절이 이전 연구 이력보다 최신이다. **완전한 경기 재현에는 아직 성공하지 못했다.**

### 4. 문명 매핑과 캐시 — 코드 수정 및 검증 완료

- `Task.object_group`의 별도 serde 처리로 -1288/-1256/-1448을 보존. 일반 `ClassId`의 음수 거절 규칙은 그대로다. 특수 값의 게임 동작 의미를 구현하거나 wildcard로 바꾸지 않았다.
- `MasterTable`에 canonical civilization names와 DAT civ count 보관. `civilizations.json`을 DAT 옆에서 선택적으로 읽고, 목록 길이·빈 값·중복을 검증하며 캐시 키에 포함.
- 공통 시뮬레이션 초기화 `setup::slice`에서 문명 이름 매핑 적용. 따라서 census 전용 환경변수만으로 매핑하던 문제를 줄였다. raw header 조회만 하는 도구까지 자동으로 변환한 것은 아니다.
- canonical 파일이 없는 경우, 리플 로비에 명시된 **고정 문명 선택**만 사용. mode!=0, 모호한 player index, 범위 밖 ID는 오류로 거절한다. Gaia는 이름 GAIA와 index0일 때만0. 랜덤 선택을 추측해서 진행하지 않는다.
- 실제518239882 공통 slice 문명은 `[0,2,2]`로 검증. 실제 DAT의 직접 import/첫 캐시 저장/캐시 재읽기가 같은 값. 부정확한 캐시를 성공으로 처리하지 않음.
- import 테스트27개, model172개, save14개: 합계213개 통과. `cache_probe`는 특수 task JSON 왕복과 일반 ClassId 거절, 실제 DAT cache 왕복을 별도로 검증.

### 3. 리플8개 교차 검증 — 실행 완료, 전체 성공 아님

같은8개를 새로 받아 각1500 updates를 검증했다.5개는 실행됐고 다음3개는 모호한 문명 선택 때문에 중단:516495787,516956894,517426097. 현재 canonical civilizations.json이 없어, 기존처럼 civ0으로 계속 진행하지 않는 의도된 거절이다. 파일을 확보하면 이3개를 재검증할 것.

실행된5개에도 첫499/999/1499 checkpoint의 word7(좌표 합)/word9(행동+타이머) 차이가 남는다.515741992 player2는 첫3개 checkpoint가 일치했지만 양측 전체 경기 성공은 아니다. 상세는 cross-replay-summary.json 및 cross-*.log.

### 2. 이동 계산 — 대상·구간 특정, 동작 수정 없음

518470161의 player2 scout9391, master448을550 ticks 추적. 명령308, 첫 이동309,499 위치는(25.3581085,41.3171082). target은(16.90625,47.364582).242개 이동 sample의 관측 속도는 약1.199864~1.622955 tiles/s.1.21을 넘는 것은409 tick 한 번이며 좌표가 정확히(26.5,40.5)가 되는 구간이다. 경로 지점 맞춤과 연관될 후보지만 원본 객체별 경로가 없으므로 속도 버그라고 확정하거나 보정하지 않았다. 유한 좌표·시간 단조 증가 검증 통과. motion-summary.json과 motion log 참조.

### 1. 타이머 난수 — 호출 분류·내부 일관성 검증 완료, 원본과 차이 남음

518239882의500~999 tick에서 AI stream4 호출1902건. 이 중 retarget_check246건, look_around85건 등으로 분류. retarget.rs:95는750+(rand15%500)이고 같은 파일의598은look-around timeout을 갱신하는 다른 동작이므로 섞지 않는다.

실제 retarget 호출만 적용했을 때, 현재 코드로 새로 찍은 기존12개 객체의999 tick retarget_timer와12/12 일치했다. 원본과의 word9 차555는 여전히 남는다. 이 검사는 원본 난수 소비 순서가 맞다는 증거가 아니라, 현재 엔진의 난수→타이머 저장·읽기 경로가 이12개에서는 일관된다는 검증이다. trace span DEBUG/TRACE 레벨을 바꿔도 census summary는 같았다.

전체 raw RNG 로그는 큰 임시 파일이라 git에 넣지 않고, 선수별 관심 구간139개 호출과 요약을 저장했다. 동일 명령으로 재생성 가능.

### 적용/재현

기존6개 패치(형식→oracle cargo→census→capture timing→object trace→phase observer)를 적용한 pinned upstream 위에 `ordered-data-and-trace.patch`를 적용한다. 깨끗한 기존 패치 baseline에서 `git apply --check` 통과. 새 `cache_probe.rs`, `identity_probe.rs`도 examples에 복사.

빠른 빌드 설정 profile research를 패치에 포함했다. opt-level0, LTO없음, debug assertions없음. 속도 비교용 빌드가 아니다. 실제 연구 환경은 CARGO_TARGET_DIR=genie-check/target-ordered를 썼다.

```
cargo test --profile research -p genie-import -p genie-model -p genie-save --lib
cargo build --profile research -p genie-oracle --example census --example cache_probe --example identity_probe
./target/research/examples/cache_probe /path/empires2_x2_p1.dat /tmp/genie-cache
./target/research/examples/identity_probe replay.aoe2record /path/empires2_x2_p1.dat
GENIE=/path/genie DAT=/path/empires2_x2_p1.dat REPLAYS=/path/replays python /path/aoe2/research/genie/tools/run_matrix.py
GENIE_TRACE_MOTION=9391 GENIE_TRACE_COMMANDS=1 GENIE_EXPERIMENT_CAPTURE_SETUP=1 ./target/research/examples/census replay.aoe2record dat 550
RUST_LOG='genie_core::draws=trace,genie_core::update=trace' GENIE_EXPERIMENT_CAPTURE_SETUP=1 ./target/research/examples/census replay.aoe2record dat 1000 > rng.log 2>&1
```

### 다음 작업

1. 원본과 다른 동작의 후보를 더 좁힐 때, retarget RNG 순서와 look-around RNG 순서를 구분한다. 현재 timer 저장은12개에서 설명됐으므로 임의로 timer를 고치는 접근은 피한다.
2. 이동은9391의308~499 구간과 주변 가축/장애물의 상태를 비교. 좌표 합만으로 원본 개별 좌표를 알아냈다고 주장하지 않는다.
3. civilizations.json이 확보되면 거절된3개 리플을 정상 문명 매핑으로 재실행.
4. 전체 경기 checkpoint가 맞기 전에는 실제 병력 손실/승부처 기능으로 배포하지 않는다. main 배포는 사용자가 별도 요청할 때만.

