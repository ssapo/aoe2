# 사망 집계 실험 — 518239882

사용자가 부정확한 엔진 결과라도 직접 비교해보고 싶다고 요청해 만든 진단 기능이다. 웹 분석기의 검증된 실제 사망 통계로 연결하지 않는다. 별도 배포 없음.

## 실제 실행 결과 (2026-11-06)

| 실행 | ssapo 사망(모두 주민) | 상대 사망(모두 주민) | ssapo 첫 정지 | 상대 첫 정지 |
|---|---:|---:|---|---|
| ID 보정 없음 | 4 | 2 | 23:42 | 23:26 |
| GENIE_CORRECT=ids | 1 | 0 | 10:00 | 10:03 |
| 원본 종료 화면 손실 | 39 | 73 | 해당 없음 | 해당 없음 |

원본 비교값은 `../original-game-518239882.json`의 수동 화면 판독 기록이다. ssapo의 원본 손실에는 전향 3이 포함될 수 있어 사망과 완전히 같은 지표가 아니다. 이 결과를 백분율 정확도로 환산하지 않는다. 원본 시점별 사망 정답은 없어 특정 초의 사망이 실제였는지는 판정하지 않았다.

두 실행 모두 루프는 92,503 updates / 185 checkpoints / 34:03.060까지 진행됐지만 선수별 지원되지 않는 동작에서 먼저 정지했다. `GENIE_NO_STOP`은 정지한 선수를 정상적으로 진행시키는 옵션이 아니다. 첫 체크포인트 불일치도 매우 이르다(999/1499 sync의 word9). 정지 전이라고 정확한 것도 아니다.

- 보정 없음 사망 시각: ssapo 3:31, 4:21, 4:39, 7:03 / 상대 4:44, 5:26.
- ID 보정 사망 시각: ssapo 7:17.
- 사망 상태를 보기 전에 사라져 집계를 보류한 건은 이번 두 실행 모두 0.
- 엔진 산출물뿐이며 실제 군사 교전 손실이나 승부처를 나타내지 않는다.

## 재현

`../local-windows-handoff.md`의 pinned genie와 기존 8개 패치를 준비한 후:

```sh
git apply <aoe2>/research/genie/death-observer.patch
cargo build --release -p genie-oracle --example census --ignore-rust-version
GENIE_DEATHS=1 GENIE_NO_STOP=1 GENIE_EXPERIMENT_CAPTURE_SETUP=1 GENIE_EXPERIMENT_SEARCH_CLEAR=tick \
  target/release/examples/census <518239882.aoe2record> <empires2_x2_p1.dat> > baseline.out 2> baseline.err
# 같은 명령에 GENIE_CORRECT=ids 추가해 corrected.out / corrected.err 작성
python <aoe2>/research/genie/tools/death_report.py --output comparison baseline.err corrected.err
```

도구의 원본 비교표는 **518239882 전용**이다. 다른 리플을 입력하고 이 원본 비교값을 사용하지 않는다. 필요한 DAT·리플은 저장소에 올리지 않는다. 이번 실행은 기존 업로드 DAT/JSON과 고정 문명 리플로 진행했고 civilizations.json/unitlines.json 추가 확보는 하지 않았다.

## 관찰 방식과 한계

- 매 update 뒤 전역 개체 ID별 상태를 비교한다. DAT kind=70(생성 가능한 유닛), class!=58(가축 제외)만 대상으로 하며 이전 owner>0, 이전 상태 Alive(2) → Dying/DyingSprite/Dead(3~5)일 때 한 번 기록한다.
- 건물·투사체·가축·시체 청소를 사망으로 세지 않는다. class=4를 주민으로 표시한다. 나머지 kind70을 모두 군인이라고 이름 붙이지 않는다.
- 소유권 변화는 별도 이벤트. 살아 있던 개체가 사망 상태 관찰 없이 사라지면 DEATH_UNRESOLVED이며 사망 수에 더하지 않는다. 같은 틱 생성/사망은 놓칠 수 있고 종류 변화/부활도 별도 검증이 필요하다.
- `DEATH_STOP` 이후 이벤트는 degraded=true로 남긴다. 사망 원인(전투/삭제/야생동물)·가해자·유닛 자원 가치는 이번 범위에 없다.
- Observer는 상태를 읽기만 하며 세계를 수정하지 않는다. 보정 실행의 관찰 켬/끔 census stdout 일치도 검사한다.
- 전환 판정 Rust 테스트 1개, 로그 파서/보고서 Python 테스트 2개 통과. release 빌드 및 동일 실제 리플 2종 실행 완료. 원본 게임을 이 세션에서 다시 재생한 것은 아니다.
