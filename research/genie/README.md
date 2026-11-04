# Genie 최신 1v1 호환성 실험 — 미완성, 배포 금지

기준 소스: librematch/genie 91d81be43402f50d89cfb8da8f168fe43878f83d.
검증 경기: 518239882, ssapo vs Maerlin_the_Mighty325, build 188329, save 68.9.
원본 엔진 지원: build 158041. 사용자 게임 파일은 저장소에 포함하지 않는다.

## 실제 확인
- Rust 1.99.1 release 빌드 성공.
- DAT: 63 civilizations, 1510 techs. read/write roundtrip이 압축 해제 원본 93,272,287 bytes와 완전히 같음.
- 시뮬레이션 import는 task class -1448에서 거부. class < -1인 task 381개 발견. action 154/155/157 등의 필드 의미 조사 필요. 값을 제거/0 치환하지 않았음.
- 옵션 version 1123, PlayerInfo version 15 관측.
- save 68.9에 한정하여 위 버전을 실험적으로 허용하고 PlayerInfo 끝의 SigString을 보존하면 플레이어 정보 구간을 통과함. 의미 미확인 필드로 명시함.
- 이후 지도 시작 marker는 예상 0x74f가 아니라 0x750에 있음. 앞선 World 필드에 1 byte 차이가 있으나 위치/의미 아직 특정 못함. 임의 패딩 또는 marker 검색으로 건너뛰지 않았음.

## 다음 검증
1. World 필드 변경 위치를 여러 build 188329 리플 및 가능한 원본 엔진 자료로 특정.
2. 지도/객체/플레이어 상태를 끝까지 읽고 원본 바이트 roundtrip 검사.
3. 특수 task의 음수 class 필드 의미를 구현. 기존 ClassId 제약을 무작정 완화하지 않기.
4. 1v1 전체 경기 checkpoints 대조. 불일치/미지원 중단은 분석 성공으로 취급하지 않기.

실험 patch는 generated 파일에 적용된 탐색용 변경이며 upstream 생성기 변경이나 완전한 호환 패치가 아니다.
현재 경기 재현/생존 병력/실제 사망 추출은 불가능. 0.36초는 기존 실행의 오류 종료 시간이지 분석 성능이 아니다.

실행 환경과 전체 소스: 작업 폴더 genie-check. cargo-home/rustup-home도 그 안에 보존.
실행: CARGO_HOME=<genie-check>/cargo-home RUSTUP_HOME=<genie-check>/rustup-home <genie-check>/cargo-home/bin/cargo run --release -p genie-oracle --example header_probe -- <replay>

## 다른 AI 인계 — 2026-11-04

작업 브랜치: `research/genie-188329`. 목표는 게임 화면 없이 최신 1v1 리플을 정확히 재현하고, 실제 사망/생존 군대 가치/경제 곡선을 뽑아 승부처를 분석하는 것. 현재는 호환성 조사 단계이며 시뮬레이션 성공 사례가 아니다.

### 가장 먼저 할 일

`experimental-188329-header.patch`를 고정 upstream 커밋에 적용하고 `header_probe.rs`로 같은 실패를 재현하라. 최신 실패는 지도 marker를 읽는 위치 `0x74f`, 실제 marker 위치 `0x750`이다. `BaseWorld` 또는 앞선 `World`/옵션 구간의 필드 변경을 여러 최신 리플에서 비교해 정확히 특정하라. 1바이트가 없다는 사실만으로 임의 패딩을 넣지 말 것. 앞선 필드 해석이 밀렸을 가능성도 있다.

### 새 환경에서 재현

1. https://github.com/librematch/genie 의 커밋 `91d81be43402f50d89cfb8da8f168fe43878f83d`를 별도 폴더로 받는다. Rust 1.99.1에서 빌드했다.
2. 이 폴더의 패치를 upstream 루트에서 `git apply`로 적용한다. 탐색용 generated-file 패치이므로 정식 구현 시 생성 원본/버전 모델도 고려한다.
3. `header_probe.rs`, `dat_probe.rs`를 `crates/tools/genie-oracle/examples/`에 복사한다.
4. `cargo run --release -p genie-oracle --example dat_probe -- /path/empires2_x2_p1.dat`
5. `cargo run --release -p genie-oracle --example header_probe -- /path/match.aoe2record`
6. 원래 전체 검증 명령은 `cargo run --release -p genie-oracle --example census -- /path/match.aoe2record /path/empires2_x2_p1.dat`. 현재 import 오류 때문에 경기 계산에 도달 못함.

검증 리플은 `https://aoe.ms/replay/?gameId=518239882&profileId=26260702`에서 받았으며 ZIP 응답을 풀어야 한다. 공개 리플 URL은 만료될 수 있다. 사용자 데이터 파일은 게임 설치 경로 `resources/_common/dat/`의 `empires2_x2_p1.dat`, `dropsites.json`, `linkedTechs.json`, `linkedUnits.json`. 원본 게임 파일과 리플은 이 브랜치에 포함하지 않는다. 기존 import는 `unitlines.json`도 선택적으로 읽지만 `linkedUnits.json`과 같은 파일이라고 가정하지 말 것.

### 기존 작업 환경 경로 (없으면 위 절차로 복구)

- 프로젝트: `/workspace/scratch/acd26b270bae/ssapo-aoe2`
- 엔진 전체 소스/빌드: `/workspace/scratch/acd26b270bae/genie-check`
- 도구: `genie-check/cargo-home`, `genie-check/rustup-home`
- 첨부 데이터: `/workspace/scratch/acd26b270bae/upload/`
- 리플: `genie-check/AgeIIDE_Replay_518239882.aoe2record`
- 기존 Python parser: `/workspace/scratch/acd26b270bae/ssapo-deps/mgz/fast/header.py` (일부 구간을 탐색으로 건너뛰므로 완전한 상태 복원 근거로 쓰지 않기)

### 해석상의 주의

DAT roundtrip 성공은 파일 구조를 손실 없이 읽는다는 뜻이며 엔진이 그 내용을 정확히 계산한다는 뜻이 아니다. 음수 class task는 보존해야 한다. 의미는 아직 미확인이고 특수 동작용일 가능성이 있으나 추정이다. 새 문자열 필드도 뜻이 확인된 것이 아니다. 다른 리플과 원본 엔진 자료로 검증해야 한다.

### 프로젝트의 별도 미배포 초안

이 브랜치에는 Genie 실험/인계 자료만 올렸다. 기존 로컬에는 `scripts/turning_point.py`, parser revision 10, 복기 상단 요약 UI 등의 다른 초안이 있지만 이 브랜치에 포함하지 않았다. 명령상 생산 요청 수는 생존 일꾼 수가 아니고, sync object 수는 군대 수가 아니다. 이 초안의 승부처 추론은 신뢰도가 부족하므로 자동으로 배포하지 말 것.

### 사용자 작업 규칙

의미 있는 작업 단위로 별도 작업 브랜치에 커밋/푸시 가능. main 반영, 배포 브랜치 푸시, 배포 workflow 수동 실행은 사용자가 명시적으로 요청할 때만 한다. 커밋을 매 수정마다 만들지 않는다. 원본 게임 데이터, 빌드 산출물, toolchain을 공개 저장소에 올리지 않는다.
