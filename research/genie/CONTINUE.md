# 이어받는 사람(또는 AI)을 위한 안내

기준일: 2026-11-13 (12절이 최신, 지금 상태는 13.4; 2.1절에 리플 3개 표). **일을 끝낼 때는 13절의 기록 지침을 꼭 따른다.** 브랜치: `research/genie-188329` (저장소 `ssapo/aoe2`). 이 문서만 읽고 같은 방식으로 이어갈 수 있게 썼다. 세부 근거는 [truth-log-findings.md](truth-log-findings.md)에 있다.

## 1. 목표

리플 파일만 넣으면 원본 게임과 같은 결과를 내는 것. 최종 용도는 리플 분석기의 **자원 표시**(자원별 실제 수입, 동물별 먹은 양 등)를 정확하게 하는 것이다. 게임 메모리 기록은 정답지일 뿐이고 제품에는 쓰지 않는다.

- 대상 원본: `AoE2DE_s.exe` 101.103.57257.0 #(188329).
- 엔진: librematch/genie `91d81be4` + 연구 패치. genie는 **옛 빌드 158041**을 따라 만들어져 있어서, 188329에서 바뀐 규칙을 하나씩 찾아 넣는 것이 일의 대부분이다.
- 기준 리플: 518239882 (선수 1 = ssapo, 선수 2 = Maerlin_the_Mighty325).

## 2. 지금 어디까지 맞나 (2026-11-11 새벽, 스위치 9개를 켠 엔진)

기준 리플 518239882, 원본 메모리 기록(`truth4.jsonl`, 0~900초) 대비. 실행 이름 `f1`(PC `runs\f1.*`).

| 항목 | 선수 1 | 선수 2 |
|---|---|---|
| 자원 4종이 원본과 일치(차이 ≤ 0.01) | 411.2초까지 | 450.9초까지 |
| 자원이 50 넘게 틀리기 시작 | 596.3초 | 767.1초 |
| 체크포인트 자원 합계(word 1) | 469.1초 | 524.9초 |
| 체크포인트 위치(word 7) | 384.8초 | 426.8초 |
| 체크포인트 액션(word 9) | 412.8초 | 398.8초 |
| 900초까지 모은 식량(원본 → 엔진) | 2,626 → 2,416 | 2,431 → 2,191 |
| 900초까지 모은 나무 | 1,758 → 1,566 | 1,732 → 1,716 |

- "일치 구간" 뒤의 차이는 대부분 주민 한 명의 한 번 내려놓는 양(10)이 잠깐 났다 사라지는 것이다. 약 550초까지 재고 차이는 0~30 안이다.
- 엔진은 update 36,452(약 930초)에서 멈춘다: "a helper that answers a call for help". 멈추는 곳은 고칠 때마다 바뀐다(22번 기록 참고). 900초 누적값은 그 직전이라 아직 믿을 만하지만, 멈춤이 900초 앞으로 오면 못 쓴다.
- 시작 시점(11-10 저녁)에는 자원 일치 134초, 위치 일치 32.5초였다. 그 사이에 넣은 것은 12절 표에 전부 있다.

### 2.1 리플 3개 (2026-11-13 세션 M4, 지금 기본 = 스위치 27개: 아래 25개 + `FARMSPOT` 52 + `MOVEEND` 53; 25개 = 옛 17개(`J_f_*`) + `MASTERHP` 40 + `GARRISON_RECORD` 41 + `RESSEARCH` 43 + `EXPLORE_WAIT` 44 + `PATROLRANGE` 45 + `HELPCALL` 46 + `PLANCHOICE` 47 + `GATHER_SNAP` 49; HUNT에 42번 포함; `SEARCH_CLEAR=unit`; 스위치 없는 50·51번 포함. 실행 `M4_p_239`, `M4_p_161`, `M4_p_097`; 518470161·517426097은 update 75,000까지; 한 줄 스위치 목록 `runs\M4_envs.txt`)

| 리플 (기록) | 첫 어긋남 P1 / P2 (13.3 판정 규칙) | 위치(word 7) 첫 불일치 P1 / P2 | 자원 첫 차이(> 0.01) P1 / P2 | 자원 50 넘게 P1 / P2 | 엔진 멈춤 update |
|---|---|---|---|---|---|
| 518239882 (truth4) | 710.6 (word 7·9) / 696.6 (word 7) | 710.6 / 696.6 | 718.4 (식량 −10) / 716.0 (나무 −10.1) | 782.6 / 787.6 | 멈추지 않음(41,600 = 리플 끝) |
| 518470161 (truth5) | 822.0 (word 10, 그 단어만) / 710.7 (word 7) | 없음(978초까지) / 710.7 | 없음(978초까지) / 756.4 (나무 −10) | 없음 / 945.7 | 멈추지 않음(75,000까지) |
| 517426097 (truth6) | 795.9 (word 7·9) / 795.9 (word 7) | 795.9 / 795.9 | 803.3 (식량 +10) / 803.3 (식량 +10) | 882.6 / 970.2 | 멈추지 않음(75,000까지) |

518239882 900초 누적(원본 대비 엔진): P1 식량 −50, 나무 −40.5; P2 식량 −20.1, 나무 +10.2. 확인 체크포인트(P1/P2): 518239882 **55/54**(전 53/53 — main의 `engine-check.yml` 기대값 "53개"를 고쳐야 한다), 518470161 125/108, 517426097 121/121.

**2026-11-13 (세션 M2, `L_p_*` → `M2_p_*`, `J_cmp.py`로 비교, 앞당겨진 것 없음)**: `GATHER_SNAP`(49번)은 517426097 P2 첫 어긋남 535.9 → 711.4초(word 7), 자원 첫 차이 587.4(금 +10) → 724.5초(식량 +10), 확인 체크포인트 81 → 108만 바꿨다. 518239882·518470161은 수치 동일. 50번(뱀의 Fly, 스위치 없음)은 세 리플 수치를 안 바꾼다(`M2_a_*` = 49번만, `M2_p_*` = 49 + 50번, 같음).

**2026-11-13 (세션 M3, `M2_*` → `M3_*`, `runs/M3_cmp.py`로 비교)**: 51번(문명 보너스의 "덤 자원" 작업 164, 스위치 없음)은 519686090만 바꿨다(아래 표). 세 연구 리플과 516956894·519700670은 그런 문명이 없어 stderr가 `M2_*`와 바이트 동일(TIMING 줄 제외).

**2026-11-13 (세션 M4, `M3_*` → `M4a_*`(52번만) → `M4_*`(52 + 53번), `runs/M4_cmp.py`로 비교, 앞당겨진 것 없음)**: `FARMSPOT`(52번, 농부가 농장 안 다음 자리를 뽑을 때 "지금 자리와 같으면 다시 뽑기"를 없앰)은 첫 어긋남(P1 / P2)을 518239882 676.7 / 682.2 → 710.6 / 696.6초, 518470161 822.0 / 613.2 → 822.0 / 710.7초, 517426097 561.9 / 711.4 → 795.9 / 795.9초로 늦췄다(확인 체크포인트 53/53 → 55/54, 125/93 → 125/108, 85/108 → 121/121). 518470161 P1은 자원 차이가 978초까지 없다(전 845.0초). 연구 밖 516956894는 548.4 / 626.4 → 639.4 / 684.9초(83/95 → 97/104), 519686090·519700670은 그대로. `MOVEEND`(53번, 그룹 이동이 끝날 때의 처리)는 여섯 리플 모든 선수의 첫 어긋남을 안 바꾸고(518470161·519700670은 stderr 바이트 동일), 516956894(P1 64,092; 52번 뒤 64,121)와 519686090(P1 64,725)의 멈춤 "AutomaticMoveUnitsToDesiredPositions' path to a slot"을 없앴다(둘 다 75,000까지 멈추지 않음). 첫 어긋남 뒤 바뀐 것: 517426097 P1 word 1 821.9 → 815.4초, word 6 919.4 → 886.9초(앞당겨짐), P2 word 1 828.4 → 847.9초, word 2·3 815.4 → 873.9초, word 6 880.4초 → 없음.

연구 밖 리플 셋의 지금 값(`M4_n_894`, `M4_n_090`, `M4_n_670`; 아래 표는 M3 때 것): 516956894 첫 어긋남 P1 639.4초(word 1·4·7·9) / P2 684.9초(word 7), 멈추지 않음(75,000까지); 519686090 P1 379.4 / P2 411.9초 그대로, 멈추지 않음(75,000까지); 519700670 P1 340.4 / P2 21.9초 그대로, P2 54,997 "a horde's command" 그대로.

연구 밖 188329 리플 셋(원본 기록 없음, 체크포인트 단어만; 실행 `N_<리플>` → `M2_n_*` → `M3_n_894`, `M3_n_090`, `M3_n_670`, update 75,000까지):

| 리플 | 첫 어긋남 P1 / P2 (이전 → 지금) | 엔진 멈춤 (이전 → 지금) |
|---|---|---|
| 516956894 | 41.4 (word 7·9) / 28.4 (word 9) → 548.4 (word 7·9) / 626.4 (word 7·9) | Gaia update 2 "a flight keeping away from a class" → P1 update 64,092 "AutomaticMoveUnitsToDesiredPositions' path to a slot" (약 835초; P1 83개·P2 95개 체크포인트 확인) |
| 519686090 | 99.9 (word 1) / 398.9 (word 10) → **379.4 (word 1·2·4·7·9) / 411.9 (word 7)** (51번; 확인 체크포인트 P1 14 → 57, P2 60 → 62) | P1 64,950 → 64,725, 같은 문구 "AutomaticMoveUnitsToDesiredPositions' path to a slot" (첫 어긋남 뒤) |
| 519700670 | 340.4 (word 7) / 21.9 (word 7, 체크포인트 하나만; 그 뒤 476.9) → 그대로 | P2 54,997 "a horde's command" 그대로 |

이번 세션(K)의 변화(`J_f_*` → `K_m_*` → `K_h_*` → `K_g_*`; `J_cmp.py`로 비교, 앞당겨진 것 없음): `MASTERHP`(40번)는 518470161 P1 멈춤 42,960 → 69,419만 바꿈. HUNT의 멧돼지 탐색 상태(42번, `K_h_*`)는 518239882 P2 word 9 398.8 → 497.0초(P2 첫 어긋남 398.8 → 466.4초, 확인 체크포인트 33 → 38), 517426097 P2 word 9 444.9 → 581.4초. `GARRISON_RECORD`(41번, `K_g_*`)는 517426097 P1 word 7 262.9 → 282.4초, word 4 282.4 → 334.4초, word 9 282.4 → 321.4초, 50 넘게 579.2 → 666.7초, 확인 체크포인트 39 → 42, 멈춤 70,196 → 70,577; 518239882는 stderr 바이트 동일, 518470161은 수치 동일. 아래 `J_c_*`·`I_ti_*` 비교는 그 전 기록이다. **`RESSEARCH`(43번, `IMP_r1_*` 대 `K_g_*`)**: 첫 어긋남 518470161 P1 411.0 → 671.7초·P2 457.2 → 493.8초, 517426097 P1 282.4초 그대로·P2 444.9 → 535.9초, 518239882 P1 426.8 → 580.8초·P2 466.4 → 682.2초; 자원 50 넘게는 여섯 선수 모두 780초 뒤로(위 표). 518470161은 멈추지 않게 됐고, 518239882(41,256 → 36,702)와 517426097(70,577 → 61,100)은 멈춤이 앞당겨짐(첫 어긋남 뒤; 구현 안 된 기능의 멈춤, 12.5). **44~47번(`IMP2_a_*` → `IMP2_b_*` → `IMP2_c_*` → `L_p_*`, 기준 `IMP_r1_*`)**: `EXPLORE_WAIT`는 517426097 P1 첫 어긋남 282.4 → 555.4초, 518470161 P1 671.7 → 743.2초. `PATROLRANGE`는 518239882의 멈춤(36,702)을 없앰. `HELPCALL`은 517426097 멈춤 61,100 → 73,686. `PLANCHOICE`는 518239882 P1 580.8 → 676.7초, 518470161 P1 743.2 → 822.0초·P2 493.8 → 613.2초, 517426097 P1 555.4 → 561.9초, 그리고 517426097의 성문 멈춤(73,686)이 없어짐. 첫 어긋남 뒤에서 앞당겨진 것(`J_cmp.py IMP2_c L_p`의 EARLIER): 518470161 P1 word 1 880.5 → 874.0초, P2 50 넘게 902.6 → 875.7초; 517426097 P1 50 넘게 892.4 → 862.3초, P2 word 6 971.4 → 880.4초.

판정 규칙(2026-11-12 바뀜, 13.3): 리플·선수마다 "첫 어긋남"(모든 체크포인트 단어 중 가장 이른 불일치와 자원 첫 차이 > 0.01 중 이른 것)이 앞당겨지지 않으면 기본에 넣는다. 그 선수의 첫 어긋남 뒤에 생긴 불일치는 뒤따른 것으로 보고 막지 않는다. 예전 규칙(어느 단어든 첫 불일치가 하나라도 앞당겨지면 안 넣음)으로 꺼 두었던 `ESCAPE`·`FORMING`을 이 규칙으로 켰다.

옛 기본(`J_c_*`, 15개)과 첫 어긋남 비교(P1 / P2): 518239882 384.8 / 398.8 → 426.8 / 398.8, 518470161 372.7 / 216.7 → 411.0 / 457.2, 517426097 230.4 / 444.9 → 262.9 / 444.9. 앞당겨진 것 없음. 첫 어긋남 뒤에서 앞당겨진 것(새 규칙으로는 막지 않음, 12.5 0번): 518239882 P2 자원 50 넘게 767.1 → 691.8초와 900초 P2 식량 −249.7 → −439.7, 517426097 P2 word 10 620.4 → 542.4초, 517426097 멈춤 73,336 → 70,196. 나아진 뒤쪽: 518239882 P1 50 넘게 596.3 → 631.7초·900초 P1 나무 −160.6 → −53.4·멈춤 36,452 → 41,256, 518470161 P2 50 넘게 345.7 → 748.7초.

그 전(`J_c_*` = 15개, 38번 시체 탐색을 넣은 옛 기본) 대 `I_ti_*`: 518239882·517426097은 stderr 바이트 동일. 518470161 P1(38번, 302.4초 양치기가 시체를 고름): 위치 307.7 → 372.7초(word 9 411.7, word 4 424.7, word 1 444.2, 나머지 522.2), 자원 첫 차이 320.3 → 411.0초, 50 넘게 324.0 → 484.2초, P2 word 2·3·6 411.7/431.2/606.7 → 587.2/522.2/900.0, 확인 체크포인트 P1 46 → 56. 대신 P1 멈춤이 89,441 → 42,960(약 560.7초)으로 당겨졌다(첫 불일치 뒤, 12.5).

