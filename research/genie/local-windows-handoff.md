# 다음 작업: 로컬 Windows에서 원본 리플 재생·데이터 수집 가능 여부 확인

기록일: 2026-11-05 (한국 시간). **다음 AI는 이 문서부터 읽고 작업한다.** 사용자가 이번 단계 전환을 다음 작업자에게 기록해 달라고 요청했다.

> **최신 (2026-11-05 오후):** 원본 화면 값과 엔진을 같은 게임 시간으로 맞춘 결과 → [original-vs-engine-518239882.md](original-vs-engine-518239882.md). 1:09까지 자원·인구·주민 일치, 1:09~2:55 사이 엔진의 양치기 식량 공백(90~150초)에서 갈라짐.

## 2026-11-05 진행 기록 (Claude, Cowork 세션)

**실행 환경:** 클라우드 Linux 셸 + 사용자 Windows PC 원격 도구(PowerShell, 화면 캡처/클릭, 파일 접근)가 실제로 연결됨.
`get_device_info` 결과 platform `win32`, device `ssapo`, 연결 폴더 `C:\Users\ssapo\AppData\Local\Temp\genie-replays`.

**설치본 확인 (읽기 전용, 2026-11-05 10:2x KST):**

| 항목 | 값 |
| --- | --- |
| `AoE2DE_s.exe` | 72,176,952 bytes, FileVersion 101.103.57257.0, SHA-256 `1E415AF8…3CA16` (업로드본과 동일), 수정 2026-11-04 12:12 |
| 게임 로그의 빌드 | `Version = 101.103.57257.0 #(188329)`, Stream `release_13_1_0_build_machine` (`%USERPROFILE%\Games\Age of Empires 2 DE\logs\Age2SessionData.txt`) |
| Steam appmanifest 813780 | buildid 26272505 (Steam depot 번호, 게임 build 아님) |
| `resources\_common\dat` | `empires2_x2_p1.dat` 11,963,833 (SHA-256 앞 16자리 D0AEFD92428E2215), `civilizations.json` 58,763 (04E19A8D86262CF9), `unitlines.json` 20,974 (1D124BA1B66A2EE7), `dropsites.json` 31,606 (9EC0DCC98335FE00), `linkedTechs.json` 3,947 (DB2119B3FEFDC4D9), `linkedUnits.json` 809 (987F86EEA316001C). 모두 같은 설치본(2026-11-04 12:12) |

→ 설치 게임 build 188329 = 리플 518239882·518470161·516956894의 build. 185872 리플 4개는 다른 build다.

