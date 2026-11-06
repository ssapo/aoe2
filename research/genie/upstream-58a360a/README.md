# Upstream 58a360a comparison (2026-11-06)

Research only; no main merge or deployment. The site is unchanged.

## Reproduce

Start from librematch/genie `58a360a6178fbec326278d0f2986f63acfa58127` (60 commits after old `91d81be43402f50d89cfb8da8f168fe43878f83d`). Apply `research-port.patch` to a clean checkout, **not on top of the old eight patches**. Optional `keep-pairs.patch` applies after it. Build `cargo build --release -p genie-oracle --example census --ignore-rust-version`.

Common comparison environment: `GENIE_DEATHS=1 GENIE_NO_STOP=1 GENIE_EXPERIMENT_CAPTURE_SETUP=1 GENIE_EXPERIMENT_SEARCH_CLEAR=tick GENIE_PRINT_CHECKPOINTS=1`. Add `GENIE_CORRECT=ids` for ID correction. Input: replay 518239882 and the user's uploaded build-188329 DAT/sidecar JSON files. Civilization and unitlines JSON are absent; fixed lobby civilization fallback is used.

## Comparison observed before workspace cleanup

Both old and latest engine completed the 92,503-update loop. Without correction: deaths 4/2, player stops 23:42 / 23:26. With correction: deaths 1/0, stops 10:00 / 10:03. First mismatch unchanged at 999 sync / 15,977ms for player 1 (word9 17000 vs 16445), and 1499 / 22,477ms for player 2 (18273 vs 18149). First object-structure mismatch (words 2/6/10) at 9499 / 188,089ms for both: ID sum one below the recording. All 370 CPWORDS rows per mode matched old vs latest byte-for-byte.

These are observations from completed runs. Automated workspace cleanup then removed the new worktrees and raw run logs before they were pushed. The port has been reconstructed from the original committed patches and observed API changes. The rebuilt runs were executed, but a second automated cleanup removed their unsaved logs as well. This document records observations returned by the execution tools; no deleted raw logs are reconstructed.

Upstream changes include kill attribution/count handling, master-speed checks, gathering searches, capture-flag storage and task changes. They did not resolve this replay's mismatch. `movement/step.rs` still documents missing obstruction avoidance. The supported build layer remains 158041; the 188329 compatibility additions are experimental.

## Newly isolated correction bug

At 431,930ms the correction records `4401 -> 4399`. At 600,408ms simulation object 4401 has master217, HP0 and no action; object4399 has master120, HP40 and a work action. At 600,436ms a queued move for recorded4401 is delivered to simulation4401, because the correction prefers ownership of the raw number over its already-established pair. The move stops player1.

`keep-pairs.patch` adds opt-in `GENIE_CORRECT_KEEP_PAIRS=1`: established pairs take precedence in command unit lists. If the paired object is no longer held by that player, the slot becomes None rather than switching identities. `GENIE_LOG_KEPT_PAIRS=1` records these decisions. This does not prove the original ±4 pairing correct and does not fix movement or initial timer divergence.

## 최종 확인 상태

**최신 엔진으로 교체해도 이번 리플의 정확도는 개선되지 않았다. 기존 연결 유지 실험도 10분 정지를 해결하지 못했다.** 실험 옵션은 기본으로 켜지 않는다.

- 재구성한 release 빌드 성공. 깨끗한 최신 소스에 두 패치를 순서대로 적용한 결과가 작업 소스와 일치함을 확인했다(Cargo.lock 메타데이터 제외).
- Rust 회귀 테스트 `correction::pair_tests` 2개 통과(다른 2,286개 테스트는 실행하지 않음). 사망 보고서 Python 테스트 2개 통과.
- 관찰 기능 OFF/ON의 첫 1,500 updates에서 CPWORDS 6개 행이 동일했다.
- 재실행한 최신 기본/ID보정 모드는 모두 92,503 updates / 185 checkpoints로 끝났다. 사망 수 4/2 및 1/0, 최초 불일치, 최초 정지 시각은 앞선 결과와 같았다.
- 기존 연결 유지 옵션 ON: 429,662ms에 나의 주민 사망 1건을 관찰했다. 선수1은 600,436ms, 선수2는 601,136ms, Gaia는 611,524ms에 첫 정지를 기록했다. 약 16분 이후에도 루프가 진행되는 것은 관찰했지만, 두 번째 환경 정리 때문에 이 옵션 실행의 마지막 완료 결과와 최종 사망 수는 확인하지 못했다. **완주했다고 쓰지 않는다.**
- 이 옵션은 앞선 명령부터 결과를 바꿔 기존 4401→4399 짝이 그대로 형성되지 않았다. 그럼에도 동일 시점에 이동 불가 개체의 예약 이동 오류가 재발했다. 짝 우선순위 수정만으로 해결됐다고 볼 수 없다.
- 정지 이후 체크포인트 값은 재구성 전후에 달라지는 것도 관찰했다. 최초 중단 이후 상태를 정확도나 재현성의 근거로 쓰지 않는다. 초반 불일치·정지·사망 관측값이 이번 비교의 핵심이다.
- 실행 시간이 컴파일과 자원을 공유한 상태에서 측정됐으므로 속도 벤치마크로 해석하지 않는다.

위 결과는 도구가 실제 반환한 실행 출력에 근거한 기록이다. 두 차례 자동 환경 정리로 새 실행 로그·비교 HTML·빌드 산출물이 삭제됐다. GitHub의 두 패치와 이 문서는 보존됐으며 원본 EXE/DAT/리플은 업로드하지 않는다. 웹 분석기에 적용하거나 배포하지 않았다.

## 게임을 켜지 않고 할 다음 작업

1. **약 16초의 최초 행동/타이머 불일치**: 499→999 sync 사이의 소유권 초기화, 행동 전환, retarget 난수 소비를 추적한다. 체크포인트 합계만으로 특정 객체의 타이머를 정답이라고 확정하지 않는다.
2. **3:08.089의 최초 ID 합 불일치**: 9499 sync 전후의 객체 생성·제거를 ID/종류/소유자/부모/생성 원인과 함께 기록한다. 양 사체만이 원인이라고 단정하지 않는다.
3. **기존 번호도 명령과 맞는지 검사**: 소유자만 같다는 이유로 원본 번호를 그대로 받지 않는다. 생존 상태·이동 가능 여부·건설 가능 여부를 점검한다. 가장 가까운 번호로 강제 교체하거나 오류를 무시해 놓고 정상 재현이라고 보고하지 않는다.
4. `keep-pairs.patch`는 실험으로 유지한다. ±4 추정 매칭, 서로 다른 원본 ID가 같은 시뮬레이션 객체를 가리키는 충돌, 앞선 게임 상태 차이는 해결하지 못했다.
5. 원본 최신 엔진에도 이동 중 장애물 회피 미구현이 남아 있다. 실제 게임 없이 확인 가능한 범위를 넘는 규칙은 별도 원본 관찰이 필요할 수 있다.

진행을 재개할 때 이식·빌드를 반복하기 전에 위 두 패치를 복구해 사용할 것. 사용자 요청 없이 main 병합·배포하지 않는다.
