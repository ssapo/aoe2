# AGENTS.md — 이 저장소에서 일하는 AI 작업자(Claude Code, ChatGPT Codex 등) 공통 안내

도구에 상관없이 같은 규칙을 따른다. **규칙은 이 파일 하나에만 쓴다.** 도구별 시작 파일(`CLAUDE.md` 등)은 이 파일을 가리키기만 하고 자기 규칙을 가질 수 없다 — `tests/test_agent_docs.py`가 매 수집 실행에서 검사한다. 다른 문서(ONBOARDING·DEVELOPMENT·연구 인계서)에도 특정 도구만 따르는 규칙을 쓰지 않는다.

먼저 [ONBOARDING.md](ONBOARDING.md)를 끝까지 읽는다(공통 작업 상태·맡을 일·규칙의 기준). 맡은 일이 엔진이면 연구 브랜치 `research/genie-188329`의 `research/genie/CONTINUE.md`(13.4가 최신 인계, 2.1 현황, 12.5 남은 일)를 읽는다. 화면·수집기 일은 [DEVELOPMENT.md](DEVELOPMENT.md)의 해당 절.

## 꼭 지킬 것 (사용자 규칙)

- 커밋 작성자는 작업한 AI 이름으로: Claude는 `Claude <noreply@anthropic.com>`, Codex는 `Codex <noreply@openai.com>`(예: `git -c user.name="Codex" -c user.email="noreply@openai.com" commit ...`). **사용자의 회사 메일을 작성자로 쓰지 않는다.**
- 사용자와는 한국어 반말, 결론 먼저, 쉬운 말. 큰 변화는 그때그때 알린다.
- main: 검사를 통과한 커밋은 충돌이 없으면 묻지 않고 push(push 전 `git fetch` + rebase, 진행 중인 Actions 실행이 없는지 확인). 연구 브랜치도 묻지 않고 push하고 무엇을 올렸는지 알린다. 강제 push·충돌은 멈추고 묻는다.
- 시작할 때 ONBOARDING 표에 담당 행을 「진행 중」으로 올리고, 끝나면 결과·검증 범위·다음 동작을 적어 「완료」로 바꾼다.
- **멈출 때 인계(사용자 11-27)**: 일을 마치거나 멈출 때마다, 다른 AI(다른 모델·다른 PC)가 기록만 읽고 이어받아 같은 방향으로 갈 수 있는 상태로 둔다.
  1. 공용 기록에 지금 상태를 쓴다. 엔진은 연구 브랜치 `research/genie/CONTINUE.md`의 맨 위 「(가장 최신)」 문단에 다음을 적는다: 확인 끝난 최신 버전과 숫자(끝까지 맞는 경기 수·재현 비율), 빌드됐지만 확인 안 된 것, 이어서 돌릴 명령, 다음 할 일, 보류한 문제와 메모 위치. 자세한 내용은 `truth-log-findings.md`에 쓴다. 화면·수집기 일은 ONBOARDING의 해당 행에 적는다.
  2. 확인이 안 끝난 엔진 패치도 연구 브랜치 `research/genie/pending/`에 올린다(엔진 소스 diff만, 게임 데이터는 안 됨). 확인이 끝나면 지운다.
  3. 숫자는 실제로 돌린 확인 결과만 쓴다. 다른 세션이 보고한 숫자나 추정은 그렇다고 밝힌다.
  4. 세션 머릿속에만 있는 맥락(갈래 사본의 로컬 커밋, 추적 중인 단서)은 메모 파일로 남기고, 그 경로를 기록에 적는다.
- 여러 AI가 같은 저장소에서 일한다: 시작 전에 ONBOARDING 표의 「진행 중」 행과 원격 최신 커밋을 확인하고, 겹치면 시작하지 않는다.
- 엔진 소스는 사본마다 한 번에 한 세션만 고치고 빌드한다. 본 사본 `C:\Users\ssapo\genie-replays\genie`은 통합 담당 한 세션만. 병렬 엔진 작업은 따로 만든 사본(`genie-b` 등, 커밋된 R 패치에서 시작)에서 하고, 자기 변경분만 담은 패치로 넘겨 통합 담당이 합친 뒤 전체 세트로 확인한다(사용자 11-20 허락). 도우미는 필요한 만큼만(사용 한도).
- 게임 원본 파일(EXE·DAT·표), 리플, 메모리 기록, 디컴파일 결과는 공개 저장소에 올리지 않는다. 게임 데이터는 비공개 저장소 `ssapo/aoe2-data`에만. 토큰 값은 채팅·로그·커밋에 남기지 않는다.
- 게임 메모리는 읽기만. 원본 기록기는 게임이 도는 그 PC에서, 사용자가 게임을 켠다고 말한 뒤 띄운다.
- **화면 규칙(11-17)**: 모든 경기에서 같은 칸이 같은 순서로 보여야 한다. 데이터가 없으면 칸을 숨기지 말고 이유를 한 줄로. 화면을 고치면 `tests/browser/tabs_scroll.mjs`를 돌리고, 배포 뒤 공개 사이트를 실제 크기로 찍어 보여 준다.

## PC 폴더 (`C:\Users\ssapo\genie-replays`)

`aoe2-main`(main 작업 사본/worktree) · `aoe2-push`(연구 브랜치 사본) · `genie`(엔진 소스, 연구 패치 적용) · `runs`(실행·도구·결과, 기본 스위치 `runs\M6_envs.txt`, 기본 실행 파일 `runs\census_base.exe`) · `truth`(원본 메모리 기록, 기록기 `truthlog7.ps1`, `runs\truthlog8.ps1`) · `aoe2-data`(비공개 게임 데이터 사본) · `re-kit`(원본 코드 읽기 환경 재료) · `<경기번호>\`(리플).

## 검사

`python -m unittest discover -s tests` · `node --test tests/*.cjs` · 화면: `node tests/browser/tabs_scroll.mjs [site 경로]`(Playwright 필요).