**게임 실행:** `steam://rungameid/813780`로 정상 실행(로그인 추가 입력 없음). 메인 메뉴 도달, 화면 하단 `버전 101.103.57257.0 (#188329) 26272505`.
게임 프로필 폴더는 이때 처음 생성됨(이 PC에서 첫 실행으로 보임). Steam ID 폴더 `76561198039927362`.
리플 8개를 `%USERPROFILE%\Games\Age of Empires 2 DE\76561198039927362\savegame\`에 복사함.

**리플 재생 (12:24~12:34 KST, 사용자가 PC를 비운 동안):**
- 경로: 메인 메뉴 → 싱글 플레이어 → 게임 불러오기 → `다시 보기` 탭 → `AgeIIDE_Replay_518239882` → `다시 보기 로드`. 목록에 8개 리플 모두 표시됨(185872 리플 포함, 재생 가능 여부는 미확인). `CA를 이용하여 관전` 버튼도 있음.
- **518239882가 build 188329 게임에서 열리고 재생됨.** 로비 표시: ssapo(색 2 빨강, 프랑크족) vs Maerlin_the_Mighty325(색 1 파랑, 프랑크족), 아라비아 사막, 120 크기.
- 명령행 옵션이 리테일에서 먹힘: `steam.exe -applaunch 813780 SKIPINTRO WINDOW` → 프로세스 명령행 `AoE2DE_s.exe SKIPINTRO WINDOW`, `Main.txt`에 `...Skipping due to commandline`.
- 사용자 계정에 UI 모드가 구독돼 있음(`Better Resource Panel and Idle Villager Icon`, `Advanced Idle Pointer`, `Small Trees`, `Zetnus Improved Grid`, `No more plants`, `Building Foundation Label`, `Monk Pointer`, `Legacy ES Maps`). 화면 숫자는 이 모드 UI 기준이다.

**화면에서 직접 읽은 값 (관찰 선수 ssapo = 리플 기록자, 게임 속도 보통 1.7, 시계는 화면 상단 게임 시간):**

| 게임 시간 | 나무 | 식량 | 금 | 돌 | 인구/한도 | 자원별 숫자(나무/식량/금/돌) | 인구 아이콘 아래 숫자 | 점수 ssapo (총/군사/경제/기술/사회) | 점수 Maerlin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 00:00:15 | 150 | 150 | 100 | 200 | 4/5 | 0/0/0/0 | 3 | 186/0/166/20/0 | 171/0/151/20/0 |
| 00:00:30 | 150 | 50 | 100 | 200 | 5/10 | 0/3/0/0 | 4 | 201/0/171/30/0 | 196/0/166/30/0 |
| 00:02:55 | 170 | 3 | 100 | 200 | 10/15 | 2/7/0/0 | 9 | 383/0/223/160/0 | 397/0/217/180/0 |

0:15 값은 두 번째 실행, 0:30은 첫 번째 실행 화면이다. 자원별 숫자는 모드 패널의 작업 주민 수로 보이나 확인하지 않았다. 인구 아이콘 아래 숫자의 의미도 미확인. 화면 캡처 원본은 공개 저장소에 넣지 않았다.

**원본 게임 전체 재생 완료 (13:18~13:25 KST, 세 번째 실행):** 사용자가 리플을 켜고, 이후 화면 캡처·빨리 감기(`>>>`)·통계 탭 클릭은 원격으로 진행.
게임 창 1280×760. 1:09~5:26은 보통 속도, 이후 빨리 감기로 끝(00:33:59, 상대 `gg` 기권)까지 재생, 종료 후 통계 화면 6개 탭 캡처.
**모든 값은 [original-game-518239882.json](original-game-518239882.json)에 정리**했다(HUD 시계열 20개 시점 + 종료 통계). 캡처 PNG는 사용자 PC `%TEMP%\genie-replays\capture-518239882\`에만 있다.

종료 통계(원본 게임이 직접 보여준 값, 시간 00:34:03):

| | ssapo (승) | Maerlin |
| --- | --- | --- |
| 점수 군사/경제/기술/사회/총 | 1235 / 2047 / 1523 / 0 / 4805 | 738 / 1756 / 1741 / 0 / 4235 |
| 제거한 유닛 / 사망한 유닛 | 73 / 39 | 36 / 73 |
| 파괴한·파괴된 건물, 전향 | 0, 0, 0 | 0, 0, 3 |
| 최대 병력 | 27 | 26 |
| 수집 식량/목재/석재/금 | 10747 / 6823 / 0 / 3125 | 9885 / 5998 / 1366 / 3956 |
| 봉건/성주 시대 | 10:03 / 22:20 | 8:5x / 21:2x |
| 탐색 지도 %, 연구 수 | 62, 18 | 96, 18 |
| 최대 주민 | 67 | 73 |

교차 일치: ssapo 사망 39 = Maerlin 제거 36 + 전향 3, Maerlin 사망 73 = ssapo 제거 73. HUD 마지막 주민 67 = 통계 최대 주민 67.
→ **사상자·자원 수집 총량의 원본 정답값**이 생겼다. 독립 엔진이나 기존 분석기의 추정치를 이 값과 바로 대조할 수 있다.

**재생 중 게임 강제 종료 (2회, 원인 미확정):**
- 12:28경(첫 실행, 0:30에서 하단 일시정지 버튼 클릭 직후)과 12:33경(두 번째 실행, 2:55 이후) `AoE2DE_s.exe`가 사라짐. `Main.txt` 추가 기록 없음, Windows 응용 프로그램 이벤트 로그 오류 없음, CrashDumps/WER 없음.
- 두 번째 종료 직후 화면에 회사 근태 프로그램 **SWITCH의 `자리비움` 창**(시작 12:06, 종료 12:24, 사유 선택)이 떠 있었다. 사용자 부재 중 근태/PC 제어 프로그램이 게임을 끄는 것으로 의심되지만 확인하지 않았다. SWITCH 창은 조작하지 않았다.

**도구 메모:** 화면 5120×1440(2560×1440 두 대). `Screenshot(display=[0])`의 Region 표기는 (2560,0,…)이지만 실제 좌표는 왼쪽 모니터(0~2560) 기준으로 클릭이 맞았다. 게임 실행 중 원격 화면 캡처가 60초 타임아웃·dxcam 오류를 자주 냈다. PowerShell `CopyFromScreen`은 게임 화면이 아니라 다른 창을 캡처했다(창 순서 문제).

**남은 것 / 다음 대상:**
- 독립 엔진과 대조: JSON의 초반 시점(0:15, 0:30, 1:09, 2:55, 4:44, 5:26)의 자원·인구·주민 수를 엔진 시뮬레이션의 같은 게임 시간 값과 비교. 게임 시간 ↔ sync/update 변환을 명시할 것. 엔진 쪽 덤프는 `census.rs`에 게임 시간 지정 출력 훅을 추가해서 얻는 방식으로 착수했으나 빌드 전에 멈췄다(패치 미포함).
- 종료 통계(사상자 73/39 등)를 기존 분석기(명령 기반 추정)·독립 엔진 결과와 대조.
- 다른 리플(특히 518470161, 516956894)도 같은 방식으로 재생해 정답값 확보. 빨리 감기 후 8초 간격 창 캡처 + 종료 통계 탭 캡처가 효율적이었다.
- 원격 클릭 좌표: Windows-MCP `Click`과 `GetWindowRect`(DPI aware) 좌표계가 같다. 창 기준 상대 위치로 계산하면 정확했다. `Screenshot(display=[0])` 이미지 좌표는 모니터 배치 때문에 그대로 쓰면 틀릴 수 있다.
- 명령행 옵션이 먹히므로 `LOGDIR`, `LOGCOMMANDS`, `LOGACTION`, `LOGPLAYER`, `EXIT` 등으로 리플 재생 중 로그가 생기는지 시험(사용자 소유 PC에서).


**실행 파일 문자열에서 찾은 상태 수집 후보 (실행 검증 전, 존재만 확인):**
- 명령행 옵션 표: `WINDOW`, `SKIPINTRO`, `NOVSYNC`, `UNCAPPED_SIMULATION_SPEED`, `LOGDIR`, `LOGCOMMANDS`, `LOGACTION`, `LOGPLAYER`, `LOGSTART`, `EXIT`(지정 게임 시간 뒤 자동 종료), `SCRIPT`/`SCRIPTREPORT`/`TEST_HARNESS_COMM`(testharness), `RUN_REGRESSION_TESTS`, `DEVELOPER`, `ACCURATE_CHECKSUMS` 등. 리테일에서 실제로 먹히는지는 미확인.
- SyncLogger: `SyncLog`, `%s %s %s.txt`, `Game completed without desync`, `(RandSync) file=%s line=%d`, `cRandSync tracking enabled`, `host-settings.txt`. 체크섬 구성 항목 문자열 `AIExpertCRC, VisibilityCRC, Random1..5, NumSleepingObjects, Attributes, MasterObjIDs, ObjectStates, ObjAttributeAmountHeald`. 켜는 방법은 미확인.
- 프로필의 `testharness\{regressionsaves,reports}` 폴더가 첫 실행 때 생성됨(비어 있음).
- CaptureAge 연동: 게임 안에 gRPC API 서버 `localhost:4341`(CaptureAge 인증서 포함, `CadeApiSynchronize`). 메인 메뉴 상태에서는 4341 listen 없음. 공개 API가 아니므로 직접 접속은 보류. CaptureAge 앱이 있으면 군대 가치·킬 등을 사람이 보고 대조하는 용도로는 쓸 수 있음(미확인).
- 리플 종료 후 게임 자체의 통계 화면(유닛 처치/손실, 타임라인)은 사용자 목표(사상자)와 직접 관련된 원본 값 후보.

**(당시 계획, 위 실행으로 일부 수행)**
1. 게임 창을 앞으로(현재 창 위치 1300,100 크기 1600×1000, 모니터 5120×1440 전체 좌표 기준).
2. 싱글 플레이어 → 기록된 게임에서 518239882 재생. 열리면 0:30, 1:00, 5:00 화면(인구·주민·자원) 캡처, 관찰 선수 표시.
3. 끝까지 빠르게 돌려 통계 화면 캡처(처치/손실).
4. 별도 단계: `-SKIPINTRO -WINDOW` 등으로 명령행 옵션이 리테일에서 먹히는지 `Main.txt`의 `Skipping video due to commandline`으로 확인 → 그 뒤 SyncLog 계열 시험.

## 먼저 해야 할 일

현재 우선순위는 사용자의 실제 Windows PC에 접근해 AoE2가 실행되고 1v1 리플이 열리는지 확인하는 것이다. 게임을 실행할 수 있는 환경을 확보하고 원본 상태를 얻을 경로를 조사한다. 게임 실행과 자동 상태 추출은 별개의 검증 단계다. 이미 자동 수집기가 완성됐거나, 데스크톱 앱을 켜기만 하면 가능한 것으로 보고하지 않는다.

사용자는 데스크톱 앱을 열었다고 했지만, 직후 이 대화에서 확인한 실행 환경은 여전히 Linux, 작업 경로는 `/workspace/scratch/acd26b270bae`였다. Windows 설치 경로에는 접근되지 않았고 로컬 데스크톱 조작 도구도 연결되지 않았다. **앱을 켰다는 말만으로 로컬 연결을 확인했다고 하지 말 것.** 새 작업에서 도구·실행 위치·파일 접근을 다시 확인한다. Linux 셸이어도 별도 Windows 연결 도구가 있으면 그것을 확인하되, 클라우드 셸에서 C드라이브 문자열을 검사한 결과만으로 PC 전체 상태를 단정하지 않는다.

사용자에게 안내한 전환 경로는 ChatGPT 데스크톱 앱의 Work/Codex → 로컬 작업(Work locally), 필요하면 설정 → Computer use → Any App이다. 실제 메뉴·기능은 계정과 앱 버전별로 다를 수 있으므로 현재 화면과 연결된 도구를 기준으로 판단한다. 로컬 연결이 없으면 그 사실과 필요한 한 단계만 설명하고, 가능한 파일 분석·코드 작업은 계속한다.

공식 참고:
- https://learn.chatgpt.com/docs/use-chatgpt
- https://learn.chatgpt.com/docs/computer-use

## 파일을 다시 요청하기 전에 확인

사용자가 지정한 설치 경로:

```text
C:\Program Files (x86)\Steam\steamapps\common\AoE2DE
```

이미 받은 자료:

| 파일 | 확인 상태 |
| --- | --- |
| `AoE2DE_s.exe` | 2026-11-05 업로드 받음. PE32+ / x86-64 Windows GUI 실행 파일 확인 |
| `empires2_x2_p1.dat` | 이전 업로드 및 독립 엔진 import/cache 검증에 사용 |
| `dropsites.json`, `linkedTechs.json`, `linkedUnits.json` | 이전 업로드 받음 |
| `civilizations.json`, `unitlines.json` | 이전 클라우드 업로드에는 없었음. 실제 설치 폴더부터 확인 |

업로드된 실행 파일의 확인값:
- 크기: **72,176,952 bytes**
- PE fixed version resource의 file/product version: **101.103.57257.0**
- SHA-256: `1e415af8b7fbbe6aeb4e1eebf888f43e9d9b8b9129df2bd010d0a7a60dc3ca16`
- 이전 클라우드 사본: `/workspace/scratch/acd26b270bae/upload/AoE2DE_s.exe`. 새 로컬 작업에도 이 경로가 존재한다고 가정하지 않는다.

위 리소스 버전만으로 리플 build 185872/188329와 호환된다고 판정하지 않는다. 원본 게임은 **아직 실행하지 않았다.** 실행 파일은 형식·버전 리소스·해시만 확인했으며, 원본 retarget/RNG 처리 로직 분석도 아직 수행하지 않았다.

## 로컬 확인 순서

1. 실제 도구가 Windows 파일·프로세스·게임 화면에 접근하는지 확인한다. 연결돼 있지 않으면 게임을 실행했다고 하지 않는다.
2. 설치 폴더와 실행 파일을 읽기 전용으로 확인한다. 로컬 사본의 버전·크기·해시를 기록한다. 게임 데이터 폴더 `resources\_common\dat`에서 위 JSON과 DAT를 찾는다. 파일 위치가 다르면 실제 경로를 사용한다.
3. 로컬 게임과 같은 설치본의 DAT/JSON을 묶어 기록한다. 서로 다른 패치의 파일을 섞어 맞는 것처럼 시험하지 않는다. `civilizations.json`이 있으면 독립 엔진에서 거절했던 세 리플의 문명 매핑을 재검증할 수 있다.
4. 설치된 Steam/게임의 정상 실행 경로로 AoE2를 열고, 버전이 맞는 **1v1 리플 하나**를 재생한다. Steam 로그인은 사용자가 직접 처리한다. DRM 우회·게임 바이너리 패치·설치 파일 덮어쓰기 없이 진행한다.
5. 첫 후보는 `518239882` (보조 후보 `518470161`). 리플이 없으면 기존 로컬 기록과 프로젝트 자료부터 찾는다. 오래된 리플이 현재 게임에서 거절되면 게임 버전·리플 build·오류를 기록하고, 현재 버전의 1v1 리플로 실행 검증을 분리한다. 다른 경기를 쓴 결과로 기존 체크포인트 문제가 해결됐다고 하지 않는다.
6. **실제로 노출되는 원본 상태**를 얻을 경로를 확인한다. 우선 게임 화면에서 직접 확인되는 시각·주민/병력 수 등의 항목으로 소규모 대조 자료를 만들 수 있는지 살핀다. 화면에 없는 값은 추측하지 않는다. 안정적인 파일/로그/지원되는 인터페이스가 있으면 그 경로를 우선 조사한다. 공개 export API나 자동 상태 덤프가 있다고 가정하지 않는다.
7. 자동 수집이 가능해지면 단일 리플의 초반 몇 시점부터 검증한다. 예: 게임 내 0:30, 1:00, 5:00. 게임 시간·관찰 선수·데이터 출처를 같이 저장하고 같은 시점의 원본 화면과 대조한다. 게임 속도와 벽시계 시간을 혼동하지 않는다. UI 관측, 명령 기록, 실제 게임 상태를 구분한다.
8. 더 깊은 상태/원본 동작 조사가 필요하면 실행 파일에서 확인할 수 있는 정보와 필요한 추가 관찰을 구분해 기록한다. 아직 원본 상태를 얻지 못했다면 그 범위를 명확히 남긴다. 여러 도구를 설치하거나 긴 빌드를 하기 전에 현재 자료로 확인 가능한 최소 경로를 우선한다.

PowerShell에서 실행할 수 있는 읽기 전용 설치 확인 예시 (명령 실행 권한이 있는 로컬 셸에서만):

```powershell
$gameRoot = 'C:\Program Files (x86)\Steam\steamapps\common\AoE2DE'
$gameExe = Join-Path $gameRoot 'AoE2DE_s.exe'
if (-not (Test-Path -LiteralPath $gameExe)) { throw '실제 설치 경로를 확인하세요.' }
$gameFile = Get-Item -LiteralPath $gameExe
$gameFile | Select-Object FullName, Length,
    @{Name='FileVersion'; Expression={$_.VersionInfo.FileVersion}},
    @{Name='ProductVersion'; Expression={$_.VersionInfo.ProductVersion}}
