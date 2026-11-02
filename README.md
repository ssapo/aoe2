# AoE2 리플 분석 — ssapo

ssapo 계정의 1v1 경기 기록과 공개 리플을 자동 수집하는 개인용 웹앱.

- 게임 서버 프로필 ID: `26260702`
- AoE2 Insights 사용자 ID: `13810994`
- 프로필: https://www.aoe2insights.com/user/13810994/

두 ID는 서로 다름. 이전에 공유한 경기 `516293031`, `516495787`에서 ssapo의 Insights 사용자 링크와 리플 다운로드 profileId를 확인했고, 게임 서버 API에서 닉네임 ssapo를 재확인함.

계정 선택·가입·프로필 입력 없음. 접속하면 저장된 ssapo 경기 목록을 바로 표시.

## 배포

1. GitHub에 `ssapo/aoe2` 공개 저장소 생성. 기본 브랜치 `main`.
2. 이 폴더의 파일·폴더를 저장소 최상위에 업로드. `.github/workflows/update.yml` 포함. ZIP 자체를 업로드하는 방식은 작동하지 않음.
3. `Settings → Pages → Source`를 **GitHub Actions**로 설정.
4. `Actions → Collect matches & deploy → Run workflow` 실행. 계정 입력 불필요.
5. 배포 성공 후 Pages에 표시된 주소 확인.

예정 주소: `https://ssapo.github.io/aoe2/`. 주소 표기만으로 배포 완료를 의미하지 않음.
`.aoe2`는 공개 DNS의 등록된 최상위 도메인이 아니므로 `ssapo.aoe2` 사용 불가.

공개 저장소의 GitHub Pages·표준 Actions runner 기준 무료. 유료 AI API·도메인·별도 서버 미사용. 게임 닉네임과 분석 결과는 공개됨. 채팅·원본 리플·Steam ID·토큰은 게시하지 않음.

## 동작

- 매시 17분·47분에 새 경기 확인. 실행 지연·누락 가능.
- 본인 계정의 1v1 완료 경기만 수집. 최대 200개 저장.
- 실행당 새 경기·실패 경기 최대 5개 분석. 실패한 경기는 최대 3회 재시도.
- 경기 선택 시 명령 기록과 한국어 피드백 표시. 리플 다운로드·Insights 링크 제공.
- 열린 페이지는 2분마다 저장된 결과 갱신. 새로고침 버튼은 수집 실행 버튼과 다름.
- 수집 오류 시 이전 성공 데이터 유지.
- 60일간 저장소 활동이 없으면 예약 실행 중지 가능. Actions에서 재활성화.

## 분석 범위

지원: 건설·생산·연구 명령 타임라인, 시대 전환 **명령 시점**, 파서 eAPM, 1v1 상대와 전환 명령 시점 비교.

명령은 실제 완료와 다름. 취소·자원 부족·파괴·게임 상태를 시뮬레이션하지 않음. TC 유휴시간·실제 자원·교전 손실·패인의 인과관계는 계산하지 않음. 시대 전환이 늦다는 사실만으로 실수라고 단정하지 않음.

공개 리플 미제공·만료·패치 호환 실패 시 기본 경기 기록만 표시. AI전·비공개 경기와 과거 모든 경기의 확보는 보장하지 않음.

## 로컬 실행

Python 3.12 이상 권장. 별도 가상환경에서 실행.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/patch_parser.py
python -m unittest discover -s tests -v
python scripts/collect.py --limit 5
python -m http.server 8000 --directory site
```

브라우저: `http://localhost:8000`. 방문자의 Python 설치 불필요. 배포 후 분석은 Actions에서 처리.

`mgz==1.8.51` 호환 문제는 upstream PR #139의 빠른 파서 수정으로 대응. 고정 버전을 확인하고 적용하며 원격 코드를 실행할 때마다 다운로드하지 않음. 출처·라이선스는 `THIRD_PARTY_NOTICES.txt` 참고.

## 파일

- `site/`: HTML·CSS·JS·수집한 보고서 JSON
- `config.json`: 고정 계정·1v1 필터
- `scripts/collect.py`: 수집·분석
- `scripts/patch_parser.py`: 파서 호환 수정
- `.github/workflows/update.yml`: 수집·배포 예약
- `tests/`: 수집 오류·프로필 ID 구분·압축파일·명령 시점·데이터 보존 검사

별도 `SSAPO_AoE2_preview.html`은 저장 시점의 경기 데이터를 포함한 단일 HTML. 로컬 파일은 최신 결과를 자동 수집하지 않음. 자동 갱신은 전체 소스를 배포한 사이트에서 동작.

참고: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [예약 실행 제한](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [mgz](https://github.com/happyleavesaoc/aoc-mgz), [호환 수정](https://github.com/happyleavesaoc/aoc-mgz/pull/139), [IANA](https://www.iana.org/domains/root/db).
