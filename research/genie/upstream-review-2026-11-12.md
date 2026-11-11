# upstream genie 검토: 91d81be4 이후 108개 커밋 (2cac47b3, 2026-11-07까지)

작성 2026-11-11. 읽기만 함. PC에서는 아무것도 바꾸거나 빌드하거나 git으로 쓰지 않았다(PC에서는 `GIT_OPTIONAL_LOCKS=0`으로 status만 읽음).

## 0. 결론 먼저

- **커밋 하나씩 골라 가져오기(cherry-pick)는 사실상 안 된다.** 108개를 우리 포크(91d81be4 + 연구 패치)에 하나씩 얹어 보니 **98개가 충돌**했다. 깨끗이 붙은 10개는 전부 정리, 테스트, 메타데이터라 가져올 이득이 없다(62064c49 하나만 쓸모가 조금 있음). 원인은 중간에 있는 큰 이름 바꾸기 커밋들이다(T19 오류 타입 정리, T20 한 글자 변수 약 10,370개 이름 바꾸기, 필드 `pub(crate)` 전환, `UnitSide` 트레이트 삭제). 그 뒤 커밋은 모두 이 변경 위에서 쓰여서 문맥이 안 맞는다.
- **우리가 걸리는 멈춤 4개는 upstream도 아직 못 고쳤다.** "a helper that answers a call for help", "a horde's command (commandHorde)", "a farmer that found nothing after its drop-off (set_state 0xf3)", "an object of a stopped player may be near / its place is unknown" 문구가 HEAD에 그대로 있다. 과거 실행에서 본 "a queued move of an object that does not move", "a flight keeping away from a class", "an Enter whose building has no room (state 11)", "a stop on a patrol order", "an invalidated attack with retargeting off"도 HEAD에 그대로다(뒤 두 개는 우리 패치가 이미 원본 동작으로 바꿈).
- **upstream은 188329 작업을 하나도 안 했다.** 모든 커밋이 옛 빌드 158041(`FUN_14...` 주소, 158041 `.dat`)을 기준으로 하고, 검증도 158041 녹화 묶음("guard" 55개, "mismatch set" 557개 중 394개 불일치)으로 한다. 겹치는 것은 없다.
- **분석기 출력(자원별 실제 수입, 동물별 먹은 양·썩은 양)을 새로 만든 커밋도 없다.** 수입 관련은 내부 계산 정리뿐(310c047d 등, 1:1 사람 게임에서는 결과 같음).
- 그래서 권장: **지금은 rebase하지 말고 91d81be4 위에 머문다.** 쓸모 있는 몇 개(아래 "다시 검증하고 가져올 것")는 upstream 변경을 참고해 손으로 옮기고, 우리 방식대로 스위치로 감싸 3개 리플에서 확인한다. upstream이 나중에 우리 멈춤을 고치면 그때 "우리 패치를 upstream 최신 위로 옮기기"(아래 4절, 충돌 덩어리 약 54개)를 한 번에 한다.

## 1. 108개 커밋이 한 일 (주제별)