Get-FileHash -LiteralPath $gameExe -Algorithm SHA256
$gameData = Join-Path $gameRoot 'resources\_common\dat'
Get-ChildItem -LiteralPath $gameData -File |
    Where-Object { $_.Name -in @('empires2_x2_p1.dat', 'civilizations.json', 'unitlines.json', 'dropsites.json', 'linkedTechs.json', 'linkedUnits.json') } |
    Select-Object Name, Length
```

게임 실행·재생·상태 수집은 위 명령에 포함되지 않는다. Computer Use로 터미널을 조작해 권한 제한을 우회하지 않는다.

## 독립 엔진 쪽에서 이어갈 지점

연구 브랜치: `research/genie-188329`. 이 문서를 추가하기 전 커밋은 `6c620b0a65fb5d7378690997c6129c390fd59f11`.
원본 genie 고정 커밋: `91d81be43402f50d89cfb8da8f168fe43878f83d`.

[ordered-work-summary.md](ordered-work-summary.md)에 최신 코드 수정·재현 명령이 있다. [README.md](README.md)의 과거 release 빌드·미완료 과제는 최신 요약으로 보완해서 읽는다.

- import/model/save 테스트 213개 통과. DAT 캐시 왕복·특수 음수 task 보존·문명 매핑을 수정했다.
- 리플 8개 중 5개는 1500 updates 실행, 3개(516495787, 516956894, 517426097)는 canonical 문명 정보가 없어 의도적으로 거절했다.
- `518239882` player1의 999 sync word9는 17000 vs 원본16445, 차555가 남는다. player2는1499 sync부터 word9 차124.
- `518470161` player2는499 sync의 word7 좌표 합 차109가 남는다. scout9391의308~499 이동 구간이 조사 대상이다.
- RNG 로그가 현재 엔진 타이머12개와 일치하는 것은 내부 일관성 검사다. 원본과 난수 소비 순서가 같다는 증거가 아니다.
- 갱신 단계만 바꾸어 checksum을 맞추는 가설은 검증했고 해결되지 않았다. 원본 객체별 상태나 원본 처리 로직이 다음 비교 근거다.
- `GENIE_EXPERIMENT_CAPTURE_SETUP=1`은 진단용 가설이다. 정식 게임 동작으로 채택하지 않는다.
- **전체 1v1 경기 재현, 생존 병력·사상자·전투 자원 손실 추출은 아직 검증되지 않았다.** 가축 변화·총 객체 수·생산 요청량으로 전투 손실을 만들지 않는다.
- 기존 6개 패치 위에 `ordered-data-and-trace.patch`를 적용한다. 긴 fat LTO release 빌드를 반복하지 말고 문서의 `profile research`를 사용한다. 빌드 시간과 리플 재생 속도를 섞지 않는다.

## 별도로 준비된 분석기 정확도 수정

`fix/analysis-evidence-accuracy` 브랜치의 `6a2ead1d9f3281cb685b16494bb2c0e48583a572`에 있다. 연구 엔진 코드와는 별도다.

수량 판독 실패가 있을 때 첫 병종 오판·가짜 주민 요청 공백·부분 합계 표시를 막고, 후반 판독 실패가 정상 초반 집계를 숨기지 않게 했다. Python43 + Node25 =68개 테스트 통과. 저장된46개 플레이어 기록에는 해당 예외가 없어 기존 요약 수치는 동일했다. 리플1개를 재파싱했지만 실제 교전 재현 검증은 아니다. 이 수정도 **main 반영·배포하지 않았다**.

## 다음 작업 종료 시 반드시 남길 기록

- 실행 환경과 실제 로컬 접근 가능 여부
- 게임/리플/DAT의 버전·해시 또는 확인 가능한 식별자
- 어떤 리플을 어디까지 원본 게임에서 재생했는지
- 직접 확인한 값과 자동 추출된 값의 출처, 수집 주기·시각 정렬 방식
- 아직 얻지 못한 값, 재현 가능한 실패 메시지, 다음 비교 대상

완료 기준은 우선 **원본 게임으로 1v1 리플 한 개를 재생하고, 실제 상태를 수집할 경로가 있는지 증거를 남기는 것**이다. 실행만 성공한 경우 자동 분석 성공으로 보고하지 않는다.

사용자는 **배포 시작을 직접 결정**한다. 의미 있는 단위의 연구/수정 브랜치 커밋·푸시는 가능하지만 main 병합·main 푸시·배포 workflow 실행은 별도 요청 전 금지다. 원본 EXE/DAT/리플·빌드 산출물은 공개 저장소에 넣지 않는다. 기존 로컬 초안 `turning_point.py`/parser revision10/승부처 UI를 섞어 배포하지 않는다.
