# 경제·주둔 복귀 독립 조사 B

조사일: 2026-11-13. 연구 기준 `ssapo/aoe2`의 `2aef3a21c6fef404be9e33456edb45b68cf4ac80`, 엔진 기준 `librematch/genie` `91d81be4` + 그 연구 패치. 아래 엔진 경로는 `/workspace/genie-engine-investigation/crates/engine/genie-core/src/` 기준이다.

## 결과와 범위

소스에서 남은 구체적인 공백 하나를 확인했다. **건물에 들어갈 때 쓰는 작업 복귀 기록은 일반 명령 경로의 기록보다 불완전하다.** `go_inside`는 맨 앞 액션의 대상이 들어가는 건물이 아닐 때 대상을 버리며, 자기 예약 명령 대상·작업 종류·두 번째 대상을 기록하지 않는다. 다만 이것이 `520596921`의 남은 멈춘 사냥꾼을 일으켰다는 실행 증거는 없다.

`BACKWORK_ORDER`의 복귀 순서 수정과 사냥 명령 실패 정리는 이미 최신 패치에 있다. 다시 구현할 항목이 아니다. `519686090` 379.4초 사례는 원인 유닛 ID조차 아직 확정되지 않아 행동 수정 전에 좁은 추적이 필요하다.

현재 클라우드에는 DAT·리플·원본 EXE·truth 메모리 기록이 없다. 부모가 비공개 데이터 저장소에 native Git 읽기를 시도했으나 403을 받았고 PC 연결 도구도 제공되지 않았다. 엔진 빌드·리플 실행·원본 디컴파일은 하지 않았다. 엔진 소스는 수정하지 않았다. 아래 원본 동작에 관한 내용은 기존 연구 문서가 보고한 내용이며 이번에 바이너리로 재확인한 사실이 아니다.

## 1. 이미 구현된 것: BACKWORK_ORDER 중복 작업 방지

### 현재 소스로 확인한 동작

- `garrison/unload.rs:472` `World::back_to_work`: `TownBell::back_to_work`로 찾은 대상과 기록을 받는다.
- `garrison/unload.rs:508-525`: `GENIE_EXPERIMENT_BACKWORK_ORDER_188329`가 있으면 `back_outside` 또는 `let_out`을 먼저 수행하고, 내보내기에 실패하면 그대로 반환한다.
- `garrison/unload.rs:526-545`: 대상은 없지만 기록에 action/class가 있으면 AI의 현재·직전 대상/종류와 target point를 초기화하고 action을 설정한 뒤 `REQUIRES_SEARCH`(0x202)를 보낸다.
- `garrison/unload.rs:546-549`: 마지막에 shelter flag를 Free로 한다.
- `unit_ai/update.rs:526-540`: `hunt_object`가 `a hunt command without a task` 오류를 반환하면 같은 스위치 아래서 `remove_target`과 `stop_current`를 호출한다. 현재는 오류 문자열 판별이다.
- `unit_ai/update.rs:514-520`: **검색에서 대상을 아예 못 찾은 경우**는 별도 분기다. 사람 플레이어면 `GO_ON`만 반환한다. 위의 `hunt_object` 실패 정리를 이 경우에도 적용한다고 읽으면 안 된다.

기존 근거: `truth-log-findings.md:531` findings 54. 기존 기록은 `0x12bc7e0`의 내보내기→대상 잊기→액션→통지, `0xd279c0/0xd27a74`의 HuntObject 실패와 `0xd004a0` 꼬리를 출처로 든다. findings 54 자체도 원본 읽기 원문이 남아 있지 않다고 명시한다.

## 2. 새로 좁힌 소스 공백: entry record가 일반 record writer를 전부 구현하지 않음

### A. 일반 명령에서 기록하는 경로

`orders/town_bell.rs:653-720` `World::record_town_bell`은 다음 정보를 기록한다.

1. shelter flag가 이미 켜져 있으면 기록하지 않는다(660-661).
2. 맨 앞 액션의 유효한 대상, 그 대상의 목초지가 있으면 목초지(670-680).
3. 대상이 없으면 `own_order_target(ai, unit.id)`로 자기 예약 명령 대상을 찾는다(681-688).
4. 찾은 대상의 위치 또는 자기 위치(689-692).
5. Hunt/Gather의 target class(694-698), 현재 AI action, 두 번째 대상(706-715).

### B. 건물 진입 때 기록하는 경로

`garrison/unit.rs:477-491` `go_inside`는 `UNLOAD_188329` 아래에서 `actions.top_target() != container`이면 `recorded = None`으로 만들고, 아니면 container를 넘긴다. 주석은 자기 예약 명령 fallback이 여기서는 모델링되지 않았다고 명시한다.

