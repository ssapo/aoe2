# 사슴 FOLLOW / Ctrl MOVE 초기 위치 오차 조사 A

작성: 2026-11-13, Codex 병렬 조사 A. 엔진 동작 변경·빌드·리플 실행 없음.

상태: **정적 조사 완료 / 런타임 원인 확정·수정 검증은 blocked**(PC 연결, 리플·DAT, 해당 리플 원본 기록/EXE 없음).

## 근거 범위

- 인계서와 공통 안내를 다시 읽음: `research/genie/CONTINUE.md`(특히 12.5, 13.3, 13.4), `research/genie/tools/helper-common.txt`.
- 연구 자료 기준: `ssapo/aoe2` 연구 SHA `2aef3a21c6fef404be9e33456edb45b68cf4ac80`.
- 엔진: `/workspace/genie-engine-investigation`, base `91d81be4` + 위 연구 SHA의 `sorted-lists-and-truth-trace.patch`. 부모가 적용한 파일을 직접 읽었다.
- 아래 파일:줄은 패치 적용 후 로컬 소스이며, 경로는 `crates/engine/genie-core/src/` 기준(oracle만 별도 표기).
- 원본 188329 EXE·DAT·리플·truth 및 PC 도구가 없어 원본 함수를 이번에 다시 읽거나 수치를 재현하지 못했다. 문서의 과거 원본 분석은 **보존된 기록**이며 이번 직접 관찰과 구분한다.

## 1. 먼저 바로잡을 분류

**520596921 P1 10.1초와 사슴 FOLLOW를 같은 원인으로 확정하면 안 된다.**

- `CONTINUE.md:329` 및 `truth-log-findings.md:538`은 10.1초를 FOLLOW/사슴 후보와 묶는다.
- 그러나 더 뒤의 `truth-log-findings.md:546`은 520596921 P1 10.1초와 519700670 P2 21.9초를 **Ctrl MOVE 직후 일시 불일치**라고 기록한다. HORDE 수정 전후 그대로였다는 과거 결과도 적혀 있다.
- `CONTINUE.md:465-466` 최신 다음 작업은 사슴 밀기와 Ctrl 이동(유닛 9479, updates 400~1000)을 따로 둔다.
- 따라서 첫 실행은 520596921의 해당 구간 명령 로그에서 `Follow`인지 `Move(control: Held)`인지 확인하고 9479의 종류·소유자·그룹을 확인해야 한다. 명령과 추적이 없는 현재는 이름만으로 결합할 수 없다.

## 2. 체크포인트 word 7의 의미와 한계 — 소스로 직접 확인

`world/checkpoint.rs:80-100`:

1. 해당 선수 `PlayerState.live`의 객체만 순회한다.
2. 객체의 x·height·y **각 축**에 대해 `CVTTSS2SI(axis * 100.0)`를 수행한다.
3. 그 정수들을 32비트 wrapping 덧셈으로 합친다.

`crates/tools/genie-oracle/src/header_runs.rs:146-169`는 `simulated.objects`에서 해당 선수의 목록을 구성한다.

따라서 기록의 “위치 합 163 차이 = 1.63타일”은 **체크섬 스케일의 차이**이지 특정 유닛이 1.63타일 덜 걸었다는 증거가 아니다. 여러 객체·축 오차가 합쳐지거나 상쇄될 수 있고, 높이도 기여한다. Gaia 사슴은 P1 소유 객체 목록에 직접 들어가지 않으므로, P1 word7이 어긋났다면 P1 정찰병/주민 등의 오차부터 확인해야 한다. 사슴이 원인일 수는 있지만 그 경우는 추종 정찰병 등에 영향을 준 간접 원인이다.

이 점 때문에 사슴 위치 추적만으로 P1 word7을 설명했다고 끝내면 안 된다.

## 3. 사슴 쪽 실행 경로와 남은 구현 범위

