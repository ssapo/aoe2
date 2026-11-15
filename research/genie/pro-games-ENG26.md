# ENG-26: 프로 경기 14판 분류 (2026-11-16, Claude)

엔진: `runs\census_base.exe` (= `census_J25e.exe`, 소스 변경 없음), 기본 스위치 `runs\M6_envs.txt`, `runs/E5_go.sh` + `GENIE_TRACE_COMMANDS=1`, update 75,000까지. 실행 `P26_<경기>` (한 번에: `runs\J25_launch.ps1 -Cmd "bash runs/P26_launch.sh <접두> <추가 env>"`). 표: `python3 P26_out/tab.py P26` (원문 `P26_table.txt`). 자원 추적: `P26r_<경기>` (RES+GAIN, 앞부분만), 도구 `P26_out/res_at.py <err> <선수> <초>`. 개체 추적: `P26t1`(520930307, 0~700), `P26t2`(517429796, 0~520), 첫 틱 개체 `P26s_*`.

고른 경기: 프로 14명 각 1판(랭크 1대1 = match_type 6), 리플 머리말로 빌드 188329 확인(14판 모두). 520821782는 MbL 대 ACCM(두 프로). 리플은 `genie-replays\<경기>\`(aoe.ms 수집기 주소, git 밖). 문명은 리플 머리말 번호(aocref 이름; 61 = Varangians). 원본 메모리 기록이 없으므로 아래 "원인"은 전부 **추정**(엔진 쪽만 봄), 숫자는 체크포인트 단어(13.3 규칙: 체크포인트 단어 중 첫 불일치, `{단어: 엔진−기록}`)로만 잰다.

## 1. 표 (첫 어긋남 = 13.3, 단어 1 첫 불일치 = 사이트 규칙의 근거)

| 경기 (프로) | 문명 P1 / P2 | 맵 | 첫 어긋남 P1 / P2 (초 {단어}) | 단어 1 첫 불일치 P1 / P2 (초, 엔진−기록) | 사이트 구간 | 엔진 멈춤 |
|---|---|---|---|---|---|---|
| 519444998 (Lucho) | Dravidians / Georgians | Enclosed (닫힘) | 8.9 {9:736} / 8.9 {7:3,9:279} | 158.4 -1 / 125.9 -22 | 1:59.4 | P1 없음; P2 없음 |
| 521113438 (ACCM) | Ethiopians / Mapuche | Atacama | 210.4 {7:23,9:6} / 184.4 {7:25,9:6} | 288.4 -10 / 262.4 -1 | 4:15.9 | P1 멈춤 47745: an attack's target the slice does not hold live; P2 멈춤 48398: an object of a stopped player may be near |
| 521069970 (Liereyy) | Maya / Danes | Socotra | 164.7 {7:221} / 203.7 {7:-7} | 333.7 -10 / 372.7 -1 | 5:27.2 | P1 멈춤 57441: an object of a stopped player may be near; P2 멈춤 57234: a kill reward task (action type 0xa1) |
| 521333824 (Lewis) | Poles / Goths | Hideout (닫힘) | 164.7 {7:-56} / 184.2 {7:-42} | 249.2 -25 / 268.7 -6 | 4:02.7 | P1 멈춤 55636: a builder with no task for its foundation; P2 멈춤 55644: an object of a stopped player may be near |
| 520821782 (MbL) | Teutons / Berbers | Golden Pit | 51.9 {9:44} / 51.9 {7:136,9:237} | 200.4 +6 / 265.4 -9 | 3:13.9 | P1 없음; P2 없음 |
| 521153105 (Sitaux) | Burgundians / Wu | Arabia | 54.2 {7:2} / 119.2 {7:2} | 119.2 -5 / 190.7 +43 | 1:52.7 | P1 없음; P2 없음 |
| 518985913 (Hera) | Khmer / Japanese | Arabian Desert | 73.7 {7:9,9:6} / 145.2 {7:-106} | 151.7 -23 / 275.2 -1 | 2:25.2 | P1 없음; P2 없음 |
| 520176967 (Sebastian) | Mongols / Danes | Enclosed (닫힘) | 177.7 {9:128,10:-2} / 67.2 {7:106,9:-6} | 281.7 -3 / 119.2 -4 | 1:52.7 | P1 없음; P2 없음 |
| 520842005 (Blve) | Malians / Italians | Arabian Desert | 8.9 {7:1,9:6} / 8.9 {7:2} | 190.9 -11 / 151.9 -1 | 2:25.4 | P1 없음; P2 없음 |
| 517429796 (Nicov) | Wei / Saxons | Arabian Desert | 8.7 {9:-147} / 8.7 {7:-14,9:583} | 171.2 -37 / 158.2 +1 | 2:31.7 | P1 멈춤 54621: a missile whose shooter died (its weapons, FUN_14113e170); P2 멈춤 54882: an object of a stopped player may be near |
| 521113779 (Yo) | Burmese / Celts | Arena (닫힘) | 28.9 {9:-265} / 28.9 {9:476} | 210.9 -3 / 184.9 -1 | 2:58.4 | P1 멈춤 62723: a notify kind the base handler does not model; P2 없음 |
| 520199364 (dogao) | Burgundians / Japanese | MegaRandom | 164.7 {7:15} / 67.2 {7:-5} | 197.2 -1 / 119.2 -23 | 1:52.7 | P1 멈춤 63926: an object of a stopped player may be near; P2 멈춤 63553: an attack's target the slice does not hold live |
| 519908353 (SoraKuma) | Poles / Turks | Steppe | 129.9 {7:-73} / 162.4 {7:2} | 188.4 -4 / 233.9 +11 | 3:01.9 | P1 멈춤 48368: a farm's bonus near a master (FUN_1411d3cd0); P2 멈춤 49398: an object of a stopped player may be near |
| 520930307 (Ciskhan) | Cumans / Huns | Arabia | 9.2 {9:-351} / 9.2 {7:-14,9:-716} | 152.2 -22 / 119.7 +50 | 1:53.2 | P1 없음; P2 없음 |

사이트에 분석된 것: 521069970의 운영 사이트 `engine_income.verified_until_seconds` = 327.2초 = 위 5:27.2와 같음. 518985913·520842005·517429796은 분석은 됐지만 `engine_income`이 없음(엔진 구간 미표시). 나머지 열 판은 사이트에서 아직 분석 전(pending).

**한눈에**: 사이트 구간은 1:52.7 ~ 5:27.2(중앙값 약 2:30). 연구 리플(6~14분)보다 훨씬 짧다. 열네 판 중 여섯 판은 **첫 체크포인트(499 sync)부터** 어긋난다.

## 2. 원인 묶음 (이른 원인, 이 원인이 첫 어긋남/사이트 구간을 정하는 판 수)

| 묶음 | 판 | 증상 | 판정 | 필요한 것 |
|---|---|---|---|---|
| A. 첫 체크포인트의 단어 9만 큰 차이(수백), 두 선수 함께 | 5판: 519444998, 517429796, 520930307, 521113779(28.9초), 520821782(51.9초, P2는 단어 7도) | 위치(단어 7)는 같고 단어 9(행동 종류+상태+**유닛 AI 재탐색 타이머**)만 −716 ~ +736. 두 선수가 같은 체크포인트에서 함께 → AI 난수(타이머를 뽑는 줄)의 뽑기 수가 처음 몇 초 안에 달라진 것으로 추정 | 추정. 배제한 것: TC 트로피 변환(TransformObject 0x29, 마스터 1649 → 1650~1653; 통과하는 다섯 판에도 있음), 가축 종류(1243/1060), 선택 생략 목록(0xffff, 연구 리플에도 있음), shift 이동, 명령 종류 집합(통과하는 518985913과 같음), 머리말 설정(다른 것 없음) | **원본 기록**(아래 3절 사양 A) |
| B. 사냥·사슴 내려놓기 직후 단어 1이 정확히 ±1(보유량 단어 4는 같음)로 오래 유지 | 단어 4까지 같은 꼴 4선수: 520842005 P2, 517429796 P2, 520199364 P1, 521069970 P2(그 밖에 ±1이지만 단어 4도 다른 3선수: 521113779 P2, 518985913 P2, 521113438 P2). 사이트 구간을 정하는 판: 520842005(2:25.4), 517429796(2:31.7) | 엔진 자원 추적(`P26r_*`): 직전 체크포인트까지 같고, 그 사이 변화는 멧돼지/사슴 식량 입금(소수점 있는 양, 예 517429796 P2 158.119초 +49.9107)과 주민 값 −50뿐 → 원본이 약 +1 식량(또는 −1) 많다. 그 뒤 차이가 늘지 않음 = 내려놓기 하나의 소수 몫/시점 차이로 보임. 문명 보너스 꼴(내려놓기마다 일정)은 **아님** | 추정 | **원본 기록**(사양 B) |
| C. 경기 중 위치(단어 7) 첫 차이, 작은 값 | 9판의 나머지 선수(54~210초) | 움직임 차이(묶음 이동·사냥 유인 등, triage3의 묶음 1·2와 같은 종류로 추정) | 미조사 | 판마다 개체 추적 |
| D. 엔진 멈춤(전부 첫 어긋남 뒤 → 사이트 구간과 무관) | 8판 | "an attack's target the slice does not hold live" 2판(521113438 P1 47,745, 520199364 P2 63,553); "a kill reward task (action type 0xa1)" 521069970 P2 57,234; "a missile whose shooter died" 517429796 P1 54,621; "a notify kind the base handler does not model" 521113779 P1 62,723; "a farm's bonus near a master" 519908353 P1 48,368(12.5 5번에 있던 것); "a builder with no task for its foundation" 521333824 P1 55,636(ENG-05 종류); 나머지는 "an object of a stopped player may be near"(따라 멈춤) | 미구현 갈래 | 원본 읽기(188329 피해 처리·공격 시작의 해당 갈래) |

순위(첫 어긋남·사이트 구간을 정하는 판 수): A 5판 > B 2판(사이트) / 4~7선수(첫 단어 1) > C 나머지 > D(사이트 영향 없음).

## 3. 고친 것

**없음.** A·B는 체크포인트 단어만으로는 어느 개체·어느 뽑기가 다른지 가릴 수 없다(원본 기록 필요). D 중 "kill reward task 0xa1"은 188329의 피해 처리 함수 주소를 못 찾아(옛 빌드 주소 `FUN_141082e80`·`FUN_14120b5f0`만 있음; 0xa1/0x9a 비교 바이트 검색으로는 안 나옴) 읽기 전에 멈췄다. 엔진 소스·기본 스위치·main 기대값 변경 없음 → 518239882 확인 체크포인트 57 / 54 그대로(실행 안 바꿈, exe 같음).

### 원본 기록 사양
- **A (AI 난수 뽑기)**: 리플 517429796(Wei 대 Saxons, Arabian Desert), 게임 시각 0~9.0초(update 0~520) **매 틱**: `airng`(AI 난수 상태), 두 선수 모든 유닛의 유닛 AI 재탐색 타이머·마지막 재탐색 시각(unit AI의 +0x38..0x60 범위 안; truthlog7의 `ai` 필드), 개체 id·마스터. 기록기: `truth\truthlog7.ps1 -DenseFromMs 0 -DenseUntilMs 9000 -MaxWorldMs 12000`. 엔진 쪽 비교: `GENIE_TRACE_OBJECTS_RANGE=0-520` + `GENIE_TRACE_DRAWS_RANGE=0-520`. 첫 뽑기 수 차이가 나는 틱과 그 틱의 개체가 답이다.
- **B (사냥 내려놓기 ±1)**: 리플 517429796 P2(Saxons), 151.6~158.2초(update 약 11,000~11,500) 매 틱: P2 자원(소수까지), 사냥꾼 주민들의 보유량(obj+0x168)·상태, 멧돼지 개체의 남은 식량. 엔진 `P26r_517429796`(RES, 158.119초 +49.9107)과 나란히 놓고 어느 주민의 입금이 몇 다른지 본다.