1. **정리·리팩터링 (약 60개, 동작 변화 없음)**: T8(테스트용 가짜 `UnitSide`를 없애고 진짜 world로 테스트), T13(world 로드를 genie-core로 이동, 크레이트 메타데이터), T16(derive로 바꾸기), T17(검사 결과 넘겨주기), T18(파일 개수 상한 4096), T19(모든 오류를 `GenieError`/`GenieResult`로), T20(한 글자 이름 약 10,370개 → 긴 이름, clippy 규칙으로 금지), C-STRUCT-PRIVATE(필드 1,378개 `pub(crate)`), V-01~V-15, G-03~G-05(상수, `expect` 제거, 전역 상태 제거) 등. 이것들이 충돌의 원인이다.
2. **전투 포팅 (158041 기준)**: stinger(화상·감속), powerup·aura, 돌진(charge), 처치 점수, 체력 변환, 근접 타격, slot 0x208 최고 속도, 경계 대상(alert object), 재장전 시간. 자원과는 거의 무관.
3. **수비대·건물**: 건물 안 주민·약탈자 수, 유물·가축 수(문화 플레이어), 유닛을 태운 유닛의 출입, 내보내기(let-out)의 집결점 작업 찾기, 생성 위치 탐색의 바깥 고리, 자리 없으면 생산이 5초 기다림, 건물 안 유닛 치료·주민 수리, 속도 올림 건물(속성 255).
4. **경제**: slot 0xf8 자원 더하기 정리(컴퓨터 escrow, 동맹 공유), 수도원 유물 금, 농장 보너스(폴바르크), 목초지(pasture) 식량, ClosestObject의 일꾼 상한·미완성 농장·목초지, 사냥 중 찾은 농장으로 가기.
5. **명령·이동 세부**: slot 0x128 인자 순서 수정(재타겟 금지 바이트), 마스터 속도 slot 0xe8를 읽는 8곳, 업그레이드 때 액션의 작업(task) 교체, 새 유닛의 기본 작업, 장애물 관리자 무시 목록(ignore list), 정지된 플레이어 판정 범위, 결정성(HashMap 금지).
6. **포맷 크레이트**: 모르는 값은 실패 대신 보존(62064c49), 언어 파일 순서.

## 2. 시험 방법

- 컨테이너에 worktree `/home/claude/wt-fork` = 91d81be4 + 우리 패치(CRLF 제거 후 깨끗이 적용, PC에만 있던 새 파일 `genie-core/src/correction.rs` 포함, 한 커밋 `4bc28e33`로 묶음). `cargo check --ignore-rust-version`(컨테이너 rustc 1.97, 저장소 요구 1.99)로 genie-core·genie-oracle 컴파일 통과 확인.
- 108개를 하나씩 이 위에 cherry-pick: 깨끗 10, 충돌 98. 깨끗한 것: 6a96bd41, 235281ba, 5810efc0, 0718d228, 394dcaf6, 910cd74c, 62064c49, 68d84c9e, 2de29843, 06f9e944. 62064c49는 얹은 뒤 workspace 전체 `cargo check` 통과.
- 반대로 우리 패치를 upstream 여러 지점 위에 얹어 봄(4절).
- 우리 실행 기록(PC `runs\*.out/err`, 연구 폴더 로그)에서 실제 멈춤 문구를 모아 upstream HEAD와 대조. 그리고 base와 HEAD 사이에 사라진 `unsupported` 문구 57개를 커밋별로 짝지음.

## 3. 가져올 목록 (우리에게 값어치 순)

"충돌"은 우리 포크에 그 커밋 하나만 얹었을 때 충돌 파일 수 / 충돌 덩어리 수. "우리 파일"은 우리 패치가 고친 파일과 겹치는지.

### 3.1 지금 가져와도 안전 (검증 결과가 바뀔 수 없음)

동작을 바꾸지 않거나, 예전에 무조건 멈추던 경로만 바꾸는 것. 우리 3개 리플 실행은 이 멈춤들에 걸린 적이 없으므로 지금까지 맞춘 숫자는 그대로다. 대신 더 긴 판, 다른 문명, 성 시대 이후 판에서 멈추지 않게 해 준다.