| 읽은 소스 | 직접 확인한 사실 | 의미 |
|---|---|---|
| `orders/follow.rs:63-112` | FOLLOW는 대상 위치를 읽고 splitter를 `ControlKey::Up`으로 실행한다. 그룹이 생기면 아직 Unsupported. | Ctrl MOVE와 별도 진입점. 단일 추종과 다중 그룹 FOLLOW를 먼저 구분해야 한다. |
| `orders/follow.rs:251-280` | 단일 추종자는 `move_to_object_with`를 호출하고 대상·class·position을 기록한다. | 추종자의 경로 갱신과 Gaia의 도망 갱신은 다른 계층이다. |
| `unit_ai/kind_notifies.rs:31-44` | Hunted 전용 통지는 DAMAGED와 MISSILE_WARNING만 분기하고 나머지는 base handler로 넘긴다. | 이동/충돌/완료 통지의 188329 변경 가능성을 조사할 구체적 지점. 아직 원본과 차이 확정 아님. |
| `unit_ai/idle_part.rs:26-49` | 기본 idle 검사는 timer가 timeout을 **초과**하고 `current_action`이 없으며, 대상/현재 busy 조건과 그룹 조건을 통과할 때만 실행한다. | 도망 중 재탐색 문제라면 범위 상수보다 먼저 “idle 진입 안 함 / 탐색 실패 / 도망 경로 실패”를 구분해야 한다. |
| `unit_ai/idle_animals.rs:294-325` | 검색 반경은 `max(los + HUNTED_SIGHT_GROWTH, search_radius)`이고, 성공하면 `evade`. | 반경 3은 현재 DAT/역할 입력에서 나온 실행값인지 확인 필요. 소스의 보편 상수라고 단정하면 안 된다. |
| `unit_ai/idle_animals.rs:176-224` | EVADE_188329는 경로 위 reach 지점을 사용하지만, 주석과 코드상 **지도 경계 처리·두 번째 목표·4방향 재시도는 미구현**이다. | 기존 EVADE 스위치를 다시 켜는 것은 새로운 수정이 아니다. 실패 분기에 실제 진입하는 사례인지 먼저 확인한다. |
| `unit_ai/life.rs:395-401` | Hunted adjusted timeout은 `idle_timeout * 5 >> 2`이다. | 3.4초라는 관측만으로 이 값을 바꾸면 안 된다. timer 초기화·통지 시점을 함께 비교한다. |

보존된 원본 주소(이번 재독 아님):

- Hunted idle / 검색 분기: `0xcfcbd0`, `0xcfd0bb` 이후.
- 탐색: `0xd22c20`.
- 도망 목표/계획: `0xd26200`, 타일 플래너 `0x1057a40`, 경로 위 거리 지점 `0x106e0b0`.
- 위 주소는 `original-188329-animal-case-186s.md`, `original-188329-reading-round2.md` R11, findings 9·12·26에 기록돼 있다.
- 158041 문서 주석 `FUN_140c26420`은 **188329 Hunted 통지 함수 주소로 쓰면 안 된다**. 실제 vtable/호출 관계를 다시 식별해야 한다.

## 4. Ctrl 이동 쪽에서 이미 있는 것과 구체적 미완성 후보

### 경로

`orders/interact.rs:309-338`: 단일 유닛이라도 Ctrl Held이면 loose 빠른 경로를 건너뛰고 splitter/그룹 경로로 간다.

`orders/split.rs:227-245`: Ctrl Held는 다른 멤버를 묶지 않아 한 명짜리 그룹이 될 수 있다.

`orders/interact.rs:367-387`: Ctrl은 retargeting과 formation lock 인자에도 영향을 준다.

이미 `FORMING_188329`에 새 이동 플래그, 선두 앞섬, 형성 속도/예산, steer가 들어 있다. `HORDE`는 대형 분류 없는 그룹의 별도 분기이며, findings55의 과거 실행상 10.1/21.9초 오차를 해결하지 않았다. 두 기능을 다시 구현하는 것은 중복이다.

### 후보 A: 선두 재배치가 실제 경로 대신 항상 직선

- `groups/place.rs:410-420` 주석은 원본 pather를 읽지 않아 직선 근사임을 명시한다.
- 실제 `front_lead_188329`의 `groups/place.rs:477-478`은 `let path = [w, c];`로 **언제나 W→centroid 두 점 직선**을 사용한다.
- 그 경로에 멤버 위치를 투영하고 lead를 빼 새 그룹 위치를 계산한다(`479-544`).
- 과거 원본 기록 `original-188329-group-forming-lead-case-228s.md` F4는 pather 경로를 사용한다고 적고, 당시 제안은 열린 직선에서만 근사하고 나머지는 확인하라는 것이었다.
- 따라서 9479의 Ctrl 이동 직후 그룹 위치부터 달라지고 지형·장애물이 개입한다면 **원본의 W→centroid 경로와 현재 직선 근사의 차이**를 먼저 조사할 수 있다.
- 이것이 해당 리플의 원인이라는 증거는 없다. 장애물·곡선 경로가 실제 있었는지 추적이 필요하다.
- 원본 주소 기록은 문서/코드에서 `0x10532b0`와 `0x10533b0` 표기가 엇갈린다. 주소를 확정하지 말고 `0x10ef69f`의 실제 호출 대상을 다시 읽는다.

### 후보 B: commandMoveTo의 MEMBERS_SENT 처리

