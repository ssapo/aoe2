# 다음 작업: 로컬 Windows에서 원본 리플 재생·데이터 수집 가능 여부 확인

기록일: 2026-11-05 (한국 시간). **다음 AI는 이 문서부터 읽고 작업한다.** 사용자가 이번 단계 전환을 다음 작업자에게 기록해 달라고 요청했다.

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
