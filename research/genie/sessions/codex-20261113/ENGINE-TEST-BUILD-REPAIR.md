# 엔진 후보 1: 단위테스트 빌드 복구

2026-11-13 / Codex. **완료: genie-core 라이브러리 단위테스트 2,061개 통과, 실패·무시 0개.**

기준은 GitHub `research/genie-188329`의 `1d36b5e`, upstream `91d81be4`와 통합 패치 SHA-256 `82bbf6cf244138f6483d610407a8454b39eeed666db12e16403091609e2ece67`이다. 결과는 `codex/engine-test-build-repair-20261113` 검토 브랜치에 보관한다. 공통 작업 상태는 main ONBOARDING을 따른다.

## 변경과 확인

수정은 **테스트 파일 두 곳만**이다. 테스트 삭제·무시 또는 엔진 실행 규칙 변경은 없다.

1. `groups/layout.rs`의 기존 검사: `FormationLine.spacing_half` 초기화 누락 두 곳을 보완했다. 0.75를 넣고 clear/reset 뒤에도 보존되는지 검사해 기본값 0으로 덮어쓰는 오류를 잡도록 했다.
2. 처음 전체 실행에서는 **2,059개 통과·2개 실패**했다. 두 실패 모두 기존 연구 패치의 AI 변경을 기존 검사가 반영하지 못한 데서 나왔다.
   - `action_invalidated`: GitHub 구현은 대상이 사라졌으면 `retarget_disabled`를 비우고 진행한다(`actions.rs`의 188329 `0xd3578a` 주석). 예전 미지원 오류 기대를 실제 처리 결과·대상 제거·플래그 0 검사로 바꿨다. 컴퓨터 선수의 미지원 오류 검사는 유지했다.
   - `stop_with`: 순찰/공격 이동 종료 시 조정 타이머 750은 기본 타이머에서 다시 뽑는다. 기존 합성 유닛은 기본 타이머 0이라 나머지 연산에서 패닉했다. 해당 사례에 기본 타이머 1000을 주고 재추첨 범위 750~1249 및 원래 검사하던 '유닛 위치 없음' 오류를 명시적으로 확인했다.
3. 전체 재실행 **2,061개 통과**. 이어 GitHub 패치만 적용한 별도 소스에 이번 수정만 적용해 다시 실행했고 **2,061개 통과**했다. 이전 로그 확장 패치는 이 최종 검증 소스에 없다.

```sh
cargo test --locked --profile research -p genie-core --lib -j 3
```

환경: Linux x86_64, Rust 1.100.0. 기존 경고는 남아 있다. 범위는 genie-core의 라이브러리 단위테스트이며, 전체 workspace 검사·실제 리플 정확도 검증을 의미하지 않는다. 남겨 둔 실행 없음.

## 전달물

- `research/genie/sorted-lists-and-truth-trace.patch`: 이번 테스트 수정을 포함한 통합 패치. SHA-256 `55cf0975bf04f7f7ecb2f67d122ace207b4f2ad31a6bd2405c1f174bd0f14cd3`.
- [engine-test-build-repair.patch](engine-test-build-repair.patch): 기존 GitHub 연구 패치 위에 적용하는 이번 변경만의 증분 패치. 2파일, 17줄 추가·8줄 삭제.
- 통합 패치를 upstream의 별도 Git index에 적용한 결과가 최종 검증 소스와 완전히 같은지 `git diff --exit-code`로 확인했다. 실제 소스의 `git diff --check`도 통과했다. 패치 파일의 빈 문맥 줄에 있는 공백은 unified diff 형식이다.

기존 '엔진 단위테스트는 컴파일되지 않는다'는 기록은 이 수정 전 상태다. GitHub의 반영 브랜치를 확인하고 이번 결과와 구분한다. 다음 엔진 작업에서는 이 검사를 회귀 검증에 사용할 수 있다.