37·39번을 처음에 꺼 둔 이유(예전 규칙): `ESCAPE`는 518239882 P2 50 넘게 767.1 → 691.8초, 518470161 P2 word 6 606.7 → 600.2초, 517426097 P2 word 10 620.4 → 542.4초를, `FORMING`은 518239882 P2 50 넘게 767.1 → 765.4초를 앞당겼다. 모두 그 선수의 첫 어긋남 뒤라 새 규칙으로는 막지 않는다(`J_f_*`에서 518470161 P2 word 6은 900.0초).

새 리플 두 개를 처음 돌렸을 때(스위치 9개)는 518470161 P2 위치 8.7초·식량 35.6초, 517426097 P1 위치 93.9초·식량 123.8초였다. findings 27~38로 위처럼 늘었다. 채점: `runs/summ2.sh <이름> ../truth/analysisN`(518239882는 `../truth/analysis`, 518470161은 `analysis5`, 517426097은 `analysis6`). 두 실행 묶음 비교: `cd runs && python3 J_cmp.py <기준 접두어> <새 접두어>`(먼저 `./summ2.sh <이름> <analysis> > J_sum_<이름>.txt`).

켜는 스위치(전부 `=1`): `GENIE_EXPERIMENT_SORT_LISTS`, `GENIE_EXPERIMENT_SHORT_188329`, `GENIE_EXPERIMENT_SPAWN_188329`, `GENIE_EXPERIMENT_AI_ORDER_188329`, `GENIE_EXPERIMENT_EVADE_188329`, `GENIE_EXPERIMENT_WALK_188329`, `GENIE_EXPERIMENT_HUNT_188329`, `GENIE_EXPERIMENT_UNLOAD_188329`, `GENIE_EXPERIMENT_MOVETO_188329`, `GENIE_EXPERIMENT_CORNER_188329`, `GENIE_EXPERIMENT_REWALK_188329`, `GENIE_EXPERIMENT_GRAZE_188329`, `GENIE_EXPERIMENT_BACKWORK_IGNORE_188329`, `GENIE_EXPERIMENT_TASKARGS_188329`, `GENIE_EXPERIMENT_IGNORELIST_188329`, `GENIE_EXPERIMENT_ESCAPE_188329`(37번), `GENIE_EXPERIMENT_FORMING_188329`(39번), `GENIE_EXPERIMENT_MASTERHP_188329`(40번), `GENIE_EXPERIMENT_GARRISON_RECORD_188329`(41번), `GENIE_EXPERIMENT_RESSEARCH_188329`(43번), `GENIE_EXPERIMENT_EXPLORE_WAIT_188329`(44번), `GENIE_EXPERIMENT_PATROLRANGE_188329`(45번), `GENIE_EXPERIMENT_HELPCALL_188329`(46번), `GENIE_EXPERIMENT_PLANCHOICE_188329`(47번), `GENIE_EXPERIMENT_GATHER_SNAP_188329`(49번), `GENIE_EXPERIMENT_FARMSPOT_188329`(52번), `GENIE_EXPERIMENT_MOVEEND_188329`(53번). 앞의 셋은 `runs\go.ps1`이 항상 켠다. 나머지는 `-Envs`로 준다(12.3절의 `$a`). 켜지 않는 것: `GENIE_EXPERIMENT_UPSTREAM_RELICS`, `GENIE_EXPERIMENT_UPSTREAM_CART`(upstream 동작 그대로, 원본 확인 없음; 켜도 세 리플 결과 같음, 34번), `GENIE_EXPERIMENT_FORMING_FIRSTGAP_188329`, `GENIE_EXPERIMENT_FORMING_FIRSTPLAN_188329`(39번). 추적 `GENIE_TRACE_FORMING=1`(그룹 형성 줄).

## 3. 지켜야 할 것

- 커밋·푸시는 `research/genie-188329`에만. `main` 병합·배포 금지(사용자가 시키기 전까지).
- 커밋 작성자는 `Claude <noreply@anthropic.com>`. 사용자의 회사 메일을 쓰지 않는다.
- 원본 EXE·DAT·리플·메모리 덤프·디컴파일 원문·빌드 산출물·툴체인은 저장소에 넣지 않는다. PC의 `genie-replays` 폴더에만 둔다.
- 실행 중인 게임 메모리는 **읽기만** 한다(2026-11-10 사용자 허용). 쓰기, 바이너리 수정, 설치 파일 덮어쓰기 금지. 싱글·리플 재생에서만, 온라인 대전 중에는 금지.
- 사용자가 PC를 쓰고 있으면 화면을 건드리기 전에 묻는다. SWITCH 출근 앱 창은 건드리지 않는다. 유료 API·서비스를 쓰지 않는다.
- 사용자에게는 반말, 결론 먼저, 쉬운 말로. 확인한 것과 추정을 구분해 말한다. 틀린 말을 했으면 바로 고쳐 말한다.

## 4. 어디에 뭐가 있나

사용자 PC `C:\Users\ssapo\genie-replays\`:

| 경로 | 내용 |
|---|---|
| `genie\` | 엔진 소스(패치 적용 상태). 빌드 산출물 `genie\target\release\examples\census.exe` |
| `aoe2-push\` | 이 저장소의 체크아웃. 여기서 `git push origin research/genie-188329` |
| `518239882\` | 기준 리플. `data\empires2_x2_p1.dat`는 게임 DAT |
| `truth\truth4.jsonl` | 원본 메모리 기록(0~900초, 360MB). `truth\analysis\`는 그 분석(경제, 캐시) |
| `truth\truthlog4.ps1` | 기록 도구(저장소 `tools/truthlog4.ps1`과 같음) |
| `runs\` | 실행 스크립트(`*.ps1`)와 출력(`*.err`, `*.out`), 비교 스크립트 |
| `re-kit\` | 원본 분석 환경: 디컴파일 원문, 색인, 보조 스크립트, 분석용 EXE, Ghidra 프로젝트(7절) |
| `CONTINUE.md` | 이 문서의 사본 |

2026-11-10에 `%LOCALAPPDATA%\Temp\genie-replays`에서 이 위치로 옮겼다. 옛 경로에는 새 위치를 가리키는 연결(junction)만 남겼다. 같은 폴더의 `DECOMPILE-READING.md`·`WORKLOG-2026-11-10.md`는 다른 도우미가 이어서 쓴 원본 읽기 기록이다(유닛 갱신의 실제 호출부가 `0x114c0f0`임을 찾았다. 엔진의 `GENIE_EXPERIMENT_AI_ORDER_188329`는 그 도우미의 미검증·미완성 실험이다).

메모리 덤프 원본은 `C:\Users\ssapo\Downloads\aoe2_memdump\AoE2DE_s_57257_mem.bin`.

저장소 `research/genie/`: `truth-log-findings.md`(찾은 것 1~7, 가장 중요), `original-188329-code-map.md`(주소표·확인 방법), `original-188329-pathfinding-notes.md`, `original-188329-gather-map.md`·`-hunt-verify.md`·`-gather5-map.md`(사냥·채집 조사), `truth-economy-518239882.md`, `sorted-lists-and-truth-trace.patch`(엔진 변경 전부), `tools/`.

## 5. 일하는 순서 (이 루프를 그대로 돈다)

1. **가장 이른 불일치 하나만 본다.** 뒤의 차이는 앞의 결과일 수 있다. 앞을 고치기 전에는 뒤를 해석하지 않는다.
   - `runs\pos2.ps1`(개체 위치 추적, 틱 범위는 스크립트 안 `GENIE_TRACE_OBJECTS_RANGE`) → `python3 runs/cmp_pos.py` → 개체별 첫 불일치 시각.
   - `runs\steerrun.ps1`(`GENIE_TRACE_STEER`: 틱마다 걷는 경로와 조향 입력, 느림. 스위치는 스크립트에 직접 맞춘다) → `python3 runs/cmp_paths.py <ms>` → 원본 경로 중 엔진에 없는 것. 가볍게는 `runs\pt.ps1`(`GENIE_TRACE_PATHS`: short pather 호출마다 질의와 결과 한 줄)을 눈으로 본다.
   - `runs\res.ps1`(체크포인트 + 자원 추적) → `python3 runs/grade_res.py runs/res.err` → 자원이 몇 초까지 맞는지.
2. **그 개체를 틱 단위로 원본과 나란히 찍는다.** 위치·forward·경로 상태·경유점을 비트(16진)로 본다. 차이의 모양으로 종류를 가른다.
   - 이동량이 1ulp씩 다르다 → 방향이 0.02° 다르다 → 경유점(목표 방향)이 다르다 → 경로 생성 쪽.
   - 몇 틱 늦거나 빠르다 → 동작/유닛 AI의 상태 전이나 대기.
   - 처음 나타난 자리부터 다르다 → 생성 위치.
   - 같은 틱 안의 난수 값이 다르다 → 갱신 순서(AI 난수는 틱마다 다시 시드된다).
3. **엔진이 그 순간 실제로 쓴 입력을 찍는다.** 추측하지 않는다. 엔진에 `eprintln!` 추적을 환경 변수 뒤에 넣고 다시 빌드한다(`GENIE_TRACE_STEER`, `GENIE_TRACE_PATHS`, `GENIE_TRACE_SPAWN`, `GENIE_TRACE_RES`가 그렇게 생겼다).
4. **원본에서 해당 함수를 찾는다**(7절). 엔진 소스의 문서 주석이 옛 빌드의 로직을 상수까지 적어 두었으므로, 그 상수·구조로 188329의 대응 함수를 알아본다. 그다음 **줄 단위로 대조**한다. "구조가 같아 보인다"로 넘기지 않는다.
5. **실험 스위치 뒤에 구현한다.** 원본의 연산 순서를 그대로 옮긴다(float 덧셈 순서, 정수 절단, 비교의 등호).
6. **검증한다.** 그 경로/위치가 원본과 같은 비트인지, 체크포인트가 어디까지 늘었는지, 채점기 수치가 나빠지지 않았는지. 좋아지지 않았으면 원인을 틀리게 잡은 것이다.
7. **문서에 적고 커밋·푸시한다.** `truth-log-findings.md`에 "찾은 것 N: 증상 / 원본 주소와 규칙 / 수정 / 결과", 확정과 미확정을 구분해서.

배운 것:

- 원본 기록의 표본은 120초까지 거의 매 틱, 그 뒤는 200ms 간격이다. 120초 뒤의 "처음 본 위치"는 이미 움직인 뒤일 수 있다.
- 기록 도구는 게임 스레드와 동기화하지 않는다. 움직이는 개체의 위치가 한 틱 늦게 잡힐 수 있다(타이머는 영향 없음).
- float에서 1 바로 아래 값의 acos가 3.45e-4라서 유닛은 0.02° 단위로만 돈다. 1ulp짜리 위치 차이는 무시할 잡음이 아니라 이 회전이 다른 틱에 일어났다는 신호다.
- 하위 에이전트의 조사 결과는 틀린 주장이 섞여 있었다. 엔진에 넣기 전에 직접 다시 확인한다.
- 내가 틀렸던 것: "걷기 차이는 4.63초부터"(실제 3.92초: 엔진 추적을 4.81초부터만 찍고 가정함), "ㄱ자 우회 함수가 바뀌었다"(실제로는 변 위 목표 후보 함수). 둘 다 **찍어 보지 않고 추정**해서 생겼다.

## 6. 엔진 빌드와 실행 (사용자 PC, PowerShell)

- Rust는 `%USERPROFILE%\.cargo`에 있다(PATH에 없음). 빌드: `cargo build --release -p genie-oracle --example census` (작업 폴더 `genie\`, 증분 3분).
- 빌드 전에 `Stop-Process -Name census` (실행 파일이 잠겨 있으면 링크 실패).
- 원격 셸의 PowerShell 호출은 30~80초에 끊긴다. `Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',<스크립트> -WindowStyle Hidden`으로 떼어 돌리고 `.done` 파일을 기다린다. 빌드와 실행은 다른 스크립트로 나눈다(`runs\steer.ps1`이 빌드).
- 네이티브 stderr는 `Start-Process -RedirectStandardError`로 받는다(`2>`는 UTF-16으로 깨진다).
- 기본 환경 변수: `GENIE_CORRECT=ids GENIE_EXPERIMENT_SEARCH_CLEAR=unit GENIE_EXPERIMENT_CAPTURE_SETUP=1 GENIE_NO_STOP=1 GENIE_PRINT_CHECKPOINTS=1` + 2절의 스위치 셋. 인자: `<리플> <DAT> <update 수>` (전체는 41600).
- 추적은 느리다. 전 개체 위치 추적은 700틱에 5분쯤 걸리니 틱 범위를 좁힌다. 체크포인트만 보는 실행은 2분이다.
- 엔진 소스를 고친 뒤에는 저장소의 패치를 다시 만든다: 기준 커밋(`91d81be4` + 기존 연구 패치 8개)에 대한 `git diff`가 `sorted-lists-and-truth-trace.patch`다.

## 7. 원본 코드를 읽는 환경