- `groups/command.rs:281`은 여전히 `MEMBERS_SENT | FOLLOWED`를 모두 지운다.
- 과거 P20 문서 F2/열린 문제 4는 188329 `0x10d8e9b`가 bit12(FOLLOWED)만 지운다고 기록한다.
- 이는 소스와 보존된 원본 읽기 기록의 구체적 불일치다. 단, 첫 생성 그룹의 MEMBERS_SENT가 원래 0이면 이 차이는 아무 효과가 없으므로 먼저 해당 그룹의 이전 flags를 확인해야 한다.
- 신규 실험을 한다면 원본 재독 후 기존 FORMING 스위치 아래 bit12만 지우는 실험이 가능하다. 현재 자료만으로 기본 동작을 바꿀 근거는 부족하다.

### 후보 C: 첫 틱 위치/속도 타이밍

- `groups/steer/to_slots.rs:150-245`에 first-pass gap·speed·budget 추적이 이미 있다.
- `FORMING_FIRSTGAP_188329`, `FORMING_FIRSTPLAN_188329`은 기본 꺼짐이며 findings39/인계표에서 켜면 기존 재현이 악화된 것으로 기록돼 있다.
- 따라서 “처음 한 틱 밀린다”는 이유만으로 이 실험을 켜서 수정 완료로 삼으면 안 된다. stop 후 velocity/acceleration과 첫 그룹 갱신 순서를 원본과 대조해야 한다.

## 5. 최소 추가 추적 — 별도 두 실행

실행 도구는 기존 `go.ps1`이고, **기본값은 옛 helper 예시가 아니라 최신 `M6_envs.txt` 전체**를 사용한다. 연구 자료만으로 이 환경에서 실행한 것은 아니다.

1. **Ctrl 확인 `A_ctrl921_1`**: replay 520596921, Updates 1000, `OBJECTS_RANGE=400-1000`, `OBJECT_IDS=9479`, `GENIE_TRACE_COMMANDS=1`, `GENIE_TRACE_FORMING=1`, 필요할 때 `GENIE_TRACE_STEER_RANGE=400-1000`. 명령 순서/실제 owner/master를 확인하고, 9479가 들어간 그룹의 FORMING_FRONT·FORMING_PASS를 연계한다. 해당 그룹의 `flags`, 실제 경로 W/C, 첫 slot과 position을 비교한다.
2. **사슴 확인 `A_follow236_1`**: replay 520394236, Updates 6500, `OBJECTS_RANGE=6000-6500`, ID 필터 없이 Gaia AI와 P1 정찰병·새 주민을 함께 기록, `GENIE_TRACE_COMMANDS=1`, `GENIE_TRACE_ANIMAL=1`. FOLLOW 대상 ID를 확보한 뒤 두 번째 추적만 대상을 좁힌다. word7이 달라지는 P1 객체와 Gaia 도망 타이밍을 분리한다.
3. 원본 기록이 필요한 최소 범위는 replay 520394236 80~90초와 replay 520596921 Ctrl 명령 전후이다. 현재 truth4/5/6은 다른 리플의 기록이므로 이 사례에 재사용하면 안 된다.

### 현재 진단 로그의 한계와 작은 준비 작업

- `ANIMAL_SEARCH`(`idle_animals.rs:317`)와 `ANIMAL_EVADE`(`222`)는 **원인 유닛 ID·시각을 출력하지 않는다**. 여러 Gaia 동물 로그를 위치만으로 조합하면 잘못 귀속할 수 있다.
- `Surroundings.id/player`는 이미 존재한다(`unit_ai/surroundings.rs:204,234`). 진단 준비 시 ANIMAL 로그에 이 두 값을 추가하면 근거가 좋아진다. 시간은 `Surroundings`에 없으므로 존재한다고 가정해 쓰면 안 되고 world/side 진단 문맥에서 얻거나 호출부에 전달해야 한다.
- census OBJECT 로그는 이미 `ms/tick/player/id/ai idle/action/target`을 출력한다(`crates/tools/genie-oracle/src/census.rs:249-263`). 먼저 이것과 명령 로그로 좁히고, 부족할 때만 원본/엔진 진단을 늘린다.

## 6. 현재 결과 및 중단 조건

- 확인한 것: 사건 분류의 혼동, word7 해석의 한계, 현재 코드의 직선 근사/미구현 evade 분기, 식별자 없는 ANIMAL 진단.
- 확인 못 한 것: 첫 불일치 유닛·틱, 188329의 Hunted 통지 변경 여부, 9479의 정확한 그룹/지형, 수정 후 일치 구간.
- 엔진 동작을 바꾸지 않았다. 새 실행 수치가 없으므로 기존 first-mismatch 표를 갱신하지 않는다.
- 실행/원본 재독 자료가 확보되면 **Ctrl과 사슴을 독립적으로 한 사례씩 좁히고**, 인계 규칙대로 11개 리플을 비교한 뒤 통합한다. 지금 단계에서 반경·idle timeout·위치 값을 맞춰 넣는 수정은 증거가 없다.