`garrison/unit.rs:578-604` `enter_town_bell`은 다음처럼 좁은 기록을 쓴다.

- `target`: 위에서 선택한 container 또는 None.
- `target_class`: 항상 None.
- `action`: 현재 AI action.
- `target2`: 항상 None.
- `point`: 항상 건물 위치.

**확정한 것은 두 코드 경로의 정보 차이**다. `original-188329-unload-case-232s.md` §3 D1은 원본 record writer `0x12bacf0..0x12bae6a`에 A와 같은 fallback이 있다고 보고하고, 완전한 record writer를 진입 경로에도 적용하라고 권고했다. 최신 패치는 그 문서의 새 주민 사례에 필요한 `target=None, point=building`만 좁게 처리한 상태다. 이번에 188329 원본을 직접 읽어 차이를 재확정한 것은 아니다.

### 이 공백을 실제 원인으로 판정할 조건

- 문제 주민이 들어가기 직전 이미 `flag=Sheltered`이면 `enter_town_bell`이 새 기록을 쓰지 않으므로 **이 entry-record 공백은 그 진입의 직접 원인에서 제외**한다.
- flag가 Free이고 top target이 container가 아니며, 유효한 자기 예약 대상/작업 class/second target이 남아 있을 때 두 경로의 출력이 달라질 수 있다.
- 그 실제 입력으로 완전 record writer를 손 계산한 값이 원본 기록과 일치하고 현재 entry 기록과 달라야 수정 후보가 된다.
- 이전 SEEK_SHELTER 경로의 `record_town_bell`이 올바른 기록을 이미 만들었는지도 반드시 확인한다. `original-188329-garrison-record-case-233.9s.md` §3c는 SEEK_SHELTER 자체의 record 호출 누락 가설을 이미 기각했다. 현재도 그 가설을 다시 원인으로 쓰면 안 된다.

### 구현 후보(조건부, 아직 적용하지 않음)

기존 `UNLOAD_188329` 아래의 `go_inside` record 구성을 일반 writer의 추출 로직과 맞추되, mutable world 접근이 다른 함수 구조를 고려해 record 추출을 공통 함수로 분리한다. `flag`, 기록 시점(입장 후), 대상 생존 검증, pasture/own queue fallback, target class/second target, 자기 위치를 그대로 보존한다. 최신 원본 함수와 실제 실패 입력 대조가 선행해야 한다. 새로운 스위치를 만든다면 `GENIE_EXPERIMENT_ENTRY_RECORD_188329` 등으로 격리하고 11개 리플에서 비교한다.

## 3. 519686090 P1 379.4초: 고치기 전에 구분해야 할 지점

기존 근거는 `truth-log-findings.md:504` findings 51 및 `CONTINUE.md` §12.5. 기록된 checksum 차이는 word 1 `891/879`, word 2 `15222/14752`이고 두 master 592−122의 차이가 470이다. 이는 **한 여성 사냥꾼의 늦은 양치기 전환과 양립**하지만, 합계 checksum만으로 그 유닛이나 유일한 원인을 특정하지 못한다. 기록된 엔진 입금 379.860초 15.69 역시 원본의 특정 입금 시각을 직접 관측한 값이 아니다.

현재 소스에서 입금은 다음 문턱 뒤에만 일어난다.

1. `gathering/hunt/drop_off.rs:114-120`: 음수 timer가 끝나야 한다.
2. 같은 파일 `130-139`: MoveTo update 코드가 1 또는 2여야 한다. 0이면 계속 걷고, 3~5면 `DROP_WAIT=-3`을 설정한다.
3. `141-152`: drop site가 존재하고 짐을 받아야 하며 `gap_squared <= hunt.drop_reach`여야 한다. 범위를 벗어나면 다시 3초 대기한다.
4. `154-159`: carried kind/amount를 가져온 뒤 비운다.
5. `gathering/hunt/hunter.rs:282-297`: 기본 짐을 `give_load`, 그 다음 `self.extra`를 순서대로 입금하고 `hunt_after_drop`으로 간다.
6. `gathering/hunt/unit.rs:233-255`: 대상이 있으면 돌아가고, 없으면 예약 명령 처리 후 자원 탐색으로 간다. `hunt_next_search`와 `unit_ai/update.rs:hunter_search`는 같은 함수가 아니므로 별도로 추적해야 한다.

따라서 0.5초 상수를 조정하거나 extra-resource 계산을 바꿀 근거는 없다. 가장 먼저 지연이 **입금 전 걷기인지, 도착 판정인지, 입금 후 대상 재탐색/마스터 전환인지** 나눠야 한다. bonus 유형164 자체를 다시 넣는 작업은 findings51에서 이미 끝났다.