`genie-replays\re-kit\`에 압축 세 개가 있다.

- `re-kit.tar.gz`: `re/` — 디컴파일 원문(`out/*.c`, `out_c*/`), 보조 스크립트, 호출 색인(`calls_src.npy`, `calls_dst.npy`), 난수 호출 표(`rand_sites.pkl`), Ghidra 스크립트(`gs/RangeDecomp.java`), 조향 재현 스크립트(`emu/`).
- `re-unpacked-exe.tar.gz`: 분석용 EXE(`.text`를 메모리 덤프로 채운 것). SHA-256 `aeedb03612a8ed2f293c6a28dced5546dc793df30c145735dc221c5e3ba4177d`. 덤프에서 다시 만들려면 `make_unpacked.py <원본 exe> <덤프> <out>`(다시 돌려 보지는 않았다. 해시로 확인할 것).
- `re-ghidra-proj2.tar.gz`: Ghidra 11.3.2 프로젝트(가져오기만 한 상태, 자동 분석 없음).

차리는 법(리눅스, Python 3 + numpy + capstone, JDK 21, Ghidra 11.3.2 PUBLIC):

1. 세 압축을 한 폴더에 풀어 `re/` 안에 `AoE2DE_s_unpacked.exe`와 `proj2/`가 오게 한다.
2. `cd re && python3 dz.py 1210f60 | head`가 디스어셈블을 내면 된다(`pe.py`는 같은 폴더의 EXE나 `AOE2_RE_EXE`를 읽는다).
3. 디컴파일: 목록 파일에 `<시작 hex> <끝 hex> 1` 줄을 쓰고(범위는 `pe.fn(rva)`),
   `ghidra_11.3.2_PUBLIC/support/analyzeHeadless $PWD/proj2 aoe -process AoE2DE_s_unpacked.exe -noanalysis -scriptPath $PWD/gs -postScript RangeDecomp.java $PWD/list.txt $PWD/out/x.c`.
   한 번에 1~3분. `./show.sh out/x.c 0x<rva>`로 함수 하나를 본다.

함수를 찾는 단서:

- 주소는 전부 RVA(이미지 기준 0x140000000). genie 주석의 `FUN_14…`는 158041 주소라 여기서는 못 쓴다.
- RTTI 이름은 해시라 못 쓴다. 대신 **난수 호출에 원래 함수 이름과 줄 번호가 붙어 있고**(`rand_sites.pkl`), 유닛의 정지 함수(가상 `+0x618`)도 소스 줄 번호를 인자로 받는다.
- 특징 있는 float 상수 여러 개를 함께 참조하는 함수를 찾는다(`xr.xrefs`). 생성 위치 탐색은 1e-4와 0.01을 네 번씩 참조하는 함수로 찾았다.
- 가상함수표에서 슬롯으로 따라간다(`pe.q(vtable + slot)`). 유닛 `0x32a4698`, Hunt `0x32274b8`, MoveTo `0x3226048`, Gather `0x3224dc8`.
- 개체 필드는 가려져 있다. 상수는 `original-188329-code-map.md`와 `truth-log-findings.md`의 "정답 기록 도구"에 있다.

## 8. 원본 기록을 새로 떠야 할 때

다른 리플을 기준으로 삼거나 새 필드가 필요할 때만이다. 사용자에게 그 리플을 게임에서 한 번 재생해 달라고 한다(처음 3분은 배속 없이).

- `powershell -File truth\truthlog4.ps1 -MaxSeconds 28800`을 미리 띄워 두면 게임이 켜질 때까지 기다렸다가 `truth4.jsonl`에 쓴다. 빌드가 다르면 "wrong build"로 끝난다.
- 필드를 더하려면 `truthlog4.ps1`의 C# 부분에 읽을 오프셋을 더한다. 평문 필드(위치 `+0x3bc`, forward `+0x3c8`, 경로 상태 `+0x3f0`)가 가려진 필드보다 쉽다.

## 9. 다음에 할 일 (이 순서로)

1. **턴 틱에 도착한 유닛의 다음 명령**(찾은 것 7). 선수 2 정찰병 3430이 32.55초에 3틱 늦는다. 원본 유닛 갱신 `0x12488e0`에서 동작 갱신 → 알림(유닛 AI 가상 `+0x38`) → 유닛 AI 갱신 `0xd42a00`의 순서를 읽고, 엔진 `unit_ai/unit.rs`·`UnitAi::off_turn`과 맞춘다.
2. 선수 2 양 3668의 38.78초 위치 차이(원인 미확인. 1을 고친 뒤 다시 본다).
3. 사냥 차이 중 사람 선수에 영향 있는 셋(`original-188329-hunt-verify.md`의 D8, D9, D1). 넣기 전에 원본에서 직접 다시 확인한다.
4. 자원이 처음 갈리는 134초 근처(채점기 `grade/thresholds.csv`가 자원별 첫 시각을 낸다). 일반 채집 차이(`original-188329-gather5-map.md`: 보조 자원 표, 걷는 중 재타겟)가 후보다.
5. 생성 위치 탐색의 빠진 부분: 건물→집결점 타일 경로가 있을 때의 정렬(`0x12796a0`). 집결점이 건물 밖인 경우를 원본 기록으로 확인한다.
6. 다른 리플로 검증. 체크포인트만으로 "몇 초까지 검증됨"이 나오므로 메모리 기록 없이 된다. 맵·문명이 다른 판을 사용자에게 받는다.
7. 실험 스위치를 정식 구현으로 바꾼다(빌드 번호로 분기). 잠든 목록의 순서는 아직 확인하지 않았다.
8. 분석기 출력: 엔진이 자원별 실제 수입(환불 제외)과 동물별 먹은 양·썩은 양을 내게 하고, 체크포인트 기준 "검증된 구간"을 함께 표시한다. 계산법은 `truth-economy-518239882.md`.

## 10. 2026-11-10 이어받은 뒤 사용자 우선순위 변경 (다른 도우미가 쓴 절)

**디컴파일된 원본 코드 읽기가 1순위. 추가 구현과 리플 실험보다 원본 분석·기록을 먼저 한다.**
읽기 기록: 로컬 루트 `DECOMPILE-READING.md`, 저장소 `research/genie/original-188329-reading-log.md`.
- AI 전체 갱신 0xd42a00, Hunt 0xbb6230의 state 1/4/8, 검색 0xd22c20, MoveTo 0xb93260을 직접 읽고 근거·미확정을 구분해 기록했다.
- 9절 1번 주소 정정: AI 호출부는 0x114c0f0 안의 0x114cee8~0x114cf60. 0x12488e0만 읽어서는 확인할 수 없다.
- 원본은 매 틱 명령 검사 0xd443f0 뒤 자기 차례의 AI 전체 갱신을 호출한다. 전체 갱신 0xd42a00 본문에는 0xd384f0 직접 호출이 없다.
- 우선순위 변경 전에 unit_ai/unit.rs와 actions.rs에 AI_ORDER_188329 실험을 넣었으나 **미검증·불완전**. 전체 갱신의 run_orders 제거 여부 등 추가 원본 확인이 필요하다. 기본 스위치는 꺼져 있고 기존 검증 수치는 갱신하지 않는다.
- 다음: 가상 +0x248 및 +0x238 실제 구현, 동기 알림 전달, Hunt state 1 반환값부터 읽는다. 이 절과 읽기 기록이 이전 구현 우선 작업 순서보다 우선한다.

## 11. 그 뒤 (2026-11-10 저녁)

- 작업 폴더를 `C:\Users\ssapo\genie-replays`로 옮겼다.
- 원본 읽기를 다섯 갈래로 나눠 돌렸다: 유닛 갱신 순서·알림·예약 명령 / Hunt·MoveTo 상태 기계 / Gather(type 5) 남은 항목 / 틱당 걷기 함수 `0x1210f60` 전체 / 생산·생성 위치·건설. 갈래마다 읽은 뒤 반박 검증을 한 번 더 거친다. 결과는 분석 환경의 `re/out_r1`~`out_r5`(각 `*.md`와 `verify.md`)에 쌓이고, 끝나면 저장소에 요약을 넣는다.


## 12. 2026-11-11 인계 기록 (가장 최신. 여기부터 읽어도 된다)

### 12.1 한 줄 요약

원본 코드 17개 구역을 읽어 차이를 정리했고(`original-188329-reading-round2.md`), 그 뒤에는 "가장 이른 어긋남 하나 → 원본에서 그 사례만 읽기 → 엔진에 스위치로 넣기 → 실행해서 확인"을 16번 반복했다. 각 반복의 근거와 결과는 `truth-log-findings.md` 8~24번에 시간순으로 있다.

### 12.2 넣은 것 전체 (스위치별, 근거 문서, 확인 여부)

| 스위치 | 내용 | 엔진 파일 | 근거 | 확인 |
|---|---|---|---|---|
| SORT_LISTS | 살아 있는 개체 목록을 id 순으로 | `objects/object_list.rs` | findings 1~7 | 실행 확인 |
| SHORT_188329 | 짧은 경로: 목표 상자 자르기, `segment_hit`, 발 검사 | `pathing/short_path/{mod,main_loop,geometry,nodes}.rs` | pathfinding-notes | 실행 확인 |
| SHORT_188329 | 모서리 광선 접촉 → 시작 노드의 접촉 처리, L 다리 비용, 다리 방향 | `main_loop.rs` `corner_expand`/`touch_from`, `start.rs` `legs` | shortpath-case-88s | 88.1초 사례 |
| SHORT_188329 | 시작 노드 평가값 = 목표의 사각형 평가(`0x107e350`) | `start.rs` `Search::start` | start-estimate-case-330s | 330.1초 사례 |
| SPAWN_188329 | 생성 위치 탐색(고리, 걸음 수 < 3), 덧셈 순서 | `production/spawn/search.rs` `spawn_point_188329` | reading-round2 R5 | 앞 7명 비트 일치 |
| SPAWN_188329 | 경로 방식(집결점→건물 타일 경로, 끝에서 둘째 점부터 걸음 수 우선) + 내보내기도 같은 탐색 | `search.rs`, `new_unit.rs` `spawn_path_set`, `garrison/let_out.rs` | findings 17 | 227초, 232초 사례 |
| AI_ORDER_188329 | 대기 명령 확인을 매 틱, 전체 갱신은 큐 안 돌림, 그룹 술어 | `unit_ai/{unit,actions,update}.rs`, `groups/update/mod.rs` | reading-round2 R1 | 32.5초, 38.8초 사례 |
| EVADE_188329 | 사슴 도망: 타일 플래너 경로 위 reach 지점 | `unit_ai/idle_animals.rs` `evade`, `movement/new_path.rs` `plan_path`, `unit_ai/side.rs` `tile_path` | findings 9, 12 | 70.4초, 95.6초 사례 |
| EVADE_188329 | 클래스 65 → Hunted AI | `unit_ai/ids.rs` | R11-D3 | **186초 사례와 무관**: 그 동물은 클래스 9이고, AI 종류는 리플 저장값(need_unit_ai=2)을 그대로 써서 이 변경이 닿지 않는 경로다(findings 26). 지울지 말지는 미정 |
| WALK_188329 | 종류 2 링크가 끝나면 최상위 레벨까지 풀기(R4-D1) | `movement/waypoint.rs` `arrived` | walk-case-98s | 98.2초 사례 |
| WALK_188329 | 꼬리 짧은 경로의 목표 = 대상의 현재 위치(R4-D4) | `movement/request_plans.rs` `short_try` | tail-goal-case-175s | 175.3초 사례 |
| WALK_188329 | 경로 없음 + 시도 남음 → 어느 웨이포인트에서나 0.1초 멈춤(R4-D6) | `movement/new_path.rs` `no_path` | pause-case-330s | 330.1초 사례(시작 평가값과 함께) |
| HUNT_188329 | 내려놓은 뒤 가축 3단계 탐색(R2-D8) | `gathering/hunt/unit.rs` `hunt_next_search`, `map/spatial/search.rs` `closest_object` | findings 14 | 144.1초 사례 |
| HUNT_188329 | 작업 시작 때 대상(클래스 8, 32, 15)에 붙이기 `0x1116f60` | `gathering/hunt/gathering.rs` `set_face` | snap-case-155s | 155.4초 사례 |
| HUNT_188329 | 클래스 10(멧돼지) → 종류 5 탐색(R2-N1) | `hunt/unit.rs`, `gathering/gather_search/passes.rs` `first_resource` | boar-kind-case-335s | 335.1초 사례 |
| UNLOAD_188329 | 복귀 기록: 맨 앞 액션의 대상이 그 건물이 아니면 대상 없이 기록 | `garrison/unit.rs` `go_inside` | unload-case-232s | 232.1초 사례 |
| MOVETO_188329 | MoveTo는 기다리지 않고 바로 실패(R2-D9 = R7-C1) | `movement/move_to/mod.rs` `give_up` | findings 21 | 394초 사례 |
| CORNER_188329 | 모서리 노드 광선 콜백 0x107c590(토큰 없음, 넓이 0 교집합 건너뜀, 축 광선은 스윕) | `short_path/raycast.rs` `corner_ray_188329`, `main_loop.rs` `corner_expand` | corner-ray-case-4.9s (findings 27) | 518470161 4.9초 사례 |
| REWALK_188329 | 재보행이 지나가는 UNSET 정점의 목표 판정 | `short_path/main_loop.rs` `rewalk_advance` | rewalk-goal-case-90.9s (findings 28) | 517426097 90.9초 사례 |
| GRAZE_188329 | 가축이 혼자 움직이기 전 풀 뜯기 한도(Graze wait_time)와 도달 길이 검사 | `unit_ai/idle_animals.rs`, `unit_ai/side.rs`, `world_view/side.rs`, `movement/path_end.rs` `reach_length`, `long_path/{mod,cost}.rs` | graze-limit-case-10s (findings 29) | 518470161 10.0초 사례 |
| HUNT_188329 | 걸어가던 사냥 대상이 사라졌을 때(MoveTo 코드 4/5) 예약 명령이 있으면 사냥을 끝내고 예약 명령으로(0xbb66f9) | `gathering/hunt/update.rs` `update_walk`, `hunter.rs` `hunt_part`(`HuntState::Done`) | hunt-queued-case-247.6s (findings 33) | 517426097 247.6초 사례(A_p18 비트 일치) |
| BACKWORK_IGNORE_188329 | 건물에서 일하러 내보낼 때 먼저 모으고, 각자 무시 목록을 비운 뒤 다른 유닛들을 넣음(0x16f4ba0) | `garrison/unload.rs` `back_to_work_inside_188329`, `orders/town_bell.rs` `workers_out` | backwork-ignore-case-166.9s (findings 32) | 518470161 166.9초 사례 |
| TASKARGS_188329 | 작업 명령 인자: slot 0x138의 6번째 = 명령 출처, 7번째 = 작업 바이트. 직접 0x8a8 호출자는 바이트 0 | `objects/unit/stop.rs` `ai_command`, `groups/update/{release,send}.rs`, `orders/{drop_site,town_bell,mod}.rs` | taskargs-ignorelist-check (findings 35) | 세 리플 첫 불일치 그대로, 518239882 900초 개선 |
| IGNORELIST_188329 | 걷기 질의(0x120cb90)가 장애물 관리자 무시 목록을 먼저 설정하고 남겨 둠, 짧은 경로의 내려놓기 질의(0x120f04f)가 그 목록을 뺌 | `map/spatial/grid.rs`, `movement/{waypoint,new_path}.rs` | taskargs-ignorelist-check (findings 36) | 세 리플 첫 불일치 그대로(518239882·517426097은 출력 바이트 동일) |
| (스위치 없음) | upstream 이식: 유물 수입, ClosestObject 한도·농장, Transport 정지, 형식 크레이트(`num_enum` 0.7) | `construction/building_update.rs`, `players/world_player/income.rs`, `map/spatial/search.rs`, `unit_ai/update.rs`, `garrison/transport/work.rs`, formats/*, `Cargo.toml`/`.lock` | upstream-ports-sessionA (findings 34) | 세 리플 결과 그대로. 188329 미확인 |
| UPSTREAM_RELICS / UPSTREAM_CART (켜지 않음) | upstream 그대로의 유물 없는 수도원 0.0 더하기 / 손수레 slot 0x140 인자 | `construction/building_update.rs` / `gathering/mule_cart.rs` | findings 34 | 켜도 세 리플 같음. 원본 확인 없음 |
| (스위치 없음) | 엔진이 멈추던 세 곳을 원본 동작으로 | `unit_ai/actions.rs`, `orders/moves.rs` | unsupported-stops | 끝까지 실행됨 |
| HUNT_188329 | 가축 사냥 통지(0x202, 0x265/클래스 58)의 3단계 탐색(R2-D8b: 시체를 내려놓을 곳 기준, 시체를 유닛 기준, 아무 상태) | `unit_ai/update.rs` `hunter_search`, `unit_ai/side.rs`·`unit_ai/world_view/side.rs` `closest_from`·`object_box` | carcass-search-case-302s (findings 38) | 518470161 302.4초 사례(`J_v_hunt`, 보유 비트 일치) |
| ESCAPE_188329 (2026-11-12부터 기본으로 켬) | 시작 노드 탈출 접점: 원 위(`d2 <= rr2`, 0x107f529) 포함, 무시된 도형의 접점도 둠 | `pathing/short_path/{mod,start}.rs` `escape_contacts` | escape-contact-case-215s (findings 37) | 518470161 215.4초 경로 일치(`J_v_esc`). 처음엔 뒤쪽 세 곳을 앞당겨 껐다가, 13.3의 판정 규칙 변경(2026-11-12)으로 켬: 세 리플 선수별 첫 어긋남을 앞당기지 않음(`J_f_*` 대 `J_c_*`, 2.1) |
| FORMING_188329 (2026-11-12부터 기본으로 켬) | 그룹 형성(P20 F1~F9): 형성 필드, 새 이동의 0xc000, 가까운 멤버 수와 ×0.5/×0.8333 상한, 0.8125 앞섬(movePositionToFront 꼬리), 속도 패스와 공유 예산, steer 속도, formed, 자기 이동 1.2배 | `groups/{mod,command,order,stats,place}.rs`, `groups/formation/column_line.rs`, `groups/update/awake.rs`, `groups/steer/{to_slots,slot_steps}.rs`, `movement/step.rs`, oracle `groups.rs` | group-forming-lead-case-228s (findings 39) | 517426097 228.5초 네 점 비트 일치(`J_v_f5`). 처음엔 518239882 P2 50 넘게를 1.7초 앞당겨 껐다가, 13.3의 판정 규칙 변경(2026-11-12)으로 켬(`J_f_*`, 2.1) |
| FORMING_FIRSTGAP_188329 / FORMING_FIRSTPLAN_188329 (켜지 않음) | 첫 속도 패스의 간격을 한 걸음 뒤에서(P20 4절 1번, 추정) / 첫 갱신의 두 움직임은 계획만(F10) | `groups/steer/to_slots.rs` / `groups/update/awake.rs` | findings 39 | 켜면 228.5초 사례가 2~4 / 5~65 ulp 어긋남 |
| MASTERHP_188329 (2026-11-12부터 기본) | 마스터가 바뀔 때 체력 = 옛 체력 / 옛 최대 × 새 최대를 1과 새 최대 사이로 자른 **float 그대로**(정수로 자르지 않음, 0x1266ccc~0x1266d3d). 손상 그림 검사(0x12429c0)는 새 마스터에 손상 그림이 있고, 비율이 바뀌고 100 미만이며, 고르는 단계(퍼센트가 비율보다 작은 마지막 항목)가 달라질 때만 멈춤 | `orders/actions.rs` `switch_master` | masterhp-case-560s (findings 40) | 518470161 560.7초 문 10486(793 → 794, 체력 204.99872) 통과, 세 리플 첫 어긋남·자원 수치 그대로(`K_m_*`) |
| GARRISON_RECORD_188329 (2026-11-12부터 기본) | 주민(클래스 4)이 직접 이동 명령을 받으면 종 대피 표시(`+0x664`)를 끈다(0x12cbca0, 0x12cbd3e). 일하러 돌아가기에서 두 기록 모두 대상이 없을 때 둘째 기록을 쓰는 조건 추가(0x12b6a26~0x12b6a9e) | `orders/moves.rs` `move_unit`, `orders/town_bell.rs` `TownBell::back_to_work` | garrison-record-case-233.9s (findings 41) | 517426097 P1 3824 사례, word 7 262.9 → 282.4초(`K_g_097`). 둘째 조건은 사례 없음(읽음, 실행으로 확인 안 됨) |
| HUNT_188329 | 멧돼지(클래스 10) 사냥도 대상이 없어지면 탐색 상태 3으로(통지 0x202, 10초마다 다시), 그 통지의 탐색은 종류 5(0xbb65b0, 0xbb4aec, 0xcf9c95) | `gathering/hunt/unit.rs` `hunt_search_state`, `unit_ai/update.rs` `hunter_search` | boar-search-state-case-393s (findings 42) | 518239882 P2 word 9 398.8 → 497.0초(`K_h_239`) |
| RESSEARCH_188329 (2026-11-12부터 기본) | 자원 탐색 0xd23bf0 → 0xd19f60 전체: 일꾼 수 제한 없음, 자리 = (지금 대상이면 1) − 일꾼 수 + 빈 옆칸 수(0xd1ad39, 0xd1c390), 씨앗을 유닛 칸 기준 거리로 한 번 정렬 후 FIFO, 꺼낸 칸의 이웃을 평가, 30번 검사 한도, 내려놓는 곳 갈래(발자국 씨앗, 범위 = 그 건물 시야 + 10, 못 찾으면 유닛 칸에서 시야 + 5), 지금 대상 갈래 0x107af40, 도달 검사 범위 0.1 | `gathering/gather_search.rs` `closest_resource_at_188329`·`pass_188329`·`reach_range`, `gathering/closest_resource.rs` `closest_resource_of`, `orders/start_work.rs` | resource-search-case-407s (findings 43) | 518470161 10444 사례 비트 일치(`IMP_c1`: 4088 표본, 다른 개체 0), 세 리플 전부 크게 늦춰짐(`IMP_r1_*`). 안 넣은 것: per-side 0xff(slot 0x528), min_state < 2 탐색(손수레)은 옛 길 |
| EXPLORE_WAIT_188329 (2026-11-12부터 기본) | Explore 액션: `set_state(3)`은 스프라이트만, 통지 0x202는 다음 갱신에(0xb794d0, `+0x44 = 1.0`, 상태 2), 상태 2는 갱신마다 0.1씩 줄이다 다 쓰면 다시 물음(0xb7951b) | `movement/explore.rs`(`wait` 필드, `set_state`, `update`), oracle `top_actions.rs` | explore-wait-case-282s (findings 44) | 517426097 정찰병 2976 비트 일치(`IMP2_a1`: 1105 개체 중 다른 것 0) |
| PATROLRANGE_188329 (2026-11-12부터 기본) | 병사 AI CanAttack(0xcf7740)의 방어 태세 갈래: 범위 = max(사거리, 0.5) + 5, 공격 이동·순환 순찰이면 유닛의 맨 위 경로까지 거리(slot 0x4a8 = 0x1210e30), 저장된 순찰이 있으면 그 선분들까지 거리(0x106efd0, NaN은 최소를 안 바꿈), 아니면 간격 제곱 | `unit_ai/attack_pick.rs` `stance_reaches_on`, `attack_rules.rs` `patrol_distance`, `idle.rs`, `world_view/{world_picker,unit_view}.rs` | patrol-range-stop (findings 45) | 518239882가 36,702에서 안 멈추고 끝까지. 원본 기록이 없는 구간이라 값 비교는 못 함. 공성 AI의 같은 멈춤은 그대로 |
| HELPCALL_188329 (2026-11-12부터 기본) | 도움 요청(0xd1d2e0): 조건을 통과한 모든 도우미가 답함 — 타일 플래너 도달 검사(0x1116d20), bestUnitToAttack(0xd1ec40), 0.9 규칙(더 가까운 적이 있으면 그쪽), AttackObject(대상, 1, 0, 1); 클래스 66·67 제외; 그룹 멤버는 그룹이 쉬는 중일 때만 | `unit_ai/world_view/side.rs` `call_for_help_188329`·`help_candidate`·`plan_reaches`, `unit_ai/flight.rs` `answer_help`, `movement/new_path.rs` `Mover::plan_reaches` | help-call-stop (findings 46) | 517426097가 61,100에서 안 멈춤. 원본과 같은 시각 비교는 못 함(그 앞에서 이미 조금 갈림) |
| PLANCHOICE_188329 (2026-11-12부터 기본) | 타일 플래너 마지막 선택(0x1057ea9~0x1057fa7): 층 경로 끝이 목표에서 `max(범위², 1) + 반지름 합` 안이면 길이 비교, 아니면 타일 경로 끝이 그 안일 때만 타일 경로 | `pathing/tile_path/planning.rs` `Planner::plan` | plan-choice-case-571s (findings 47) | 세 리플 첫 어긋남 늦춰짐(`L_p_*`). 사례(518239882 주민 3416)를 개체 추적으로 다시 보지는 않음 |
| GATHER_SNAP_188329 (2026-11-13부터 기본) | Gather `set_state(6)`(0xb7e500 case 6, 0xb7f773~0xb7f78d → 0x1116f60): 대상 클래스 8·32·15(돌·금·나무)이고 유닛과 대상의 타일(좌표 정수부)이 한 축에서만 다르면 그 축 좌표 = 대상 좌표 − (유닛 반지름 + 대상 반지름) × 타일 차이. Hunt 쪽(15번)과 같은 함수를 같이 쓴다 | `gathering/mod.rs` `snap_to_resource`(공용), `gathering/gather/work.rs` `set_face`, `gathering/hunt/gathering.rs` | gather-snap-case-535s (findings 49) | 517426097 금광부 3880 x 비트 `41f1999a`(update 40770, 원본과 같음; `M2_t_097`), P2 word 7 535.9 → 711.4초 |
| (스위치 없음) Fly keep-away | 뱀(마스터 2592)의 Fly(0xb76030 상태 3): 지형·피하기 검사를 12번 시도 루프 안으로, work_value_2 = 추적기 원시 키(109 = 마을 회관 완료 목록), 범위 안의 점은 거절(뱀이 이미 범위 안이고 점이 더 가깝지 않으면 허용), 받아들인 점에서 애니 속도 = 속도 × work_value_1 | `movement/fly.rs` `choose`·`keep_away`·`kept_away`, `players/tracker.rs` `ListKey::raw` | fly-keepaway (findings 50) | 516956894가 update 2에서 안 멈추고 64,092까지. 원본 기록이 없어 뱀 위치 비교는 못 함 |
| (스위치 없음) 덤 자원 작업 164 | 문명 보너스가 채집 일꾼 마스터에 붙이는 작업 유형 164(0x12b71f0 표, 0x113e4d0): 짐이 늘 때마다 `(늘어난 양 × work_val1) × 선수 속성(+0x22)`를 유닛의 덤 목록에 쌓고(대상 마스터 / 대상 클래스 + 900 / −1이 맞는 작업만), 내려놓을 때 짐 다음에 덤을 선수에게 준 뒤 비운다. 짐 종류가 바뀌어 짐이 0이 될 때도 비운다. 작업은 기록의 저장된 마스터에 이미 들어 있다(XS 표 불필요) | `gathering/extra.rs`(새 파일), `objects/unit/mod.rs` `Unit::extra`, `gathering/hunt/gathering.rs`·`gathering/gather/work.rs`(쌓기·비우기), `hunt/hunter.rs`·`gather/unit.rs`·`garrison/unit.rs` `enter_building`·`construction/build/states.rs` `drop_load`(주기) | additional-resource-task164 (findings 51) | 519686090 P1 word 1이 99.9~132.4초 여섯 체크포인트에서 기록과 같음(502, 513, 513, 513, 523, 593), 첫 어긋남 99.9 → 379.4초. 나머지 다섯 리플 stderr 동일 |
| FARMSPOT_188329 (2026-11-13부터 기본) | Gather `set_state(4)`의 농장 자리 뽑기(0xb7edb0~0xb7ee3b): x, y를 한 번씩 뽑아 ok()(0xb7aa90)를 통과한 첫 후보를 쓴다. "지금 자리와 같으면 다시 뽑기"는 원본에 없다(같은 타일이 뽑히면 제자리에서 4 update 쉬고 계속 일함) | `gathering/gather/start.rs` `stop_point`, `farmspot_188329` | farm-stop-case-559s (findings 52) | 517426097 농부 3824: 상태 4가 update 42822·43188·43554, 첫 증가 42826(2.5010827), 43554의 보유량 `8d1ed540`(원본과 같음; `M4_t1`). 세 리플 첫 어긋남 늦춰짐. ok()는 항상 참으로 둠(미구현) |
| MOVEEND_188329 (2026-11-13부터 기본) | 그룹 이동 갱신(0x110d3a0~0x110d5d9)의 끝: 188329에는 AutomaticMoveUnitsToDesiredPositions가 없다. 서 있는 그룹은 자리에 못 간 칸(상태 3 아님)마다 그 멤버의 실패 수가 3 이상이고, 어느 멤버도 유닛 AI의 현재 명령이 없을 때만 끝난다(명령 = −1). 따라가는 그룹의 거리 기준은 (0.5 × 선두의 시야)²보다 클 때(초과) | `groups/update/moves.rs` `move_update_188329`, `groups/mod.rs` `moveend_188329` | group-move-end (findings 53) | 516956894·519686090이 그 멈춤 없이 75,000까지. 여섯 리플 첫 어긋남 그대로. 원본 기록과 값 비교는 못 함(첫 어긋남 뒤의 일) |

"근거" 열의 문서는 모두 이 폴더의 `original-188329-*.md`이다. 사례 문서는 주소와 손 계산까지 들어 있다.

### 12.3 실행과 비교 (PC, PowerShell)

```
$d="$env:USERPROFILE\genie-replays"
# 빌드만 (약 3분; 끝은 build7.err의 "Finished"로 확인. census가 돌고 있으면 exe를 못 덮어써서 실패하니 먼저 Stop-Process -Name census)
powershell -File $d\runs\steer.ps1
# 실행: 이름, 갱신 수(기본 41600 = 기준 리플 끝까지; 다른 리플은 200000), 추가 환경변수, -Replay <리플 폴더 번호>(기본 518239882)
$a='GENIE_EXPERIMENT_AI_ORDER_188329=1;GENIE_EXPERIMENT_EVADE_188329=1;GENIE_EXPERIMENT_WALK_188329=1;GENIE_EXPERIMENT_HUNT_188329=1;GENIE_EXPERIMENT_UNLOAD_188329=1;GENIE_EXPERIMENT_MOVETO_188329=1;GENIE_EXPERIMENT_CORNER_188329=1;GENIE_EXPERIMENT_REWALK_188329=1;GENIE_EXPERIMENT_GRAZE_188329=1;GENIE_EXPERIMENT_BACKWORK_IGNORE_188329=1;GENIE_EXPERIMENT_TASKARGS_188329=1;GENIE_EXPERIMENT_IGNORELIST_188329=1;GENIE_EXPERIMENT_ESCAPE_188329=1;GENIE_EXPERIMENT_FORMING_188329=1;GENIE_EXPERIMENT_MASTERHP_188329=1;GENIE_EXPERIMENT_GARRISON_RECORD_188329=1;GENIE_EXPERIMENT_RESSEARCH_188329=1;GENIE_EXPERIMENT_EXPLORE_WAIT_188329=1;GENIE_EXPERIMENT_PATROLRANGE_188329=1;GENIE_EXPERIMENT_HELPCALL_188329=1;GENIE_EXPERIMENT_PLANCHOICE_188329=1;GENIE_EXPERIMENT_GATHER_SNAP_188329=1;GENIE_EXPERIMENT_FARMSPOT_188329=1;GENIE_EXPERIMENT_MOVEEND_188329=1'   # 같은 줄이 runs\M4_envs.txt 에 있다 (여섯 리플을 한 번에: powershell -File $d\runs\M4_launch.ps1 -Prefix <접두어> -EnvFile M4_envs.txt -Extra 'GENIE_TRACE_RES=1'; 비교 python3 runs/M4_cmp.py M4 <접두어>)
# 기본에 없는 시험 스위치(필요할 때 $a 뒤에 붙인다): GENIE_EXPERIMENT_FORMING_FIRSTGAP_188329=1, GENIE_EXPERIMENT_FORMING_FIRSTPLAN_188329=1 (39번, FORMING 위). ESCAPE·FORMING은 2026-11-12부터 기본(13.3 판정 규칙). 그룹 형성 추적은 GENIE_TRACE_FORMING=1
powershell -File $d\runs\go.ps1 -Name fX -Envs "$a;GENIE_TRACE_RES=1"                       # 전체, 자원 추적 (약 3분)
powershell -File $d\runs\go.ps1 -Name pX -Updates 14700 -Envs "$a;GENIE_TRACE_OBJECTS_RANGE=14540-14700"   # 그 갱신 구간의 개체 추적
```

출력은 `runs\<이름>.out/.err/.done`. 비교(리눅스 셸, 작업 폴더 = genie-replays):

| 도구 | 하는 일 |
|---|---|
| `runs/summ.sh <이름>` | 멈춘 이유, 체크포인트 단어별 첫 불일치 시각, 자원 채점 요약 |
| `python3 runs/cmp_pos.py runs/<이름>.err` | 개체별 첫 위치 불일치(비트 비교). 원본 표본 시각과 같은 ms만 비교 |
| `python3 runs/cmp_held.py runs/<이름>.err` | 개체별 첫 보유량·상태 불일치(3표본 연속일 때만) |
| `python3 runs/cmp_spawn.py` | 생성 위치 비교(`runs/sp.err` 기준) |
| `python3 runs/grade_res.py <err> --truth-dir truth/analysis --out <폴더>` | 자원 채점 원본 |

추적 환경변수: `GENIE_TRACE_RES`(자원), `GENIE_TRACE_OBJECTS_RANGE=a-b`(OBJECT 줄: ms, tick, id, held, state, master, position, action_kind, action_state), `GENIE_TRACE_STEER_RANGE=a-b`(그 구간만 STEER / WALKWP / SHORTPATH / IGNORE 줄), `GENIE_TRACE_SPAWN`(SPAWNSITE / SPAWNPATH / SPAWNCAND / SPAWN188329).

속도: 개체 추적은 느리다(1,000 갱신에 6~8분). 넓게 보려면 체크포인트 단어로 구간을 먼저 좁히고, 그 구간만 추적한다. 갱신 번호 ↔ 시각: 6234 = 98.2초, 9044 = 175.3초, 11080 = 232.1초, 14552 = 330.1초, 16857 = 394.8초 (틱 길이가 13~28 ms로 변한다).

### 12.4 한 사례를 푸는 순서 (실제로 통한 방법)

1. `summ.sh`로 가장 이른 단어 불일치 시각을 본다. 그 앞 구간을 `GENIE_TRACE_OBJECTS_RANGE`로 추적해 `cmp_pos.py` / `cmp_held.py`로 첫 개체와 시각을 찾는다.
2. 그 개체의 원본 표본(`truth4.jsonl`)과 엔진 줄을 나란히 뽑아 증상을 한 문장으로 만든다(예: "경로 끝점이 다르다", "4틱 덜 멈춘다").
3. 원본 코드에서 **그 사례만** 읽는다. 사실(좌표, 시각, 갱신 번호, 엔진 추적 파일 위치)을 다 적어 주고, "원본 코드로 이 숫자를 재현하고 엔진에 넣을 정확한 변경을 달라"고 한다. 프롬프트 원문 9개가 PC `re-kit\re-focused-cases-v1.tar.gz`의 `focused_prompts/`에 있다(그대로 본떠 쓰면 된다). 결과물은 같은 묶음의 `out_p1..out_p9`, `out_u1`.
4. 변경을 스위치 뒤에 넣고 빌드 → 전체 실행(`f*`) → 숫자가 늘었는지 확인 → findings에 기록 → 패치 갱신 → 커밋·푸시.

배운 것:
- 내 추측으로 고치면 대부분 틀렸다(155초 "한 걸음 일찍 멈춤", 232초 내보내기 분기, 330초 충돌 모양 시점 — 셋 다 원본을 읽으니 다른 원인이었다). **추측으로 넣지 말고 읽어서 넣는다.**
- 서 있는 유닛의 타이밍 차이는 위치로 안 보인다. 보유량 비교를 같이 쓴다.
- 원본 메모리 기록에는 틱 중간에 읽힌 깨진 표본이 1초에 한 번꼴로 있다. 한 표본만 다른 것은 무시한다.
- 고친 뒤 뒤쪽 숫자가 나빠 보이면 먼저 엔진이 어디서 멈췄는지(`.out` 마지막 세 줄)를 본다.
- PC로 파일을 보낼 때(`device_commit_files`) 같은 경로를 다시 쓰면 예전 내용이 갈 수 있다. 매번 새 파일 이름으로 올린다.

### 12.5 미해결 (이른 순)

0. (세 리플, 2026-11-13, 실행 `M4_p_*` = 지금 기본 27개) 가장 이른 것부터. 선수별 첫 어긋남(13.3): 518239882 P2 696.6초, 518470161 P2 710.7초, 518239882 P1 710.6초, 517426097 P1·P2 795.9초, 518470161 P1 822.0초. 연구 밖 리플(원본 기록 없음): 519700670 P2 21.9초(체크포인트 하나만)·P1 340.4초, 519686090 P1 379.4초·P2 411.9초, 516956894 P1 639.4초·P2 684.9초.
   - 518239882 P2 word 7 696.6초(update 27,499 체크포인트: 기록 726311 / 엔진 725929), word 9 710.6초, 자원 716.0초(나무 −10.1); P1 word 7·9 710.6초(update 27,999), 자원 718.4초(식량 −10): 미조사. 다음 첫 동작: `go.ps1 -Name <이름> -Updates 27500 -Envs "<M4_envs.txt 한 줄>;GENIE_TRACE_OBJECTS_RANGE=27000-27500"` → `TRUTH=truth/truth4.jsonl python3 runs/cmp_pos.py`·`cmp_held.py`로 P2의 첫 유닛을 찾는다.
   - 518470161 P2 word 7 710.7초(update 54,499 체크포인트: 295312 / 295310), word 4 769.2초, 자원 756.4초(나무 −10): 미조사. 다음 첫 동작: 같은 방법으로 update 54,000~54,500 추적(`-Replay 518470161`, `TRUTH=truth/truth5.jsonl`). **그 전의 493.8초 사례(findings 48)는 절반만 풀린 채 PLANCHOICE로 밀려났다**: 주민 9383과 나무꾼 10428이 마주쳐 멈춘 뒤(update 37645) 원본은 37653에 내려놓기 무시 규칙(0x120ee10)이 주변 유닛 넷을 무시하게 해 바로 지나가고 엔진은 한 번 더 멈춘다. 확인된 차이 D1: 그 규칙의 질의 범위가 원본 `반지름 × 4 + 0.1`, 엔진 `반지름 + range_floor`(`movement/new_path.rs:230` `ignore_list`) — **안 넣음**(D1만으로는 사례가 안 움직임; 나머지 절반은 엔진의 `start_blocked`가 왜 "막힘"이 아닌지, 추정). 문서 `original-188329-dropoff-ignore-case-491s.md`. 지금 기본에서 이 유닛들이 여전히 다른지는 확인 안 함.
   - 517426097 P1 word 7·9와 P2 word 7이 같은 체크포인트 795.9초(update 60,999: P1 852116 / 852150, P2 532281 / 532300), 자원도 둘 다 803.3초(식량 +10): 미조사. 두 선수가 같은 시각이라 만남·전투일 수 있다(추정). 다음 첫 동작: update 60,500~61,000 추적(`-Replay 517426097`, `TRUTH=truth/truth6.jsonl`).
   - 518470161 P1 word 10(ID 합) 822.0초 하나만 어긋난다(429690 / 429689; 다른 단어와 자원은 978초까지 같음): 미조사. 개체 하나의 id가 1 다른 것으로 보인다(추정).
   - 519686090(51번 뒤, 실행 `M3_n_090`): P1 379.353초 체크포인트 하나에서 word 1(기록 891 / 엔진 879), word 2(15222 / 14752, 차이 470 = 마스터 592 − 122), word 4, word 9가 같이 어긋나고 다음 체크포인트부터는 word 7만 어긋난다. 추정(안 읽음, 추적 안 함): 여자 사냥꾼(122) 하나가 원본에서는 379.35초 전에 고기를 내려놓고 양치기(592)가 됐는데 엔진은 0.5초쯤 늦다(엔진의 식량 입금: 378.846초 10.78, 379.002초 13.6, **379.860초 15.69**). 다음 첫 동작: `go.ps1 -Name <이름> -Replay 519686090 -Updates 29050 -Envs "<M2_envs.txt 한 줄>;GENIE_TRACE_OBJECTS_RANGE=28700-29050"`로 master 122 유닛들의 보유량·상태를 보고 늦는 유닛을 고른다(update 28499 = 372.853초, 28999 = 379.353초; 원본 기록이 없어 엔진 쪽만 보임). P2 word 7 411.9초는 미조사.
   - 516956894(52·53번 뒤, 실행 `M4_n_894`): P1 639.4초(update 48,999 체크포인트: word 1 880 / 890, word 4 399 / 389, word 7, word 9), P2 word 7 684.9초. 멈추지 않음(75,000까지). 미조사. 원본 기록이 없으니 체크포인트로만 좁힌다(word 1과 4가 10씩 반대로 다르다 = 자원 10을 내려놓는 시각이 한 체크포인트 다르다, 추정).
   - 52번에서 읽고 안 넣은 것: 농장 자리 ok()(0xb7aa90: 유닛에서 16 넘게 멀면 참, 아니면 점 도달 검사 0x120fec0 → 0x107a5e0, 범위 16.0)는 항상 참으로 뒀다. 엔진에 같은 검사가 있지만(`movement/path_end.rs` `Mover::reach_length`) `GatherAction::set_walk`에는 세계가 안 넘어온다. 10번 다 실패한 뒤의 대안(직전 자리 → 농장 중심 → 유닛 자리, 0xb7ee41~)도 안 넣었다. 원본 기록에서 같은 타일이 뽑힌 비율이 12~14%로 9칸 균등(11.1%)보다 조금 높은 이유는 모른다.
   - 53번에서 안 본 것: 공격 쪽의 같은 종류 멈춤("AutomaticMoveUnitsToDesiredPositions' attack on the target", `moves.rs` `move_to_desired_positions`를 부르는 공격 갱신 0x110be80)은 원본을 안 읽었다. 선두의 시야(slot 0x228 = 0x1245c70)는 원본에서 마스터 값(+0x70)에 유닛별 보정 목록(종류 1)을 적용한 값인데 엔진은 마스터 값만 쓴다.
   - 해결(findings 41~47, 49, 50, 52, 53): 위 2.1의 변화 문단 참고. 49번에서 읽었지만 안 넣은 것: Gather `set_state(6)`의 광산 대각선 재선정(대상 클래스 8·32이고 두 축 모두 타일이 다르면 직교 이웃 타일에서 일꾼이 가장 많은 자원으로 대상을 바꿈; 0xb7f76f 앞, 0xd28770·0xb7b960·상수 `[0x31fe7cc]`는 안 읽음 — 사례가 나오면 `gather/work.rs` `set_face`의 스냅 앞에 넣는다).
   - 첫 어긋남 뒤에서 앞당겨진 것(13.3 규칙으로 판정을 막지 않지만 자원 정확도에는 중요): ESCAPE로 518239882 P2 자원 50 넘게 767.1 → 691.8초, 900초 P2 식량 −249.7 → −439.7; 517426097 P2 word 10 620.4 → 542.4초(멈춤도 73,336 → 70,196). FORMING 단독으로는 518239882 P2 50 넘게 767.1 → 765.4초(두 실행 RES가 처음 갈리는 곳 716.861초 P1 식량 +10). 다음 첫 동작: D2(무시 도형 접점 유지)만 끈 임시 실행으로 ESCAPE 쪽 원인을 가른 뒤, 517426097 P2 word 10(542.4초) 앞 구간을 `J_f_097` 대 `J_c_097` 개체 추적으로 비교.
   - 엔진 멈춤(`L_p_*`, 지금 기본 24개): **세 리플 모두 돌린 구간에서 멈추지 않는다**(518239882는 리플 끝 41,600까지, 나머지 둘은 75,000까지만 돌림 — 그 뒤는 안 돌려 봄). 없어진 멈춤: 518239882 36,702 순찰 범위(45번), 517426097 61,100 도움 요청(46번), 517426097 73,686 "a pather query meeting a gate"(47번 뒤 그 상황이 안 생김; 구현한 것이 아님). 아직 구현 안 된 멈춤 문구(다른 리플에서 다시 나올 수 있음): "a horde's command (commandHorde)", "a builder with no task for its foundation", "a pather query meeting a gate (slot 0x678)", 공성 AI의 순찰 범위, 손상 그림 단계 변경(40번), 탑 같은 못 움직이는 도우미(46번).
     - 해결(findings 40, `MASTERHP`): 518470161 P1 42,960 "a master change that changes the damage sprites"는 화면용이 아니라 **체력 계산 차이**였다(원본은 마스터가 바뀔 때 체력을 정수로 자르지 않음). 원본 손상 그림 검사 0x12429c0(CheckDamageSprites)은 통째로 건너뛰면 안 된다: 단계가 바뀌면 모드 1 항목은 Object 난수(0x144354d90)를 두 번 뽑고 모드 2는 스프라이트를 바꾸며(스프라이트 난수), 항상 체력을 0~최대로 자르고 비율 바이트(+0xd)를 쓴다. 단계가 그대로면 아무 일도 없다. **남은 일(읽음, 미구현)**: 원본은 이 검사를 상태 2 개체의 매 갱신(0x12488e0, 0x1248b56)에서 부른다. 엔진은 업그레이드 경로(`technology/upgrade.rs` `damage_sprites_at`)에서만 부르므로, 전투로 건물 체력이 단계(25/50/75%)를 넘을 때 모드 1 항목의 Object 난수 두 번을 뽑지 않는다(건물이 맞는 구간에서 난수가 밀릴 수 있음; 사례는 아직 없음). 마스터 변경으로 단계가 실제로 바뀌는 경우는 여전히 멈춘다(같은 오류 문구).
   - 해결되어 지운 것: 518470161 P2 216.7초(word 7·9)와 P2 자원 218.5초, 양치기 9381의 내려놓기 경로(37번 `ESCAPE`, 2026-11-12 기본으로 켬). 517426097 P1 230.4초 정찰병 2976의 그룹 형성 속도(39번 `FORMING`, 2026-11-12 기본으로 켬). 518470161 P1 307.7초 양치기 10406의 시체 대신 산 양(38번). 518470161 215.4초 시작 노드 손 계산(37번). 517426097 230.4초 형성 초기화·+0x178 읽기(39번).
1. (기준 리플) Gaia 동물 마스터 2095(말, 클래스 9) **id 4285 한 마리만**: 186.6초부터 원본에서만 도망간다(정찰병 3428이 지나갈 때). 4283은 위치 일치, 4284는 양쪽 다 정지(예전의 "4283~4285 전체"는 틀린 기록). 식량 없는 동물이라 자원 영향 없음. 186.381초의 4285·3428 위치, retarget=1244, look=672는 원본과 일치. 원본 idle은 검색이 대상을 찾으면 0xd26200(도망)을 부르는데, 엔진에서 타이머 때문에 검색을 안 하는지 검색이 실패하는지 아직 못 갈랐다. 문서 `original-188329-animal-case-186s.md`, findings 26. 다음 첫 동작: 지금 빌드(진단 출력 포함, 13.4)로 `go.ps1 -Name p27 -Updates 9480 -Envs "$a;GENIE_TRACE_OBJECTS_RANGE=9430-9480;GENIE_TRACE_OBJECT_IDS=4283,4284,4285,3428;GENIE_TRACE_ANIMAL=1"` → ANIMAL_SEARCH / ANIMAL_EVADE 줄에서 4285의 검색 결과와 타이머를 본다.
2. 383.4초 P1 나무꾼 4371(그리고 4363)(IGNORELIST를 켜도 518239882 출력이 바이트 동일이라 세션 B의 S4 후보는 아님): 벌목소로 가는 짧은 경로 모양이 다르다(원본은 y = 45.1211을 따라 동쪽으로 간 뒤 꺾음). 도착 시각은 같다. 짧은 경로 사례로 넘길 만하다.
3. 411.2초 P1 나무 −10: p25에서 4371의 선행 채집 지연을 확인(25번). 복귀 후 약 0.0546 차이가 연속 유지됨. 4363도 약 0.098276 차이. 다음 첫 동작: update 약 16350~16600을 추적해 383.4초 전후의 이전 왕복부터 비교. 450.9초 P2는 미조사.
4. 엔진 멈춤(518239882, 옛 기본 `J_c_239` 기준; 새 기본 `J_f_239`는 41,256 P1 "a horde's command"로 바뀜): update 36,452 "a helper that answers a call for help (its reach, bestUnitToAttack and AttackObject)"(TASKARGS 없이는 36,479). 그 앞 실행에서는 41,256 "a horde's command (commandHorde)". 22번과 같은 방식(원본 동작을 읽어 오류를 대체)으로 처리. 세션 B의 추정(S1): 엔진은 그룹 병사의 재타겟을 잘못 꺼서 대상이 죽은 뒤 놀게 되고 이 멈춤 조건(`unit_ai/world_view/side.rs:192` `helper_free`)에 걸린다. TASKARGS를 켜도 멈춤은 그대로(27 update 일찍)라 이 추정만으로는 설명이 안 된다.
5. 읽기에서 확정했지만 아직 안 넣은 것(사례가 나오면 넣는다): 채집 N1(자원 탐색 `0xd23bf0` 전체), N2(0.25초 재선정), N4(광산 교체); 농장 D1(자리 뽑기), D2(삭제된 농장) + 삭제 명령 0x83; 건설 C2, C4; 가축 3단계 탐색의 AI 통지 쪽(R2-D8b); 사슴 도망의 지도 경계 자르기·두 번째 목표·4방향; 걷기 D2, D3, D5, D7, D8; 길찾기 최종 선택 R16-D1; 죽을 때 애니 속도 0(R13-D1); 연구·비용 R8 D1~D7; 작업 시작 붙이기의 Gather(유형 5) 쪽. 세션 B에서 확정했지만 안 넣은 것: AI가 사라진 대상(자원 종류 없는 클래스)에 내린 명령은 원본이 대상 검색 0xd22c20 뒤 그 결과에 작업(0xd37eed~0xd37f31), 엔진은 NotTaken(`unit_ai/order_kinds.rs` `order_on_target`). 장애물 관리자 목록이 복사가 아니라 포인터인 점(S5)과 엔진에 대응이 없는 목록 설정자들(S6, 주소는 확인 문서 4절). 0x16f4ba0이 클래스 0x15·0x42도 모으는 점(엔진은 클래스 4와 master 1808만). 세션 K(P22, 읽음·사례 없음): 0x12baa00과 대피 명령 0xf52720도 클래스 0x15·0x42를 받는 점, 대피 명령이 클래스 0x15를 주둔 비트 0x40 건물로 보내는 점, 종 표시가 주둔 종류 비트 0 **또는 비트 6**에서 켜지는 점(엔진은 VILLAGERS만), 들어간 뒤의 0x12c78e8 호출. `+0x664`를 쓰는 안 읽은 곳 다섯(0x12a5321, 0x12a582f, 0x12d42db, 0x12d8604, 0x1344c1). 매 갱신 손상 그림 검사 0x1248b56(findings 40).
6. 다른 리플 검증을 한 번도 안 했다. PC `genie-replays\`에 리플 폴더가 여러 개 있다(515741992, 516293031, 516495787, 516746960, 516956894, 517426097, 518470161, 519686090, 519700670). 원본 기록이 없어도 체크포인트 단어로는 비교할 수 있다: 같은 스위치로 돌려 단어별 첫 불일치가 기준 리플과 비슷하게 늦어지는지 본다.
7. 제품화: 스레드 로컬 지름길 두 개(`CLOSEST_FROM`, `SPAWN_PATH`)를 정식 인자로 바꾸고, 스위치들을 "빌드 188329" 한 설정으로 묶는다. 분석기 출력(실제 수입, 동물별 먹은 양, "어디까지 검증됨" 줄)은 아직 손대지 않았다.

### 12.6 원본 기록을 다시 뜰 때

`truth\truthlog5.ps1`(2026-11-11 실제 기록 성공): v4에 더해 경로 상태·웨이포인트를 끝까지, 유닛 AI의 명령·액션·대상(`ai+0x38..0x50`), 맨 앞 액션 노드와 객체(`obj+0x420` → `list+0x10`)를 기록한다. `-DenseUntilMs`까지는 매 틱, 그 뒤는 200 ms 간격. 리플을 낮은 배속으로 재생하면서 `powershell -File truth\truthlog5.ps1 -Out truth\truth5.jsonl`. 게임 메모리는 읽기만 하고, 싱글·리플 재생에서만 쓴다(3절).

- **2026-11-11 낮: 두 번째 원본 기록을 떴다.** 리플 **518470161**, 파일 PC `truth\truth5.jsonl` (v5 형식: 12.6절의 추가 항목 포함, 3.1초부터, 처음 120초는 매 틱). 기록 중 확인: 77초 지점에 422MB, 줄 빠짐 없음. 끝난 뒤 `truth\truthlog5.status`에 줄 수와 마지막 시각이 있다. 아직 아무도 분석하지 않았다. 쓸 곳: (1) 같은 스위치 묶음이 다른 리플에서도 맞는지 검증(엔진 실행은 `runs\go.ps1`의 리플 폴더 `518239882`를 `518470161`로 바꾼 사본으로), (2) v5의 AI 명령·액션·맨 앞 액션 객체로 "어느 단계에서 늦는지"를 직접 보기. 비교 도구(`cmp_pos.py`, `cmp_held.py`)는 `truth/truth4.jsonl` 경로가 박혀 있으니 인자로 바꿔 써야 한다. `truth/analysis`의 자원 캐시(`cache_res.csv`)도 이 리플용으로 새로 만들어야 `grade_res.py`를 쓸 수 있다.
- 기록 결과(확인함): 끝난 뒤 status = `lines=12934 last_ms=1200056`. 파일 1,113,185,172바이트(약 1.06GB). 게임 시각 1200초(20분)에서 기록기가 스스로 멈췄다(`-MaxWorldMs` 기본 1200000). **리플 번호는 jsonl 안에 없다.** 아래 목록이 유일한 기록이다.
- **주의: status 파일 이름이 `truthlog5.status`로 고정**이라 다음 기록이 덮어쓴다. 그래서 truth5의 status는 `truth\truth5.status`로 복사해 두었다. 새로 기록한 뒤에도 `truthlog5.status`를 `truthN.status`로 복사한다.
- 기록하는 법(실제로 통한 순서): 게임에서 리플을 열고 시작 직후 일시정지 → PowerShell에서 `powershell -ExecutionPolicy Bypass -File C:\Users\ssapo\genie-replays\truth\truthlog5.ps1 -Out C:\Users\ssapo\genie-replays\truth\truthN.jsonl` → 일시정지 해제. 기록기가 몇 초 늦게 붙어도 괜찮다(truth5는 3.1초부터). 처음 120초는 매 틱이라 1~2배속, 그 뒤는 200ms 간격이라 8배속까지 괜찮다(16배속이면 표본이 빠진다). 정상이면 10초 안에 jsonl 크기가 늘기 시작한다. status에 "wrong build" / "OpenProcess failed"가 나오면 실패. 20분에 약 1GB. `-MaxSeconds`(기본 3600)는 실제 시간 상한이라 1시간 넘게 걸리면 중간에 끝난다.
- **원본 기록 목록 (리플 → 파일)**: 518239882 → `truth4.jsonl`(v4, 0~900초, status `truthlog4.status`) / 518470161 → `truth5.jsonl`(v5, 3.1~1200초, status `truth5.status`) / 517426097 → `truth6.jsonl`(v5, ~1199초, 10,938줄, 624MB, status `truth6.status`, 2026-11-11 14:04 종료). 세 리플 모두 사용자는 ssapo. 새로 기록하면 여기에 한 줄 추가한다. 리플 폴더(맵·문명·선수)는 `genie-replays\<리플번호>\`.

### 12.7 파일 위치 추가분

| 경로 (PC `genie-replays\`) | 내용 |
|---|---|
| `re-kit\re-focused-cases-v1.tar.gz` | 사례별 원본 읽기 결과(out_p1..p9, out_u1)와 프롬프트 원문 |
| `re-kit\re-reading-round2..5.tar.gz` | 구역별 읽기 보고서 원문(out_r1..r17)과 검증표 |
| `runs\go.ps1`, `steer.ps1`, `summ.sh`, `cmp_*.py` | 12.3절의 도구(저장소 `tools/`에도 사본) |
| `truth\truthlog5.ps1` | 12.6절 |
| `re-kit\case25-evidence.zip` | 25번 대응 표본과 비교 도구(새 디컴파일 없음) |
| `runs\p26.err`, `p26a.err`, `p26paths.err` | 186초 동물 사례 추적(update 9430~9480). ANIMAL 진단 추가 전 빌드 |
| `truth\truth5.jsonl`, `truth\truth5.status` | 리플 518470161 원본 기록(12.6) |
| `truth\analysis5\`, `truth\analysis6\` | truth5/6의 자원·개체 캐시(`runs/extract_truth.py <jsonl> <폴더>`로 만듦, Windows python으로 수 초) |
| `runs\summ2.sh`, `runs\extract_truth.py` | 리플별 채점(`summ2.sh <이름> <analysis 폴더>`), 캐시 만들기. `cmp_pos.py`·`cmp_held.py`는 환경변수 `TRUTH=<jsonl>`로 기록 파일을 바꾼다 |
| `re-kit\re-focused-case-p10.tar.gz`, `re-kit\re-focused-cases-p11-p12-g1.tar.gz`, `re-kit\re-focused-cases-p13-p15.tar.gz` | findings 27~29의 원본 읽기·손 계산(Python 짧은 경로 포트 `out_p10/sp.py`, `out_p11/sp.py`) |
| `re-kit\re-focused-cases-p16-p18-B.tar.gz` | findings 32~36의 원본 읽기 원문: `out_p16`(166.9초 내보내기 무시 목록, 215.4초 양치기 시작 노드 디컴파일 `start.c`), `out_p17`(멧돼지 idle 0xcfc290 디스어셈블), `out_p18`(사냥 예약 명령, 0xd004a0 디컴파일), `out_B`(작업 인자·무시 목록 확인, 패치 `taskargs_188329*.patch`, `ignorelist_188329*.patch`, 진단 `ignorelist_trace*.patch`; `*_pc.patch`는 PC 줄 끝) |
| `backup-A\`, `backup-I\` | 세션 A(upstream 이식, P16, P18)와 통합 세션 I(작업 인자·무시 목록 패치)가 고치기 전의 엔진 파일 사본(`<상대 경로>`) |
| `patch-2026-11-11-I.patch` | 이번 엔진 패치 사본(저장소 `sorted-lists-and-truth-trace.patch`와 같음) |
| `runs\I_x_*`, `I_t_*`, `I_i_*`, `I_ti_*` | 35·36번 검증 실행(기준 / +TASKARGS / +IGNORELIST / +둘 다). `I_s0_239`, `I_s1_239`: IGNORELIST 꺼짐·켜짐의 STEER 추적(update 2000~2300, IGNORE 줄의 `mgr=`) |
| 엔진 패치 | 저장소 `sorted-lists-and-truth-trace.patch` = PC `genie\`의 `git diff --ignore-cr-at-eol`(기준 `91d81be4`). 다시 만들 때: `cd genie && GIT_OPTIONAL_LOCKS=0 git diff --ignore-cr-at-eol > ../<새이름>.patch` |
| `re-kit\re-focused-cases-p19-p21.tar.gz` | findings 37~39의 원본 읽기 원문: `out_p19`(215.4초 탈출 접점, `esc.py`·`run19.py`·`sp.py`), `out_p20`(228초 그룹 형성 앞섬, 디컴파일 `d1~d9.c`, `sim_p20.py`), `out_p21`(302.4초 시체 탐색, 258.4초 3824 단서) |
| `backup-J\` | 통합 세션 J(37~39번)가 고치기 전의 엔진 파일 사본(`<상대 경로>`) |
| `patch-2026-11-12-J.patch` | 이번 엔진 패치 사본(저장소 `sorted-lists-and-truth-trace.patch`와 같음) |
| `runs\J_*` | 37~39번 실행: 확인 추적 `J_v_esc`, `J_v_hunt`, `J_v_f1`/`J_v_f2`(F10 넣기 전 빌드, FORMING / +FIRSTGAP), `J_v_f1b`·`J_v_f3`(F10 켬), `J_v_f2b`(F10+FIRSTGAP), `J_v_f4`(슬롯 변환 추적), `J_v_f5`/`J_v_f6`(지금 빌드, FORMING / +FIRSTGAP); 전체 `J_es_*`(+ESCAPE), `J_e_*`(+ESCAPE+시체 탐색), `J_f_*`(+FORMING; 2026-11-12부터 이것이 기본), `J_g_*`(+FIRSTGAP), `J_c_*`(새 기본), `J_d_*`(새 기본+FORMING). 요약 `J_sum_<이름>.txt` |
| `runs\J_cmp.py`, `runs\J_f2976.py`, `runs\J_edit.py` | 두 실행 묶음의 선수별 비교(단어별 첫 불일치, 자원 0.01/50, 900초, 멈춤), 정찰병 2976 네 점 비트 비교, 줄 끝을 지키는 소스 편집(저장소 `tools/`에도 사본) |
| `backup-K\` | 세션 K(40번)가 고치기 전의 엔진 파일 사본(`genie\<상대 경로>`)과 문서 사본 |
| `patch-2026-11-12-M.patch` (그 전 `-K`, `-L`) | 이번 엔진 패치 사본(저장소 `sorted-lists-and-truth-trace.patch`와 같음) |
| `runs\K_*` | 40번 실행: 전체 `K_m_*`(지금 기본 18개, `GENIE_TRACE_MASTERHP=1` 포함), 3824 추적 `K_s_097`(update 19900~20060), `K_s2_097`(19300~19700, STEER 19480~19700), `K_s3_097`(17000~18100), `K_b1_097`(`GENIE_TRACE_BELL=1`, update 19450까지); 전체 `K_h_*`(18개 + 42번), `K_g_*`(+GARRISON_RECORD = 지금 기본 19개); 도우미 추적 `P22_1`(517426097, `GENIE_TRACE_COMMANDS=1`), `P23_1`(518239882 update 16490~17010), `P24_1`(518470161 update 30900~31520). 편집 명세 `K_spec1~7.py`(`J_edit.py`용), 기본 스위치 한 줄 `K_envs.txt`, 문서 편집 `K_doc*.py` |
| `runs\IMP_*`, `backup-L\` | 43번 구현: 사례 확인 `IMP_c1`(518470161 update 30900~31520), 전체 `IMP_r1_*`(지금 기본 20개; 518470161·517426097은 update 75,000까지), `IMP_z1_*`(도달 범위 0, 수치 같음), `IMP_off_*`(스위치 끔 = `K_g_*`와 같음); 편집 명세 `IMP_spec1~4.py`; 고치기 전 사본 `backup-L`. 도우미 추적 `P25_1`·`P25_2`(517426097), `P26_1`(518239882), `P27_1`·`P27_2`(517426097). `go_base.ps1` + `census_base.exe`: 구현자가 빌드하는 동안 도우미가 쓰는 얼린 exe(지금은 RESSEARCH 전 빌드; 다시 쓸 때는 새로 복사) |
| `runs\IMP2_*`, `runs\L_*`, `backup-M\` | 44~47번: 사례 `IMP2_a1`(정찰병 2976), `IMP2_c2`(도움 요청); 전체 `IMP2_a_*`(+EXPLORE_WAIT), `IMP2_b_*`(+PATROLRANGE), `IMP2_c_*`(+HELPCALL), `L_p_*`(+PLANCHOICE = 지금 기본 24개), `IMP2_off_239/097`(셋 다 끔 = `IMP_r1`과 바이트 동일); 편집 명세 `IMP2_spec1~13.py`, `K_spec8.py`(PLANCHOICE); 고치기 전 사본 `backup-M`. 도우미 추적 `P28_1`·`P28_2`, `P29_1`·`P29_2`, `P30_1`·`P30_2`, `S1_1`, `S2_1~3`; `runs\P29_scripts\`, `runs\P30_*.py`(도우미가 남긴 재현 스크립트) |
| `runs\M2_*`, `runs\M2_envs.txt`, `runs\P_out\`, `runs\F_out\` | 49·50번: 사례 확인 `M2_t_097`(3880, update 40760~40790), 전체 `M2_a_*`(49번만), `M2_p_239/161/097`(지금 기본 25개), `M2_n_894/090/670`(연구 밖 리플 셋). 스위치 한 줄 `M2_envs.txt`(21개 + GATHER_SNAP; 나머지 셋은 `go.ps1`). 도우미 노트 원본 `P_out\case-535s.md`, `F_out\fly-keepaway.md` |
| `runs\M3_*`, `runs\D_out\` | 51번: 도우미 D의 조사(`D_out\danes-bonus.md`, `verify.py`), 작업 확인 `M3_t1_090`(`GENIE_TRACE_TASK164`·`GENIE_TRACE_EXTRA`, update 9,500까지), 주둔 사례 `M3_t2_090`(update 18,696~18,701 개체 추적 + 명령), 전체 `M3_p_239/161/097`·`M3_n_894/090/670`. `M3_cmp.py`(두 실행 묶음을 원본 기록 없이 비교: 단어별 첫 불일치, stderr 동일 여부, 멈춤), `M3_mkpatch.ps1` + `M3_striplf.py`(패치 다시 만들기; 저장소 `tools/`에도 사본). 패치 사본 `patch-2026-11-13-M3.patch` |
| `runs\M4_*`, `runs\M4_envs.txt`, `runs\W_out\`, `runs\S_out\` | 52·53번: 도우미 W의 농장 자리 조사(`W_out\farm-stop.md`), 도우미 S의 그룹 이동 끝 조사(`S_out\slot-path.md`; 디컴파일은 클라우드 `re/out_S`), 사례 확인 `M4_t1`(517426097 농부 3824, update 42800~43600), 전체 `M4a_*`(52번만), `M4_p_239/161/097`·`M4_n_894/090/670`(= `M4b_*`, 지금 기본 27개, `GENIE_TRACE_RES=1` 포함), 도구 `M4_launch.ps1`(여섯 리플 한 번에), `M4_cmp.py`(13.3 규칙 비교), `M4_doc.py` |
| `re-kit\re-focused-cases-p28-p30-s1-s2.tar.gz` | findings 44~48의 원본 읽기 원문: `out_p28`(Explore 0xb79060~, `sim_p28.py`), `out_p29`(내려놓기 무시 규칙 0x120ee10, q1~q3.c), `out_p30`(타일 플래너 포트 `plan.py`·`grid.py`), `out_s1`(도움 요청 s1~s3.c, `best.txt`), `out_s2`(병사 CanAttack s1·s2.c) |
| `re-kit\re-focused-cases-p25-p27.tar.gz` | P25~P27 보고서(`case_p25.md`~`case_p27.md`, `crs26.py` = 내려놓는 곳 갈래를 더한 자원 탐색 포트) |
| `re-kit\re-focused-cases-k-p22-p24.tar.gz` | findings 40~43의 원본 읽기 원문: `out_k`(k1~k7.c: 0x12429c0, 0x1266b90, 0x1226150, 0x12bacf0, 0x12b6910, 0x12bc7e0, 0x12baa00, 0x16ecf20, 0xd004a0), `out_p22`(주둔·대피 명령 0x16f0680, 이동 0x16ebc20), `out_p23`, `out_p24`(자원 탐색 0xd23bf0·0xd19f60 디컴파일 p1~p3.c, 포트 `crs.py`), `realstart.py`(이어진 .pdata 조각의 진짜 시작 찾기) |


## 13. 일을 끝낼 때 남길 기록 (누가 하든 반드시; 다음 사람이 이것만 보고 바로 시작한다)

다음 사람은 대화 내용을 못 본다. 파일에 없는 것은 없던 일이다. 작업을 멈추기 전에 아래를 **전부** 한다.

### 13.1 사례 하나를 끝낼 때마다 (고쳤든 못 고쳤든)

`truth-log-findings.md` 맨 끝에 번호를 이어 한 절을 쓴다(지금 마지막은 53번). 형식:

```
## <번호>. <한 줄 제목> (스위치 `GENIE_EXPERIMENT_...`에 추가 / 새 스위치 / 스위치 없음)

