# 문서 이동 대조 기록 — 2026-11-13

사용자 요구: 다른 AI가 이전 대화 없이 README부터 읽어 기존 일을 선택할 수 있어야 하며, 문서를 나눌 때 원래 내용과 할 일을 빼먹거나 새 요약으로 대체해서는 안 된다.

이 문서는 **아래 특정 Git 기준점과 목적지**를 대조한 기록이다. 모든 과거 브랜치의 모든 문서를 대조했다는 뜻이 아니며, 원문에 쓰인 과거 실행 결과를 이번 세션에서 다시 검증했다는 뜻도 아니다.

## 원문과 현재 위치

| 원문 | 보존 위치·현재 연결 | 확인 결과 |
|---|---|---|
| main `52398a35f065f813d5228c449cf504ff36baeefe:README.md` | [원문 전체 스냅샷](archive/README-main-52398a3.md), 현재 [DEVELOPMENT.md](../DEVELOPMENT.md) | 원문 735줄 전체를 바이트 단위로 스냅샷 보존. 현재 개발 문서의 내용은 아래 대조 범위에서 동일. |
| 연구 `2aef3a21c6fef404be9e33456edb45b68cf4ac80:README.md` | [원문 전체 스냅샷](archive/README-research-2aef3a2.md), 연구 브랜치의 DEVELOPMENT.md | 원문 559줄 전체를 바이트 단위로 스냅샷 보존. 연구 브랜치만의 과거 Windows 안내도 남아 있음. |
| main README의 「현재 제한과 다음 작업 후보」 | DEVELOPMENT 같은 절, [공통 색인 APP-01~11](../ONBOARDING.md#task-index) | 원문 bullet **11개** 문구·순서와 절 내용이 동일. 과거 확인 기록과 제약을 미완료 과제로 바꾸지 않음. |
| 연구 CONTINUE의 기존 본문 | 연구 브랜치 `research/genie/CONTINUE.md` | 원래 `기준일:`부터 파일 끝까지 **내용·순서가 완전히 동일**. 맨 위 제목·공통 안내·새 조사 링크만 변경/추가. |
| 연구 CONTINUE 13.4 「열린 사례」 | 원문 그대로 유지, 공통 색인 ENG-01~09 | **9개 전부** 원문 순서로 연결. 선수·시각 전체·네 중단·일곱 문명 등 하위 범위도 원문 필독으로 지정. |
| 연구 CONTINUE 「사용자 결정 대기」 | 원문 그대로 유지, 공통 색인 DEC-01~03 | **3개 전부** 연결. 결정된 것으로 바꾸지 않음. |
| README 다른 절의 미결 과제·제약 | DEVELOPMENT 해당 절 그대로 유지, 공통 색인 REF-01~05 | 맵 이름 불일치, 상위권 비교 제약, 인구 추정 한계, 자원 출처 대조, Python 요약 계산 주의를 추가 연결. 새 과제가 아닌 원문 참조임을 명시. |
| 연구 CONTINUE 9절·12.5와 하위 목록 | 원문 그대로 유지 | 최신 목록 9개로 옛 세부 목록을 덮어쓰지 않음. 옛/최신 기준은 인계서에 표시된 구분을 따름. |
| 원래 `research/genie/` 파일 | 연구 브랜치의 같은 경로 | 기존 **213개 중 삭제 0개**. 현재 218개: 기존 파일 중 CONTINUE 안내만 수정, 새 조사·도구 5개 추가. |

## 스냅샷의 Git blob 일치

- main README 원문과 스냅샷: `8b2a2fd7c9c9714ff4ea515f568db23e665211b9`.
- 연구 README 원문과 스냅샷: `1d48246e42801cd365a7cd9fc44ae611c917f3f9`.

`git hash-object` 결과가 각 기준 커밋의 README blob ID와 같았다. 스냅샷은 원본 파일 그대로이므로 그 안의 상대 링크와 “현재/다음 작업”은 당시 기준이다. 실제 작업에는 최신 ONBOARDING과 해당 최신 지침을 사용한다.

## 실제 수행한 내용 대조

다음 네 비교가 모두 차이 없이 종료됐다(exit 0).

1. 원래 main README의 `### 사용자가 정한 방향`부터 끝까지 ↔ 현재 DEVELOPMENT의 같은 범위.
2. 원래 main README의 `## 현재 제한과 다음 작업 후보` 절 전체 ↔ 현재 DEVELOPMENT의 같은 절.
3. 원래 연구 CONTINUE의 `기준일:`부터 끝까지 ↔ 현재 연구 CONTINUE의 같은 범위.
4. 원래 연구 README의 `### 사용자가 정한 방향`부터 끝까지 ↔ 현재 연구 DEVELOPMENT의 같은 범위.

그 앞부분은 문서 제목과 시작 안내를 새 구조로 조정했다. main 기준으로는 작업 시작 절의 제목과 두 안내 문장이 공통 ONBOARDING을 가리키도록 바뀌었고, 소개·프로필 정보 등 기존 사실은 개발 문서와 원문 스냅샷에 남아 있다. 수정된 안내를 포함한 원래 글자 전체는 두 스냅샷에서 복원할 수 있다.

재확인 예시(저장소 루트, Bash):

```bash
git hash-object docs/archive/README-main-52398a3.md
git rev-parse 52398a3:README.md
git hash-object docs/archive/README-research-2aef3a2.md
git rev-parse 2aef3a2:README.md

diff -u \
  <(git show 52398a3:README.md | sed -n '/^### 사용자가 정한 방향/,$p') \
  <(sed -n '/^### 사용자가 정한 방향/,$p' DEVELOPMENT.md)

git fetch origin research/genie-188329
diff -u \
  <(git show 2aef3a2:research/genie/CONTINUE.md | sed -n '/^기준일:/,$p') \
  <(git show FETCH_HEAD:research/genie/CONTINUE.md | sed -n '/^기준일:/,$p')
```

기준 커밋이 없는 얕은 체크아웃에서는 먼저 해당 Git 이력을 가져와야 한다. 이후 다른 작업자가 본문을 갱신하면 비교 차이가 생기는 것은 정상이며, 새 변경의 근거와 원문 보존 여부를 별도로 검토한다.

## 앞으로 문서를 옮길 때

- 이동 전 기준 커밋·파일을 기록하고 전체 원문과 목적지를 대조한다.
- 원문 항목을 간추린 새 목록으로 교체하지 않는다. 색인은 원문 위치로 연결하고 원문 필독 여부를 적는다.
- 이전 기록·추정·확인된 결과·현재 미해결·사용자 결정 대기를 서로 바꾸지 않는다.
- 항목을 합치거나 지울 필요가 있으면 사유·이전 위치·결과를 남겨 추적 가능하게 한다.