### 최소 추적

최신 `M6_envs.txt` 기본 설정 + `GENIE_PRINT_CHECKPOINTS=1;GENIE_TRACE_RES=1;GENIE_TRACE_OBJECTS_RANGE=28500-29050;GENIE_TRACE_COMMANDS=1;GENIE_LOG_HUNT_SEARCH=1;GENIE_TRACE_EXTRA=1`로 `519686090`을 29050 update까지만 돌린다. **첫 실행에서는 OBJECT_IDS를 지정하지 않는다. 원인 ID는 아직 모른다.** P1의 master122→592 전환 후보, held→0, 액션/타깃 변경이 나타나는 ID를 찾은 다음 그 ID만 다시 추적한다. 과거 문서의 M2 설정 대신 최신 기본 설정을 써야 한다.

필요한 다음 진단 지점(미추가): `hunt_drop_walk/update_drop`에서 `ms,tick,id,master,carry_to,timer,MoveTo return,site.gap_squared,drop_reach,Dropped,held_before/after`, 그리고 `hunt_after_drop`에서 `target,queued_order,chosen_kind,found`를 하나의 이벤트로 출력한다. 원본에서 같은 문턱을 읽거나 해당 시각 원본 메모리를 확보하기 전에는 이 출력만으로 수정 정답을 확정할 수 없다.

## 4. 주둔 복귀 사례 최소 추적과 가설 분리

리플 `520596921`에서 findings54의 305.5초 전후부터 **새 기본 설정으로 먼저 재현 여부**를 확인한다. `GENIE_TRACE_BELL=1;GENIE_TRACE_COMMANDS=1;GENIE_LOG_HUNT_SEARCH=1;GENIE_TRACE_RES=1`을 쓰고, command log로 해당 SEEK_SHELTER/복귀 update와 주민 ID를 찾은 뒤 OBJECT 범위를 좁힌다. 과거 315.2초는 이미 431.6초로 늦춰진 이전 오류이므로 그것을 최신 실패 시각으로 사용하지 않는다.

현재 `orders/town_bell.rs:138-142,229-233`의 BELL_RECORD/BELL_BACK 줄에는 `unit id`, `ms`, `tick`이 없다. 여러 주민이 동시에 피신하면 줄 하나를 특정 주민에 확실히 귀속할 수 없다. `GENIE_TRACE_OBJECT_IDS`가 이 줄까지 필터링한다고 가정해서도 안 된다. 필터는 별도 코드 경로다.

다음 진단 추가는 행동 변화 없이 `GENIE_TRACE_BELL` 또는 별도 `GENIE_TRACE_WORK_RETURN` 아래서, **세계 문맥이 있는 호출부** `record_town_bell`, `go_inside`, `World::back_to_work`에 넣는 것이 적합하다. `id/player/ms/tick`, flag 전후, record 두 개, 실제 선택 record, found target, entry/outcome, AI action/target, 검색 결과를 연결한다. 구조체 메서드 `TownBell::record` 자체에는 ID·시각이 없다.

원인 분리:

- 기록부터 다름 → record writer/fallback 조사.
- 기록은 같고 let-out 뒤 검색 알림이 사라짐 → `BACKWORK_ORDER` 활성화 여부 및 notify 전달 경로 조사.
- 알림은 오지만 found=None → 검색 입력·대상 생존·kind 조사. `hunter_search`의 empty-search와 HuntObject-no-task를 혼동하지 않는다.
- 대상을 찾았는데 task가 없음 → 기존 실패 정리 분기와 task 선택·마스터 종류를 조사.
- 기록·검색·행동이 모두 같고 이동만 다름 → 복귀 기록 변경 가설은 기각하고 생성 위치/경로 쪽으로 넘긴다.

## 5. 재실행 판정과 다음 세션 전달

- 행동 수정은 이번 조사에 없음. 새 개선 시각이나 회귀 통과를 주장하지 않는다.
- 실제 자료 확보 후 우선 위 두 좁은 trace를 순차 실행한다. 느린 전 개체 추적을 두 에이전트가 같은 PC에서 동시에 돌리지 않는다.
- 수정 후보가 원본과 일치한 뒤만 별도 실험 스위치로 넣고, 기준 3개 + 나머지 8개 리플을 같은 M6 기본 설정에서 비교한다.
- `M5_cmp.py`의 선수별 first mismatch·held checkpoints·stop을 사용하되 trace 파일이 현재 실행과 올바른 리플의 것인지 확인한다. 원본 메모리 기록은 3표본 연속 차이를 확인한다.
- 원본 자료가 없는 현 상태의 최선 결과는 code-path/gap 식별이며, 확인된 게임 동작 수정은 아니다.
