# 이어받는 사람(또는 AI)을 위한 안내

기준일: 2026-11-11 (12절이 최신; 2절 숫자도 최신). 브랜치: `research/genie-188329` (저장소 `ssapo/aoe2`). 이 문서만 읽고 같은 방식으로 이어갈 수 있게 썼다. 세부 근거는 [truth-log-findings.md](truth-log-findings.md)에 있다.

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

켜는 스위치(전부 `=1`): `GENIE_EXPERIMENT_SORT_LISTS`, `GENIE_EXPERIMENT_SHORT_188329`, `GENIE_EXPERIMENT_SPAWN_188329`, `GENIE_EXPERIMENT_AI_ORDER_188329`, `GENIE_EXPERIMENT_EVADE_188329`, `GENIE_EXPERIMENT_WALK_188329`, `GENIE_EXPERIMENT_HUNT_188329`, `GENIE_EXPERIMENT_UNLOAD_188329`, `GENIE_EXPERIMENT_MOVETO_188329`. 앞의 셋은 `runs\go.ps1`이 항상 켠다. 나머지는 `-Envs`로 준다(12.3절).

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
- 기본 환경 변수: `GENIE_CORRECT=ids GENIE_EXPERIMENT_SEARCH_CLEAR=tick GENIE_EXPERIMENT_CAPTURE_SETUP=1 GENIE_NO_STOP=1 GENIE_PRINT_CHECKPOINTS=1` + 2절의 스위치 셋. 인자: `<리플> <DAT> <update 수>` (전체는 41600).
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
| EVADE_188329 | 클래스 65 → Hunted AI | `unit_ai/ids.rs` | R11-D3 | **효과 없음**(아래 미해결 1) |
| WALK_188329 | 종류 2 링크가 끝나면 최상위 레벨까지 풀기(R4-D1) | `movement/waypoint.rs` `arrived` | walk-case-98s | 98.2초 사례 |
| WALK_188329 | 꼬리 짧은 경로의 목표 = 대상의 현재 위치(R4-D4) | `movement/request_plans.rs` `short_try` | tail-goal-case-175s | 175.3초 사례 |
| WALK_188329 | 경로 없음 + 시도 남음 → 어느 웨이포인트에서나 0.1초 멈춤(R4-D6) | `movement/new_path.rs` `no_path` | pause-case-330s | 330.1초 사례(시작 평가값과 함께) |
| HUNT_188329 | 내려놓은 뒤 가축 3단계 탐색(R2-D8) | `gathering/hunt/unit.rs` `hunt_next_search`, `map/spatial/search.rs` `closest_object` | findings 14 | 144.1초 사례 |
| HUNT_188329 | 작업 시작 때 대상(클래스 8, 32, 15)에 붙이기 `0x1116f60` | `gathering/hunt/gathering.rs` `set_face` | snap-case-155s | 155.4초 사례 |
| HUNT_188329 | 클래스 10(멧돼지) → 종류 5 탐색(R2-N1) | `hunt/unit.rs`, `gathering/gather_search/passes.rs` `first_resource` | boar-kind-case-335s | 335.1초 사례 |
| UNLOAD_188329 | 복귀 기록: 맨 앞 액션의 대상이 그 건물이 아니면 대상 없이 기록 | `garrison/unit.rs` `go_inside` | unload-case-232s | 232.1초 사례 |
| MOVETO_188329 | MoveTo는 기다리지 않고 바로 실패(R2-D9 = R7-C1) | `movement/move_to/mod.rs` `give_up` | findings 21 | 394초 사례 |
| (스위치 없음) | 엔진이 멈추던 세 곳을 원본 동작으로 | `unit_ai/actions.rs`, `orders/moves.rs` | unsupported-stops | 끝까지 실행됨 |

"근거" 열의 문서는 모두 이 폴더의 `original-188329-*.md`이다. 사례 문서는 주소와 손 계산까지 들어 있다.

### 12.3 실행과 비교 (PC, PowerShell)