| 순위 | 커밋 | 내용 | 왜 도움 | 충돌 | 우리 파일 |
|---|---|---|---|---|---|
| 1 | bd182531 + 1333c40f | 수도원에 유물이 있으면 매 초 금(자원) 지급 | 기존엔 유물 든 수도원이 있으면 그 선수가 멈춤("a monastery's relics' goods"). 금 수입 계산에 직접 필요 | 7파일/8덩어리 | 아니오 |
| 2 | 5617e484 | ClosestObject 일꾼 상한·미완성 농장 검사, 사냥꾼 검색이 농장을 찾으면 그 농장으로 | 기존엔 이런 대상을 만나면 멈춤. 성 시대 농장 전환 구간에서 걸릴 수 있음 | 5/5 | `unit_ai/update.rs` 겹침(AI_ORDER) |
| 3 | 3ff14783 + de226d5a, 5782bd01, 0f104160 + f530d2b6 | 건물 안 주민·약탈자·유물·가축 수, 유닛 태운 유닛 출입 | 기존 멈춤 4종 제거. 단 0f104160은 들어가기(Enter) 자리 검사 계산도 바꿈(태운 유닛 수 포함) → 주민만 들어가는 보통 경우는 같음 | 8/12, 15/27, 16/32 | `garrison/let_out.rs`, `garrison/unit.rs` 겹침 |
| 4 | 7f4bc8d5 + fe37a844 + 7aa1789e | 건물 안 치료, 안에 든 주민의 수리 | 기존 멈춤 제거(배 치료 비용 포함) | 10파일 충돌 | 아니오 |
| 5 | 961ce91e, 12f97a99 | 속도 올림 건물(속성 255), 수송선 정지 | 기존 멈춤 제거(문명·물 맵 한정) | 19 / 2파일 충돌 | 961ce91e 1개 |
| 6 | 62064c49 | 포맷 크레이트: 모르는 값·명령 id를 실패 대신 보존 | 아직 안 돌린 리플(519686090 등)에 새 명령이 있어도 읽기 실패 안 함 | **깨끗, 컴파일 통과** | 아니오 |

모두 1~5는 손으로 옮겨야 한다(이름 바뀐 문맥 때문). 값어치가 큰 것은 1, 2. 나머지는 해당 상황이 나오는 리플이 생기면 그때.

### 3.2 다시 검증하고 가져올 것 (평상시 동작이 바뀜 → 스위치로 감싸고 3개 리플 재확인)

