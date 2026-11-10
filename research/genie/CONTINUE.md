# 이어받는 사람(또는 AI)을 위한 안내

기준일: 2026-11-10. 브랜치: `research/genie-188329` (저장소 `ssapo/aoe2`). 이 문서만 읽고 같은 방식으로 이어갈 수 있게 썼다. 세부 근거는 [truth-log-findings.md](truth-log-findings.md)에 있다.

## 1. 목표

리플 파일만 넣으면 원본 게임과 같은 결과를 내는 것. 최종 용도는 리플 분석기의 **자원 표시**(자원별 실제 수입, 동물별 먹은 양 등)를 정확하게 하는 것이다. 게임 메모리 기록은 정답지일 뿐이고 제품에는 쓰지 않는다.

- 대상 원본: `AoE2DE_s.exe` 101.103.57257.0 #(188329).
- 엔진: librematch/genie `91d81be4` + 연구 패치. genie는 **옛 빌드 158041**을 따라 만들어져 있어서, 188329에서 바뀐 규칙을 하나씩 찾아 넣는 것이 일의 대부분이다.
- 기준 리플: 518239882 (선수 1 = ssapo, 선수 2 = Maerlin_the_Mighty325).

## 2. 지금 어디까지 맞나 (세 스위치를 켠 엔진)

| 항목 | 값 |
|---|---|
| 체크포인트 11 word 전부 일치 | 선수 1: 57.0초까지, 선수 2: 29.0초까지 |
| 체크포인트 자원 합계(word 1) 일치 | 두 선수 160.2초까지 |
| 자원 4종이 원본 메모리 기록과 일치(차이 ≤ 0.01) | 선수 1: 133.96초, 선수 2: 131.72초 |
| 전 개체 위치가 같은 비트 | 32.5초까지(그 뒤 40초까지 다른 개체는 선수 2의 둘뿐) |
| 엔진 실행 | 41,600 update 끝까지, 선수 정지 없음 |

스위치: `GENIE_EXPERIMENT_SORT_LISTS=1`, `GENIE_EXPERIMENT_SHORT_188329=1`, `GENIE_EXPERIMENT_SPAWN_188329=1` (기본 실행 환경 변수는 6절).

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
