# AGENTS.md — 이 저장소에서 일하는 AI 작업자(Claude Code, ChatGPT Codex 등) 공통 안내

도구에 상관없이 같은 규칙을 따른다. Claude Code는 `CLAUDE.md`를 통해 이 파일을 읽는다.

먼저 [ONBOARDING.md](ONBOARDING.md)를 끝까지 읽는다(공통 작업 상태·맡을 일·규칙의 기준). 맡은 일이 엔진이면 연구 브랜치 `research/genie-188329`의 `research/genie/CONTINUE.md`(13.4가 최신 인계, 2.1 현황, 12.5 남은 일)를 읽는다. 화면·수집기 일은 [DEVELOPMENT.md](DEVELOPMENT.md)의 해당 절.

## 꼭 지킬 것 (사용자 규칙)

- 커밋 작성자는 작업한 AI 이름으로: Claude는 `Claude <noreply@anthropic.com>`, Codex는 `Codex <noreply@openai.com>`(예: `git -c user.name="Codex" -c user.email="noreply@openai.com" commit ...`). **사용자의 회사 메일을 작성자로 쓰지 않는다.**
- 사용자와는 한국어 반말, 결론 먼저, 쉬운 말. 큰 변화는 그때그때 알린다.
- main: 검사를 통과한 커밋은 충돌이 없으면 묻지 않고 push(push 전 `git fetch` + rebase, 진행 중인 Actions 실행이 없는지 확인). 연구 브랜치도 묻지 않고 push하고 무엇을 올렸는지 알린다. 강제 push·충돌은 멈추고 묻는다.
- 시작할 때 ONBOARDING 표에 담당 행을 「진행 중」으로 올리고, 끝나면 결과·검증 범위·다음 동작을 적어 「완료」로 바꾼다.
- 여러 AI가 같은 저장소에서 일한다: 시작 전에 ONBOARDING 표의 「진행 중」 행과 원격 최신 커밋을 확인하고, 겹치면 시작하지 않는다.
- 엔진 소스(`C:\Users\ssapo\genie-replays\genie`) 수정·빌드는 한 번에 한 세션만. 동시에 띄우는 도우미는 적게(사용 한도).
- 게임 원본 파일(EXE·DAT·표), 리플, 메모리 기록, 디컴파일 결과는 공개 저장소에 올리지 않는다. 게임 데이터는 비공개 저장소 `ssapo/aoe2-data`에만. 토큰 값은 채팅·로그·커밋에 남기지 않는다.
- 게임 메모리는 읽기만. 원본 기록기는 게임이 도는 그 PC에서, 사용자가 게임을 켠다고 말한 뒤 띄운다.
- **화면 규칙(11-17)**: 모든 경기에서 같은 칸이 같은 순서로 보여야 한다. 데이터가 없으면 칸을 숨기지 말고 이유를 한 줄로. 화면을 고치면 `tests/browser/tabs_scroll.mjs`를 돌리고, 배포 뒤 공개 사이트를 실제 크기로 찍어 보여 준다.

## PC 폴더 (`C:\Users\ssapo\genie-replays`)

`aoe2-main`(main 작업 사본/worktree) · `aoe2-push`(연구 브랜치 사본) · `genie`(엔진 소스, 연구 패치 적용) · `runs`(실행·도구·결과, 기본 스위치 `runs\M6_envs.txt`, 기본 실행 파일 `runs\census_base.exe`) · `truth`(원본 메모리 기록, 기록기 `truthlog7.ps1`, `runs\truthlog8.ps1`) · `aoe2-data`(비공개 게임 데이터 사본) · `re-kit`(원본 코드 읽기 환경 재료) · `<경기번호>\`(리플).

## 검사

`python -m unittest discover -s tests` · `node --test tests/*.cjs` · 화면: `node tests/browser/tabs_scroll.mjs [site 경로]`(Playwright 필요).
