# ENG-10: 개체와 묶음 이동을 연결하는 진단 패치

2026-11-13 / Codex. 상태: **진단 코드 작성·검증 완료 / 실제 사례 원본 대조는 자료 대기**. 남겨 둔 빌드·실행·하위 조사 없음.

이 문서는 `codex/eng10-diagnostics-review-20261113` 검토 브랜치의 결과다. **운영 `research/genie-188329`의 통합 패치를 교체하지 않았다.** 공통 담당 상태는 항상 [main ONBOARDING](https://github.com/ssapo/aoe2/blob/main/ONBOARDING.md)을 본다.

## 목적과 실제 변경

520592057 9:40 업그레이드 속도 문제는 다른 세션이 PC에서 이미 수정했다고 기록했다. 이를 중복 구현하지 않고, 다음 10:19 민병대 세 기의 묶음 이동 조사에서 필요한 입력을 남기도록 실제 Rust 소스를 수정했다.

- `genie-oracle/src/census.rs`의 기존 `OBJECT` JSON에 `motion`을 추가했다. 기존 시각·선수·개체 ID와 함께 현재 이동 속도, 기본 속도, 해당 선수 마스터의 기본 속도, 방향, 지역 속도 벡터, 경로 수, 대기 상태를 읽는다.
- 같은 JSON에 그룹 링크와 그룹 상태를 담는다. 멤버 ID 목록, 해당 개체의 멤버 인덱스, 계산된 형성 속도, 개별 이동 활성 상태, 그룹 최고/최저 속도와 잔여 속도 예산, 배정 자리의 위치·상태를 연결한다. **멤버 순서와 자리 순서를 같다고 가정하지 않는다.**
- `genie-core/.../groups/steer/to_slots.rs`의 기존 `FORMING_PASS`에 `member_ids`, 계산 전 예산, `wanted`, `dt`, `firstgap`, 각 멤버의 속도 입력(`member_tops`)·현재 위치·배정 자리 위치를 덧붙인다. 기존 `gaps[i]`·`speeds[i]`와 이 입력 배열들은 모두 `member_ids[i]`의 값이다.
- 계산식, 연산 순서, 게임 상태·난수 갱신은 수정하지 않았다. 새로운 의존성이나 실험 스위치도 없다. 기존 추적 환경 변수가 켜졌을 때만 실행되는 출력이다.

변경은 [eng10-group-diagnostics.patch](eng10-group-diagnostics.patch)에 별도 증분 패치로 보관한다. 전체 `sorted-lists-and-truth-trace.patch`를 이 파일로 덮어쓰면 안 된다.

## 로그를 읽을 때 구분할 것

- `motion.phase = post_update`: OBJECT는 갱신 뒤의 관찰이다. 같은 ms의 `FORMING_PASS`는 그룹 속도 계산 중에 찍힌다. 같은 시각이라고 두 출력의 갱신 단계를 같다고 단정하지 않는다.
- `base_speed`: 유닛이 복사해 가진 기본 속도. `speed`: 스프라이트 속도 배율 등을 반영한 유닛의 최고 이동 속도. `master_base_speed`: 해당 선수의 현재 마스터 값. 이들을 실제 이동 거리/초와 동일시하지 않는다.
- `forming_speed`: 그룹의 `forming_speeds` 저장값이다. 마지막 속도 계산 뒤 멤버 구성이 바뀌었다면 이전 값일 수 있다. 실제 계산 시점의 매핑은 FORMING_PASS의 `member_ids`로 확인한다.
- `position`·자리 위치는 **[x, y, height]**다. 이름에 `_xhy`가 붙은 내부 벡터는 **[x, height, y]**이며, `velocity_local_xhy`는 유닛/그룹 자체 좌표계의 값이다.
- `null`은 0이 아니다. 마스터·이동 파트·그룹·멤버·자리·계산값이 없을 때 다른 개체의 값으로 채우지 않는다. 그룹 링크가 남았으나 그룹 목록에서 찾을 수 없으면 링크 ID는 보존하고 snapshot만 null로 남긴다.

## 적용 및 실행

최신 PC 수정이 포함된 엔진 작업 폴더에서 먼저 로컬 변경을 보존하고 아래를 실행한다. 테스트한 오래된 전체 패치를 PC 최신 소스에 덮어쓰면 안 된다.

```sh
git apply --check /path/to/eng10-group-diagnostics.patch
git apply /path/to/eng10-group-diagnostics.patch
cargo check --locked -p genie-core -p genie-oracle --example census
cargo test --locked --profile research -p genie-oracle --lib census::movement_trace::tests
cargo build --locked --profile research -p genie-oracle --example census
```

`--check`가 실패하면 적용을 멈추고 최신 PC의 두 기존 파일과 진단 함수를 대조한다. 충돌을 무시하는 옵션으로 적용하지 않는다. `research` 프로필은 현재 연구 패치에 있다. PC 최신 패치의 프로필·검증 결과도 확인한다.

리플 실행에는 **최신 PC 수정 + 기존 기본 스위치 전체**와 188329 DAT·동반 표가 필요하다. 실행 인자는 기존 census와 같다. 민병대 ID와 갱신 구간을 먼저 알아낸 뒤, PowerShell에서 기존 환경 변수에 다음을 추가한다.

```powershell
$env:GENIE_TRACE_OBJECTS_RANGE = '<시작갱신>-<끝갱신>'
$env:GENIE_TRACE_OBJECT_IDS = '<민병대ID1>,<민병대ID2>,<민병대ID3>'
# 필요할 때만 추가. 이 출력은 위 OBJECT의 범위/ID 필터를 따르지 않는다.
$env:GENIE_TRACE_FORMING = '1'
```

OBJECT의 기존 필터 의미는 바꾸지 않았다. FORMING은 전체 그룹 로그가 많으므로 긴 재생에서는 먼저 OBJECT만 쓴다. 619.7초를 원인 발생 틱으로 단정하거나 초를 임의의 dt로 나눠 갱신 번호를 만들지 않는다.

## 확인 결과와 한계

- 기반: upstream `librematch/genie` `91d81be4` + 연구 스냅샷 `2aef3a21c6fef404be9e33456edb45b68cf4ac80`의 통합 패치. 패치 SHA-256 `82bbf6cf244138f6483d610407a8454b39eeed666db12e16403091609e2ece67`. 원격 연구 HEAD `1d36b5e`에서도 이 패치는 같았다.
- Rust 1.100.0 / Linux x86_64. 수정 전·후 `cargo check --locked -p genie-core -p genie-oracle --example census -j 3` 모두 성공했다. 수정 전부터 있던 genie-core 경고 16개는 그대로다.
- 진단 테스트 3개 통과: 멤버/자리 순서가 다른 경우의 ID 연결과 xyz 좌표 변환, 누락된 멤버/계산값, 그룹 링크만 남은 상태. 실제 Rust 진단 함수를 호출하는 합성 상태 검사이며 게임 재생 결과가 아니다.
- 최종 코드의 기존 census 검사 8개 + 새 진단 검사 3개, **총 11개 통과**. 명령: `GENIE_TRACE_OBJECTS_RANGE=0-6 GENIE_TRACE_FORMING=1 cargo test --locked --profile research -p genie-oracle --lib census:: -j 3`. 합성 리플/상태를 이용한 검사이며 대상 게임 리플 재생 검증은 아니다.
- 최종 실행 파일 링크까지 성공: `cargo build --locked --profile research -p genie-oracle --example census -j 3` (`Finished research`, 5.25초). 전체 엔진 단위 검사나 release 빌드는 실행하지 않았다.
- 증분 패치는 변경 전 파일에 `git apply --check`, 변경 후 파일에 `git apply --reverse --check` 모두 성공했다. 3파일, 187줄 추가·3줄 삭제. 증분 패치 SHA-256: `a3f2b294c48bdaa2e2b2329014e8497d7e93cf2afd7bbb6f8aea9312f95f7abf`.
- **대상 리플 재생·원본 메모리 대조·최신 PC 커밋 적용은 하지 못했다.** PC의 `76a5beb`·`7655e16`, 188329 DAT, 원본 기록은 이 세션에 없다. 이 패치로 619.7초 불일치가 해결되거나 사이트 검증 구간이 늘었다고 주장하지 않는다.

다음 담당자는 최신 PC 패치 위에 이 증분 변경을 대조·적용하고 10:15~10:25 구간의 세 개체를 추적한다. 기본 속도와 마스터 속도 → 그룹 계산 입력/출력 → 배정 자리 → 경로의 순서로 원본과 첫 차이를 좁힌다. 해당 자료 없이 직선 경로 근사 등을 원인으로 확정하지 않는다.