| 순위 | 커밋 | 내용 | 왜 도움 | 충돌 | 우리 파일 |
|---|---|---|---|---|---|
| 1 | c050b687 (중 slot 0x128 인자 부분만) | 작업 명령(slot 0x128)의 6·7번째 인자를 genie가 거꾸로 읽음. 마지막 바이트는 "재타겟 금지"(`+0x1d6`) 겸 "든 자원 검사". base는 유닛 AI가 스스로 내는 작업(WorkOn: 자동 공격, 지은 농장·목초지로 바로 일하기, 사라진 대상 대신 가까운 자원 찾기), 마차, 경종 복귀에 1을 넘겨, **AI가 시작한 모든 공격에서 재타겟을 끄고**, 주민이 다른 자원 작업으로 바뀔 때 든 자원을 지움. 게임은 0 | 우리 멈춤 "an invalidated attack with retargeting off"(패치로 우회), 이후의 "call for help", "commandHorde"가 모두 AI 전투 구역이라 원인 후보. 경제 쪽도: 나무를 든 주민이 농장을 짓고 바로 농사로 갈 때 든 양 처리 | 커밋 전체는 76파일/131덩어리 → **필요한 부분만 손으로**(호출 지점 약 10곳: `objects/unit/stop.rs` WorkOn, `groups/update/{send,release}.rs`, `orders/town_bell.rs`, mule cart, `orders/work.rs`) | `orders/moves.rs`, `unit_ai/actions.rs`와 같은 주제(우리 22번 수정과 맞물림). 넣기 전에 188329 `0x1140670` 꼬리(우리 unsupported-stops 문서의 setter caller 1)에서 인자 순서를 직접 확인 |
| 2 | aefb2c22 (무시 목록 부분) | 직선·근접 검사(`FUN_14114cc60`)가 장애물 관리자 무시 목록을 "자기 유닛 + 대상"으로 바꿔 두고, 뒤따르는 웨이포인트·MoveTo 검사가 그 목록을 읽음. genie는 안 바꿨음 | 걷기 경로 차이. upstream 녹화에서 3명 개선, 악화 0. 우리 미해결 383.4초 나무꾼 짧은 경로 모양, 518470161 60.7초·517426097 230.4초 위치 불일치 후보 | 4/3. 동작 부분만 떼어 우리 포크에 얹어 **라이브러리 컴파일 통과**: `/home/claude/re-env/aefb2c22-ignore-list-port.patch`(테스트 파일 `map/spatial/tests.rs`의 `segment_blocked` 호출 5곳은 인자 하나 빼야 함, 스위치 없음) | `movement/move_to/mod.rs`, `movement/waypoint.rs`, `map/spatial/{mod,search}.rs`, `gathering/hunt/unit.rs` 겹침. 188329 해당 함수 확인 필요 |
| 3 | 8c327a9d | 새 유닛이 마스터의 기본 작업으로 시작(slot 0x7f0), NoAttack 병사 검색 멈춤 제거 | 158041 `.dat`에선 결과 같다고 하지만 188329 `.dat`는 다를 수 있음 | 5/6 | `production/spawn/new_unit.rs` 겹침(SPAWN) |
| 4 | 42229f60 | 이동·작업·건설·수리·배치 명령 8곳이 마스터 속도 `+0x740`(스프라이트 배율 전)을 읽음 | 원본과 같은 값 사용. 주로 "속도 0인가" 판정이지만 값이 바뀜 | 13/23 | `orders/moves.rs` 겹침 |
| 5 | 58a360a6 + 6aaee718 | 업그레이드·스프라이트 변경 때 각 액션의 작업(task)을 새 마스터 것으로(사냥·채집·건설·수리·수송·탐험·입장) | 유닛 업그레이드 뒤 채집 스프라이트·작업 값이 원본과 맞음 | 24·11파일 충돌 | 일부 |
| 6 | bcaf682f + 02d0a14e + ce85d544 | 생성 위치 바깥 고리, 자리 없으면 생산 5초 대기, 내보내기 실패 시 그대로 둠, 집결점 작업 찾기 | 우리 SPAWN_188329가 자리 못 찾을 때의 뒤처리로 쓸모. 단 고리 탐색 자체는 158041식이라 우리 188329 탐색과 겹침 | 11파일, 8파일 충돌 | `production/spawn/{search,objects,new_unit}.rs`, `garrison/let_out.rs` 크게 겹침 → 뒤처리 부분만 |
| 7 | 310c047d + 083ac1ac | 자원 더하기(slot 0xf8) 일원화: 컴퓨터 escrow, 동맹 공유 | 팀전 리플에서 "a load given to a player with allies" 멈춤 제거. 1:1 사람 게임은 결과 같음 | 36파일 충돌 | `production/spawn/{new_unit,objects}.rs` 등 3개 |
| 8 | 3ec010f5 + 2cac47b3, d0bda7b3 + 0eba9482 | 목초지 식량, 폴바르크 농장 보너스 | 해당 문명 판에서만. 목초지는 식량 수입에 직접 영향 | 5~9파일 충돌 | 아니오 |

### 3.3 건너뜀 (이유)