```
$d="$env:USERPROFILE\genie-replays"
# 빌드만 (약 3분; 끝은 build7.err의 "Finished"로 확인. census가 돌고 있으면 exe를 못 덮어써서 실패하니 먼저 Stop-Process -Name census)
powershell -File $d\runs\steer.ps1
# 실행: 이름, 갱신 수(기본 41600 = 끝까지), 추가 환경변수
$a='GENIE_EXPERIMENT_AI_ORDER_188329=1;GENIE_EXPERIMENT_EVADE_188329=1;GENIE_EXPERIMENT_WALK_188329=1;GENIE_EXPERIMENT_HUNT_188329=1;GENIE_EXPERIMENT_UNLOAD_188329=1;GENIE_EXPERIMENT_MOVETO_188329=1'
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

1. Gaia 동물 마스터 2095(id 4283~4285): 186.6초부터 원본에서만 도망간다(정찰병이 지나갈 때). 식량이 없는 동물이라 자원 영향은 없다. 클래스 65 → Hunted를 넣었지만 변화 없음 → 리플에서 AI 종류가 저장값에서 오는지, 클래스가 65가 맞는지 확인 필요.
2. 383.4초 P1 나무꾼 4371(그리고 4363): 벌목소로 가는 짧은 경로 모양이 다르다(원본은 y = 45.1211을 따라 동쪽으로 간 뒤 꺾음). 도착 시각은 같다. 짧은 경로 사례로 넘길 만하다.
3. 411.2초 P1 나무 −10, 450.9초 P2 나무 −10: 아직 안 봤다. 다음에 볼 것.
4. 엔진 멈춤: update 36,452 "a helper that answers a call for help (its reach, bestUnitToAttack and AttackObject)". 그 앞 실행에서는 41,256 "a horde's command (commandHorde)". 22번과 같은 방식(원본 동작을 읽어 오류를 대체)으로 처리.
5. 읽기에서 확정했지만 아직 안 넣은 것(사례가 나오면 넣는다): 채집 N1(자원 탐색 `0xd23bf0` 전체), N2(0.25초 재선정), N4(광산 교체); 농장 D1(자리 뽑기), D2(삭제된 농장) + 삭제 명령 0x83; 건설 C2, C4; 가축 3단계 탐색의 AI 통지 쪽(R2-D8b); 사슴 도망의 지도 경계 자르기·두 번째 목표·4방향; 걷기 D2, D3, D5, D7, D8; 길찾기 최종 선택 R16-D1; 죽을 때 애니 속도 0(R13-D1); 연구·비용 R8 D1~D7; 작업 시작 붙이기의 Gather(유형 5) 쪽.
6. 다른 리플 검증을 한 번도 안 했다. PC `genie-replays\`에 리플 폴더가 여러 개 있다(515741992, 516293031, 516495787, 516746960, 516956894, 517426097, 518470161, 519686090, 519700670). 원본 기록이 없어도 체크포인트 단어로는 비교할 수 있다: 같은 스위치로 돌려 단어별 첫 불일치가 기준 리플과 비슷하게 늦어지는지 본다.
7. 제품화: 스레드 로컬 지름길 두 개(`CLOSEST_FROM`, `SPAWN_PATH`)를 정식 인자로 바꾸고, 스위치들을 "빌드 188329" 한 설정으로 묶는다. 분석기 출력(실제 수입, 동물별 먹은 양, "어디까지 검증됨" 줄)은 아직 손대지 않았다.

### 12.6 원본 기록을 다시 뜰 때

`truth\truthlog5.ps1`(컴파일만 확인, 실제 기록은 안 해봄): v4에 더해 경로 상태·웨이포인트를 끝까지, 유닛 AI의 명령·액션·대상(`ai+0x38..0x50`), 맨 앞 액션 노드와 객체(`obj+0x420` → `list+0x10`)를 기록한다. `-DenseUntilMs`까지는 매 틱, 그 뒤는 200 ms 간격. 리플을 낮은 배속으로 재생하면서 `powershell -File truth\truthlog5.ps1 -Out truth\truth5.jsonl`. 게임 메모리는 읽기만 하고, 싱글·리플 재생에서만 쓴다(3절).

### 12.7 파일 위치 추가분

| 경로 (PC `genie-replays\`) | 내용 |
|---|---|
| `re-kit\re-focused-cases-v1.tar.gz` | 사례별 원본 읽기 결과(out_p1..p9, out_u1)와 프롬프트 원문 |
| `re-kit\re-reading-round2..5.tar.gz` | 구역별 읽기 보고서 원문(out_r1..r17)과 검증표 |
| `runs\go.ps1`, `steer.ps1`, `summ.sh`, `cmp_*.py` | 12.3절의 도구(저장소 `tools/`에도 사본) |
| `truth\truthlog5.ps1` | 12.6절 |
| 엔진 패치 | 저장소 `sorted-lists-and-truth-trace.patch` = PC `genie\`의 `git diff --ignore-cr-at-eol`(기준 `91d81be4`). 다시 만들 때: `cd genie && GIT_OPTIONAL_LOCKS=0 git diff --ignore-cr-at-eol > ../<새이름>.patch` |