- 사례: <선수, 유닛 id, 마스터, 시각(초), 갱신 번호>. 증상 한 문장.
- 원본: <주소 범위>가 하는 일. 근거 문서 파일 이름.
- 엔진: <파일> `<함수>` — 무엇을 어떻게 바꿨나.
- 결과: 바뀐 숫자를 "이전 → 이후"로(자원 일치 구간, 단어별 첫 불일치, 엔진이 멈춘 갱신과 이유). 실행 이름(`runs\<이름>`).
- 확인 못 한 것 / 추정인 것: 분명히 구분해서.
```

- 틀린 시도도 적는다("이렇게 해봤는데 효과 없음, 꺼 둠/지움"). 같은 길을 또 가지 않게.
- 읽기만 하고 안 넣은 것도 적는다(주소와 넣을 위치).
- 원본을 읽어 만든 사례 문서는 `original-188329-<주제>-case-<시각>s.md`로 이 폴더에 넣는다(주소, 숫자 재현, 엔진 변경, 못 읽은 것). 디컴파일 원문을 길게 붙이지 않는다(3절).

### 13.2 작업을 멈출 때 (세션 끝, 한도, 다른 도우미에게 넘길 때)

1. **`CONTINUE.md` 2절의 숫자 표를 최신 실행으로 고친다.** 실행 이름과 켠 스위치 목록도.
2. **12.2 표에 새로 넣은 줄을 추가한다**(스위치, 내용, 파일, 근거, 확인 여부).
3. **12.5 미해결 목록을 고친다**: 푼 것은 지우고, 새로 보인 것은 이른 순서로 넣는다. 각 항목에 "다음에 할 첫 동작"을 한 줄로 적는다(어느 유닛, 어느 갱신 구간을 추적할지).
4. **하던 중인 일을 `CONTINUE.md` 맨 끝 "지금 하던 일" 절(13.4)에 덮어쓴다**: 무엇을 보고 있었나, 어디까지 확인했나, 엔진 소스가 빌드되는 상태인가, 반쯤 넣은 변경이 있는가(파일·함수), 돌려 둔 실행이 있는가.
5. **엔진 패치를 다시 만든다**: PC에서 `cd genie && GIT_OPTIONAL_LOCKS=0 git diff --ignore-cr-at-eol > ../<새이름>.patch` → 저장소의 `sorted-lists-and-truth-trace.patch`를 그것으로 바꾼다. PC `genie\` 소스와 저장소 패치가 항상 같아야 한다.
6. **새로 만든 도구를 저장소 `tools/`에 넣는다**(`runs\`의 스크립트 사본).
7. **커밋하고 푸시한다**: 브랜치 `research/genie-188329`만. 작성자 `Claude <noreply@anthropic.com>` 또는 그 도우미 이름(사용자 회사 메일 금지). 커밋 메시지 첫 줄에 무엇을 했는지.
8. **PC의 `genie-replays\CONTINUE.md`도 같은 내용으로 덮어쓴다.** 저장소와 PC 사본이 다르면 저장소가 기준이다.
9. 원본 읽기 결과 원문(보고서, 손 계산 스크립트)은 PC `re-kit\`에 묶어 두고, 묶음 이름을 12.7 표에 적는다.

### 13.3 숫자를 적을 때의 규칙

- 항상 같은 채점으로: `runs/summ.sh <이름>`의 출력에서 뽑는다. 선수별로 "자원 일치(≤ 0.01) 구간", "50 넘게 틀리기 시작", 단어 1·7·9의 첫 불일치, 900초 누적, 엔진이 멈춘 갱신과 이유.
- 엔진이 900초 전에 멈췄으면 900초 누적값은 적지 않거나 "멈춤 때문에 무효"라고 쓴다.
- "맞았다"는 실행해서 본 것만. 읽기만 한 것은 "읽음, 미실행", 추론은 "추정"이라고 쓴다.
- 원본 기록의 한 표본짜리 차이는 깨진 표본일 수 있다(12.4). 3표본 연속일 때만 차이로 적는다.
- **기본 묶음에 넣는 판정 규칙(2026-11-12 바뀜)**: 리플·선수마다 "첫 어긋남" = (모든 체크포인트 단어 중 가장 이른 불일치, 자원 첫 차이 > 0.01) 중 이른 시각. 스위치를 켠 실행에서 세 리플 모든 선수의 첫 어긋남이 앞당겨지지 않으면 기본에 넣는다. 같은 실행에서 그 선수의 첫 어긋남 뒤에 생긴 불일치·앞당김은 뒤따른 것으로 보고 판정을 막지 않는다(대신 12.5에 열린 문제로 적는다). 예전 규칙(어느 단어든 첫 불일치가 하나라도 앞당겨지면 안 넣음)은 너무 엄격해서 바꿨다. 숫자는 `summ2.sh`의 "first word mismatch"와 "first difference > 0.01"에서 뽑는다.

### 13.4 지금 하던 일 (멈출 때마다 이 절을 덮어쓴다)

- 날짜·작성: 2026-11-13, Claude (세션 M4).
- 세션 M4가 한 일: findings 52(`FARMSPOT`, 농장 자리 뽑기)와 53(`MOVEEND`, 그룹 이동의 끝)을 넣고 둘 다 기본으로 켰다. 실행 `M4_p_239/161/097`, `M4_n_894/090/670`(2.1). 지금 기본은 스위치 27개(`-Envs`로 주는 24개가 한 줄로 `runs\M4_envs.txt`, 나머지 셋은 `go.ps1`이 켬).
- 그 전: 세션 M3 = findings 51(덤 자원 작업 164, 스위치 없음), 세션 M2 = 49(`GATHER_SNAP`)·50(뱀의 Fly, 스위치 없음).
- **main에서 할 일(이 브랜치에서는 안 건드림)**: `engine/switches.env`에 `GENIE_EXPERIMENT_FARMSPOT_188329=1`, `GENIE_EXPERIMENT_MOVEEND_188329=1`을 더한다(`GATHER_SNAP`·`PLANCHOICE`가 아직 없으면 그것도; `runs\K_envs.txt` 뒤에 생긴 스위치는 이 넷). 패치가 바뀌었으니 엔진 빌드 캐시 키가 바뀐다. **`engine-check.yml`의 기대값이 바뀐다: 518239882 확인 체크포인트 P1 55개, P2 54개**(전 53/53).
- 멈춘 지점: 53번을 넣고 기록한 직후. 반쯤 넣은 변경 없음.
- **다음 첫 동작**: 12.5 0번 목록 순서(518239882 P2 696.6초 → 518470161 P2 710.7초 → 518239882 P1 710.6초 → 517426097 795.9초 → 518470161 P1 822.0초). 연구 밖 리플은 519686090 P1 379.4초(여자 사냥꾼 하나의 내려놓기가 0.5초쯤 늦는 것으로 추정), 516956894 P1 639.4초, 519700670 P2 54,997 "a horde's command" 멈춤. 사례마다 12.4의 순서.
- 사용자에게 물어볼 것(2026-11-12에 말함, 답 대기): 초반 15분 자원은 거의 맞으므로(2.1) 제품화(9절 8번, 12.5 7번: 분석기 출력 — 실제 수입, 동물별 먹은 양, "어디까지 검증됨")를 지금 시작할지, 엔진 정확도를 더 올릴지.
- **분석기(main) 대조·배포 (2026-11-12 밤)**: 사이트는 `main`의 Python 수집기(mgz)로 돌고 엔진은 쓰지 않는다(엔진은 게임 DAT가 필요해 GitHub Actions에 못 둠). main `c105be5`를 배포함(Actions 성공): 체크포인트 11개 단어의 뜻 확정 표와 대조 결과를 README·`scripts/state_curve.py`에 기록, 분석 출력 숫자는 안 바꿈. 대조한 것: (1) 보유 자원 합 `total_res` = 원본 메모리 값(872개 중 852개 일치, 나머지는 표본 시각 차이). (2) 봉건 전 인구 막힘(`scripts/housing.py`)의 인구 추정을 원본 기록과 비교: 여섯 선수 중 하나는 전부 일치, 셋은 중반부터 1~3 낮음(식량 부족 거절을 잘못 추정), 하나는 6~11초 이름. 막힘 표시 자체는 여섯 경우 모두 실제와 안 어긋남. **다음 첫 동작(분석기 쪽)**: 체크포인트 단어 2(마스터 합)·6(수)·10(ID 합)의 변화로 주민 탄생을 직접 세는 풀이를 `housing.py`에 넣어 식량 추정 거절을 대체한다(새 오브젝트는 그때까지의 최대 ID보다 큰 ID를 받고, 가축 편입은 헤더에 있는 옛 ID, 건물 기초는 BUILD 명령으로 안다). 검증은 `research/genie/tools/analyzer_housing_vs_truth.py`(원본 기록과 2초 간격 비교)로. main 작업은 PC `genie-replays\aoe2-main` 작업 폴더(브랜치 `analyzer-accuracy2`)에서 했다; 이 저장소의 `origin/main`은 `git fetch origin main`으로 따로 받아야 최신이 된다(기본 fetch가 안 받음 — 처음에 옛 main을 보고 작업했다가 버렸다).
- **사용자 결정 (2026-11-12 밤): 엔진을 사이트(GitHub Actions)에서 돌린다. 게임 데이터는 비공개 저장소에 둔다.** 엔진(genie, AGPL-3.0)은 공개 저장소에서 빌드해 써도 된다. 엔진은 DAT 12MB의 대부분을 읽으므로 "숫자만 뽑기"는 의미가 없고, DAT를 사용자의 비공개 저장소(이름은 사용자가 정함, 예 `ssapo/aoe2-data`)에 두고 Actions가 토큰(저장소 비밀 `AOE2_DATA_TOKEN`, Contents 읽기 전용)으로 받는다. 공개 저장소·공개 아티팩트·로그에 DAT나 그 변환본을 올리지 않는다. **사용자가 할 일(대기 중)**: 비공개 저장소 만들기, 그 저장소만 읽는 토큰 만들기, `ssapo/aoe2`의 Actions 비밀에 등록. **그 뒤 순서**: (1) PC에서 DAT를 비공개 저장소에 푸시(빌드 188329용; 패치마다 새 파일), (2) `update.yml`에 엔진 빌드(librematch/genie `91d81be4` + `research/genie/sorted-lists-and-truth-trace.patch`, cargo 캐시)와 DAT 받기 단계 추가 — 토큰이 없으면 건너뛰고 기존 분석만, (3) 엔진이 분석기용 출력(자원별 실제 수입, 동물별 먹은 양, "어디까지 검증됨" = 체크포인트가 맞는 마지막 시각)을 JSON으로 내게 하기(9절 8번; 계산법 `truth-economy-518239882.md`), (4) `collect.py`가 그 JSON을 `analysis`에 넣고 화면에 표시, 검증 구간 밖은 표시하지 않기. 리플의 게임 빌드가 188329가 아니면 엔진 결과를 쓰지 않는다.
- **엔진이 GitHub Actions에서 돈다 (2026-11-12 밤, 확인함).** 사용자가 비공개 저장소 `ssapo/aoe2-data`와 비밀 `AOE2_DATA_TOKEN`을 만들었다. 그 저장소 `188329/`에 DAT와 엔진이 DAT 옆에서 읽는 표 여섯 개(`dropsites.json` 등; 없으면 update 4,100쯤 "a drop site that does not take the load"로 멈춘다)를 올렸다(PC 사본 `genie-replays\aoe2-data`). main에 `engine/switches.env`(24개 스위치 + 기본 환경), `engine/README.md`, `.github/workflows/engine-check.yml`(사이트 배포와 별개의 점검: genie `91d81be4` + 연구 브랜치 패치 빌드 5분(캐시 전), 데이터 받기와 sha256 확인, 리플 518239882 실행 22초)을 넣었고 **성공**: 리눅스 결과가 PC와 같다(P1·P2 53개 체크포인트 일치, 멈춤 없음). 로그는 로그인 없이 못 보므로 요약 줄을 `::notice::`로 내고 공개 API의 check-run annotations로 읽는다(PowerShell `Invoke-RestMethod https://api.github.com/repos/ssapo/aoe2/actions/runs`). 엔진 스위치를 더하면 `engine/switches.env`도 고치고, 패치가 바뀌면 점검 워크플로의 기대값(53개)도 고친다. **남은 순서**: (3) 엔진의 분석기용 출력(자원별 실제 수입, 동물별 먹은 양, 검증된 마지막 시각) — 새 example 또는 census 옵션으로 JSON, (4) `update.yml`·`collect.py`·화면 연결(토큰 없거나 빌드가 188329가 아니면 건너뜀; `update.yml` 제한 시간 15분에 엔진 빌드 캐시 필요).
- **자원별 누적 수입이 사이트에 나간다 (2026-11-12 밤, main `8a090e4`, 배포 성공).** `scripts/engine_income.py`가 수집 때 엔진을 돌려(`GENIE_TRACE_RES`, `GENIE_PRINT_CHECKPOINTS`) 자원별 증가분 누적을 10초 간격으로 저장하고, 체크포인트 단어 1이 두 선수 모두 맞는 마지막 시각까지만 남긴다(300초 미만이면 버림). 화면은 `site/engine-income.js`(수치 탭). `update.yml`에 엔진 빌드·데이터 받기 단계(실패해도 나머지는 진행), 개정 15. 대조: 518239882는 682초까지 검증, 그 구간 누적 수입이 원본 기록과 식량 5.5·나무 9.9 이내. **첫 배포 결과(다시 분석된 최신 5경기)**: 520386901은 379초까지, 519925669는 308초까지 표시, 520397411·520394236·519930254는 없음(검증 구간이 300초 미만이거나 엔진 실패 — 원인 미확인; 최신 경기는 게임 빌드가 188329가 아닐 수 있다). 즉 **연구에 쓴 세 리플 밖에서는 엔진이 훨씬 일찍 어긋난다** — 다음 엔진 작업의 우선순위는 이 새 리플들의 첫 어긋남(원본 기록 없이 체크포인트 단어로 좁힘, 12.5 6번)이다. 남은 것: 수입 출처별(양·사냥·열매·농장)과 동물별 먹은 양, 나머지 16경기는 예약 실행마다 5경기씩 다시 분석됨.
- **2026-11-13 (세션 L)**: (1) 새 리플 분류 `runs\N_out\triage.md`(실행 `N_<리플>`): PC의 비연구 리플 7개 중 **4개(515741992, 516293031, 516495787, 516746960)는 빌드 185872** — 엔진 대상(188329)이 아님. 188329인 셋: 516956894는 update 2에서 Gaia 멈춤 "a flight keeping away from a class"(`movement/fly.rs:258-262`, 마스터 2592 동물 6마리) → 전부 거기서 파생; 519686090 P1(데인)은 99.9초부터 자원 −2(양치기 내려놓기마다 +0.5로 보이는 문명 보너스 누락, DAT 미확인), 64,950 멈춤 "AutomaticMoveUnitsToDesiredPositions' path to a slot"; 519700670은 P1 340.4초 word 7, 54,997 멈춤 "a horde's command". **다음 엔진 첫 동작**: ~~fly.rs의 keep-away 분기~~(50번으로 넣음, 516956894는 이제 64,092까지 감) → 데인 내려놓기 보너스(DAT 효과 확인). (2) main 로컬 브랜치 `housing`(미푸시, `aoe2-main`): `8a1d619` 체크포인트 단어 6·10으로 유닛 탄생을 직접 세어 봉건 전 인구 추정 교체(`scripts/births.py`, 개정 16; 원본 대비 어긋난 초: 172/308/312/38/102 → 0/0/2/6/0) + 그 위 커밋: `analysis.game_build` 기록, 엔진은 빌드 188329 경기만 실행, 화면 안내. **배포는 사용자 요청 대기.**
- 엔진 소스 상태: 빌드되는 상태, 최신 커밋 패치와 같음. 진단 출력 `GENIE_TRACE_MASTERHP`, `GENIE_TRACE_BELL`, `GENIE_TRACE_TASK164`, `GENIE_TRACE_EXTRA`, 진단 스위치 `GENIE_EXPERIMENT_RESSEARCH_RANGE0`이 들어 있다(끄면 영향 없음). 돌고 있는 실행 없음. 최신 기본 실행 `M4_p_239`, `M4_p_161`, `M4_p_097`(연구 밖 `M4_n_894`, `M4_n_090`, `M4_n_670`). `runs\census_base.exe`는 이 세션의 마지막 빌드(52·53번 포함)로 덮어썼다. 이번 빌드에서는 `steer.build` 파일이 안 생겼다(빌드는 성공: `build7.err`의 "Finished"와 `census.exe` 시각으로 확인할 것). 실행 시간: 추적 없이 여섯 리플 동시에 1분 안쪽, `GENIE_TRACE_RES=1`을 붙이면 12개 동시에 약 20분. 주의: `runs\steer.ps1`로 빌드한 뒤에는 `steer.build` 파일의 시각과 `census.exe`의 시각을 같이 본다(예전 `steer.build`가 남아 있으면 빌드가 끝난 것으로 잘못 본다; 빌드 중에 실행을 띄우면 exe가 잠겨 링크가 실패한다).
- 일하는 방식: 구현자 하나(엔진 수정·빌드) + 조사 도우미 여럿이 통했지만, **사용 한도(5시간 제한)를 빨리 쓴다. 사용자 요청(2026-11-12): 동시에 띄우는 도우미 수를 줄일 것** — 기본은 혼자, 꼭 필요할 때 1~2개. 모든 리플에 걸리는 큰 수정이 기다리고 있으면 그것부터 넣고 나서 다음 사례를 조사한다(안 그러면 여러 도우미가 같은 원인을 따로 찾는다). 도우미 결과의 핵심 주소는 넣기 전에 직접 다시 읽는다. 도우미용 공통 안내는 `runs\helper-common.txt`.
- 원본 분석 환경은 세션마다 새로 차려야 한다(7절; `re-kit`의 압축 세 개 + Ghidra 11.3.2, 10분).
- 전체 실행은 `-Updates 75000`(518470161, 517426097), 41600(518239882). 세 리플 동시에 8~10분.