- **정리·리팩터링 약 60개**(T8, T13, T16~T20, C-STRUCT-PRIVATE, V-xx, G-xx, 메타데이터, CLAUDE.md 무시): 동작 변화 없음. 전체를 upstream 최신으로 옮길 때만 자동으로 따라온다.
- **전투 포팅**(1fdf59a0, 3c6ba61d, 49222223, c4228347, 6caaab7c, 46e5a37c, fbd2f016, 6cb6efd6, 86236580, f7a41ce7, a394730e, 5e6ca7ee, 2535e50c, 9b339e10): 자원 정확도와 거의 무관, 충돌 큼. 전투 구간이 자원을 틀리게 만드는 게 확인되면 다시 본다.
- **1f55bb8d**(정지된 플레이어 판정 범위 넓힘): 우리 두 번째 멈춤 "an object of a stopped player may be near"를 **더 일찍** 나게 만든다. 첫 멈춤 뒤에만 의미가 있어 도움 안 됨.
- **adfce951**(HashMap 금지): base에서 HashSet/HashMap은 조회용이라 결과가 안 바뀜.
- **49ed8913, 8d775dc0**(보이는 유닛 검색의 NaN·이상 관계값): upstream 녹화 0개 변화. 경계 사례.
- **568ecefd, 3e10b352**(저장 파일의 개체 고유 마스터): 중간 저장에서 시작할 때 필요. 우리는 리플 처음부터 돌려 해당 없음. 사냥이 썩기를 멈출 때 쓰는 값도 숫자는 같음.
- **a8d265b6**(눈 깃발), **64c00837**(기술 의존 카운트), **c7a14a6b**, **0ac43910**, **06f9e944** 등: 자원과 무관.

## 4. 대안: 우리 패치를 upstream 위로 옮기기

우리 패치(한 커밋)를 upstream 각 지점 위에 얹은 결과(충돌 파일 수):

| upstream 지점 | 충돌 파일 |
|---|---|
| 6a96bd41 (첫 커밋) | 0 |
| 7f56140a (`UnitSide` 삭제) | 2 |
| 07fa81a1 (T19 시작) | 6 |
| 6e31f9e0 | 12 |
| 79f32281 (T20 이름 바꾸기) | 25 |
| 4ecd64ec ~ 0827f97c | 28 |
| 2cac47b3 (HEAD) | 30파일, 충돌 덩어리 54개 |

HEAD에서 가장 많은 곳: `short_path/main_loop.rs` 6, `unit_ai/unit.rs` 5, `unit_ai/idle_animals.rs` 5, `unit_ai/actions.rs`·`movement/request_plans.rs`·`hunt/unit.rs`·`genie-import/install.rs` 각 3. `unit_ai/world_view/side.rs`는 upstream에서 삭제됨(우리 GRAZE·EVADE 추가분 74줄을 `UnitView` 쪽으로 옮겨야 함). 충돌 없는 부분도 우리 새 코드가 옛 짧은 이름·`Result<_, GenieError>`·`pub` 필드를 써서 컴파일 오류가 추가로 날 것이다. 옮긴 뒤 스위치 12개 전부를 3개 리플에서 다시 확인해야 한다(upstream 동작 변경이 같이 들어오므로 숫자가 바뀔 수 있음). 대략 하루~이틀 작업. upstream이 우리 멈춤을 고치기 전까지는 할 이유가 약하다.

## 5. upstream의 188329 작업

없음. 코드·커밋에서 188329, 새 저장 버전 지원, 빌드 분기 흔적이 없다. 문서 주석은 전부 "build 158041". 우리 패치의 genie-save(188329 저장 형식), genie-import(civilizations.json, 음수 task 그룹), 실험 스위치 12개는 upstream과 겹치지 않는다. 다만 upstream의 158041 포팅 중 일부(3.2의 1, 2)는 188329에서도 같을 가능성이 높은 "genie 쪽 실수 수정"이라, 188329 원본에서 한 번 확인하고 넣으면 된다.

## 6. 남긴 것 (컨테이너)

- `/home/claude/wt-fork`: 91d81be4 + 우리 패치(커밋 4bc28e33, 브랜치 `review-fork`). 컴파일 확인용.
- `/home/claude/wt-up`: upstream 시험용 worktree(분리 HEAD).
- `/home/claude/re-env/aefb2c22-ignore-list-port.patch`: aefb2c22 동작 부분만, 우리 포크 기준(라이브러리 컴파일 통과, 테스트 파일 미수정, 스위치 없음).
- 아무 데도 push 안 함. PC 파일 변경 없음.
