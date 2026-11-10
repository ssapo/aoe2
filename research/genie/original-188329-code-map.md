# 원본 188329 코드 대응표와 확인 방법

기록일: 2026-11-10 (한국 시간). 대상: `AoE2DE_s.exe` 101.103.57257.0 #(188329), SHA-256 `1E415AF8…3CA16`, PE 시각 `0x6acf93a9`, 이미지 크기 `0x4f24000`.

이 문서의 주소는 모두 RVA다(이미지 기준 `0x140000000`을 뺀 값). genie 소스 주석의 `FUN_140…` 주소는 build 158041 기준이라 직접 비교할 수 없다.

## 확인 방법

- 파일 상태의 `.text`는 1KB 창 기준 약 60%가 암호화돼 있다. 작은 함수는 평문이고 게임 로직 대부분이 함수 단위로 잠겨 있다.
- 게임을 띄우면 메뉴 화면 단계에서 이미 전체가 풀려 있다. 프로세스를 `PROCESS_VM_READ | PROCESS_QUERY_LIMITED_INFORMATION`으로 열어 이미지 전체(83MB)를 4KB씩 읽었다. 읽기 실패 0쪽, 75ms. 풀린 뒤 고엔트로피 창은 1.35%만 남는다.
- 덤프의 `.text`를 원본 exe 사본에 덮어 쓴 분석용 파일을 Ghidra 11.3.2로 읽었다(자동 분석 없이, `.pdata`의 함수 경계로 필요한 구간만 디컴파일).
- 덤프·분석용 exe는 저장소에 넣지 않는다. 게임 메모리에 쓰지 않는다.
- RTTI 클래스 이름은 숫자 해시로 바뀌어 있어 쓸 수 없다. 로그 문자열은 exe에 남아 있지만 코드에서 참조하지 않는다. 소스 경로 문자열(`…\Aoc\Source\Game\Map\PathingSystem.cpp`, RVA `0x329cec0`)과 그 옆 가상함수표가 진입점 단서였다.
- 객체 필드는 포인터·값이 덧셈/XOR 상수로 가려져 있다. 예: 개체 위치 x = `q[obj+0x170] + 0x4d086415325b1a2b`의 아래 32비트(float), y = `(q[obj+0x178] ^ 0xbbadc6d6e9b81de2) + 0x3c682b96db105333`. 플레이어 자원 값은 `((x ^ 0xa8cf267a3f737c66) - 0x042ac42976fccef5) ^ 0xa9834b738a7dd167`.

## 주소 대응 (188329)

| 역할 | 188329 RVA | genie 모듈 / 158041 주소 |
|---|---|---|
| long pather (타일 A\* 변형) | `0x1078d60` | `pathing/long_path`, `FUN_140f9eb70` |
| long pather 경로 쓰기 | `0x1077870` | `long_path::path`, `FUN_140f9d770` |
| long pather 힙 삽입 | `0x107ae70` | — |
| long pather 전역 객체 | `0x3db3330` | `0x1439e6910` |
| long pather 방향 제외 표 | `0x329ce88` | `long_path/step_dir.rs` |
| long pather 확장 한도 설정값 | `0x435d6a0` (실행 중 7500) | `DAT_143f0f358` |
| short pather 진입 | `0x1078690` | `pathing/short_path`, `FUN_140f9e540` |
| short pather 본체 | `0x107f7a0` | `FUN_140fa53d0` |
| short pather 출발점 처리 | `0x107e820` | `short_path/start.rs` |
| short pather 장애물 수집 | `0x1082670` | — |
| short pather 선분 검사 | `0x1084770`, `0x1084210` | `short_path/raycast.rs` |
| short pather 도착 판정 | `0x107ce90` | — |
| tile pather 진입 | `0x1057a40` | `pathing/tile_path` |
| tile pather 탐색 | `0x10527c0` → `0x1052f60` | `tile_path/search.rs` |
| tile pather 이웃 확장 | `0x1051150` | — |
| tile pather 객체 찾기 (`world+0x140`) | `0x1058020` | `Pathing` planners |
| 큰 유닛용 탐색 (hull path 추정) | `0x1060d90` | `pathing/hull_path` |
| 길찾기 순차 질의 (tile → short → long) | `0x107a5e0` | — |
| 진입 래퍼 | `0x1077e70`, `0x1078320`, `0x107a390` | — |
| 유닛 걷기 (틱당) | `0x1210f60` (20KB) | `movement/step.rs`, `0x141150f00` |
| PathingSystem 전역 포인터 | `0x4357fe0` | `DAT_143f0a088` |
| 플레이어 자원 getter | `0x1819b30` 부근 | — |

## 원본 코드로 읽은 값

엔진 소스와 대조까지 한 것은 long pather의 방향 제외 표·20000·7500뿐이다(일치). 나머지는 원본에서 읽은 값이고 엔진 쪽 대조는 아직 안 했다.

- long pather: 격자 폭 480, 직선 4·대각 8, 예상 비용 `16*(dx²+dy²)`, 방향 전환 +1, 방향 제외 표 `38 70 E0 C1 83 07 0E 1C 00`, 확장 한도 `거리*7500/100`과 20000, 목표 타일 생성 즉시 종료, 동점 시 새 항목 우선.
- short pather: 고정소수점 2^22, 탐색 창 ±4타일(`0x1000000`), 막힌 선분 재검사 1.1배(`0x466666`), 꼭짓점 최소 비용 초기값 −4194304, 반지름 0.5 초과는 다른 탐색기.
- tile pather: 1/2/4/8타일 4단계, 4방향, 유클리드 비용, 직각 꺾임 시 조부모 기준 비용, 결과 코드 1/2/4.
- 걷기: 다음 경유점까지 거리 10 이하에서 short pather 호출, 사거리 −0.1, 실패 시 조건부 long pather 대체, 대기 타이머(`경로상태+0x34`).

자세한 읽기 노트는 [original-188329-pathfinding-notes.md](original-188329-pathfinding-notes.md)에 있다.

## 다음에 원본 코드로 확인할 것

1. 걷는 중 충돌 회피: `0x1210f60`의 나머지와 그 안에서 부르는 `0x120d500`, `0x120ee10`, `0x1207520`, `0x111c660`. 엔진 `movement/step.rs`의 "A walk that may meet an obstruction is not modelled" 자리다.
2. 양 사체 생성 시점: 개체 사망 → 사체 개체 생성 경로. 주소 미확인.
3. 158041과 188329 사이에 바뀐 동작: 엔진이 멈추는 지점("a queued move of an object that does not move", "set_state 0xf3")의 원본 처리.

## 이 세션에서 막힌 것

- Cowork 클라우드 세션에서 genie 빌드·실행이 자동 권한 심사에 거부됐다(외부 코드 실행). 소스 읽기와 패치 적용까지는 됐다. 빌드는 사용자 PC나 다른 세션에서 해야 한다.
