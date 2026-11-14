# ENG-12 records: findings 70-72, case note, CONTINUE (13.1 number, 12.2 row, 12.5 item, 13.4 top block). usage: python3 runs/E12_doc1.py <patch sha256> <patch bytes>
import sys
sha,size=sys.argv[1],int(sys.argv[2])
R='aoe2-push/research/genie/'
def rd(p): return open(p,'rb').read().decode('utf-8').replace('\r\n','\n')
def wr(p,t): open(p,'wb').write(t.replace('\n','\r\n').encode('utf-8'))
F=rd(R+'truth-log-findings.md').rstrip('\n')+'\n'
F+='''
## 70. 선수 속성 204: 다른 선수의 그 종류 건물 자리에 신호 개체를 만든다 (스위치 없음; ENG-12)

- 사례: 520219269(촉 P1 대 마푸체 P2). P2 update 1,758 / P1 1,836에서 "a player's attribute 204 (FUN_14152bcb0)"로 멈췄다. 엔진은 어느 선수든 속성 204가 0이 아니면 건물이 완공될 때 멈추게 돼 있었다. 마푸체는 시작 효과 1386("C-Bonus, Mapuche Vision")으로 속성 204 = 82(성 마스터)를 갖는다(DAT에서 속성 204를 쓰는 효과는 이것 하나).
- 원본(188329, 문서 `original-188329-reveal-attribute-204.md`): 월드 함수 0x15fec80. 속성 204를 정수로 자른 값 k가 0이 아닌 선수 a마다, 다른 선수 b의 개체 목록(+0x30)을 돈다. 두 선수의 관계 바이트(+0x180)가 서로 0이면(동맹) 표시를 지우고, 아니면 그 종류(k < 900 마스터 id, 900~999 클래스 k−900, 1000 이상 마스터 id)이고 완공된 건물(상태 2, 건설량 +0x900 ≠ 0)이며 a의 표시(+0x2d8의 비트)가 없는 개체마다: k > 0이면 **선수 a가 마스터 697(FLARE4, 10초 뒤 사라지는 신호)을 그 자리에 만들고**(선수 슬롯 0x1c8 = 0x16fd190, 맞은 쪽 신호 112와 같은 함수) 표시를 켠다. 부르는 곳: 건축가의 작업 0x1284670 끝(set_state(2) 뒤), 외교 변경 0x170ca30, 월드 읽기 0x160bfc0. 개체가 만들어질 때 도는 것(0x1247920)은 건물이 토대로 시작하면 아무것도 안 한다.
- 엔진: `players/diplomacy.rs` `World::reveal_units`를 원본대로 다시 썼다(표시는 `World::reveal_marks`, 신호는 `remains` + `made_new_object`). `construction/build/world_side.rs`의 건축 작업이 완공 뒤 이것을 부른다. `completion.rs`의 멈춤은 뺐고, 건물이 스스로 완공되는 길(`building_update.rs`)에는 속성 204가 있을 때의 멈춤을 남겼다(그 길의 원본은 안 읽음). k < 0(완전 공개, +0x2dc)과 건물이 아닌 종류는 멈춘다. 편집 스크립트 `tools/E12_edit1.py`.
- 결과(`E11c_V_520219269` → `E12a_V_520219269`): 멈춤 1,758 / 1,836 → P2 63,232("a player's attribute 204" — 남겨 둔 멈춤 쪽으로 추정, 안 봄) / P1 64,160. 맞는 체크포인트 3 / 3 → P1(촉) 17개, P2(마푸체) 8개. 첫 어긋남: P1 119.2초(단어 7·9), P2 60.7초(단어 7, +9). 단어 1(자원 합)은 P1 210.2초, P2 145.2초까지 같다. 기본 열한 리플(`E12a_*`)의 체크포인트 줄과 `.out` 끝 세 줄은 `E11c_*`와 바이트까지 같다(518239882 55 / 54, 멈춤 없음).
- 확인 못 한 것 / 추정: 이 판에서 신호가 실제로 만들어졌는지는 안 봤다(성이 서야 만들어진다; 어긋난 뒤라 값 대조도 못 함). 월드 읽기 때의 호출(0x160bfc0)은 안 넣었다(시작 상태에 그 종류 건물이 있으면 달라진다). 0x16fd190 끝의 "마스터 +0x121 깃발이면 선수마다 0x1355030" 부분은 안 읽었다(112 신호도 같은 함수라 기존과 같은 공백). 관계 바이트 +0x180은 0x17486e0(관계 쓰기)로 확인.

## 71. 포르투갈 선수의 단어 1 첫 차이 −1은 금 할인이 아니다 (고친 것 없음; ENG-12)

- 사례: 520352957 P1(포르투갈) 112.3초, 520282194 P2(포르투갈) 138.7초에 단어 1이 엔진 쪽 −1, 3~4 체크포인트 동안 그대로. 확인 V의 추정은 "금 할인 비용 반올림".
- 본 것(기존 실행 `V_p_520352957`, `V_p_520282194`의 RES·GAIN 줄): 그 체크포인트 앞에서 산 것은 주민뿐이다(식량 −50.0, 110.981초 / 116.688초; 금·나무·돌은 150 / 200 / 100에서 안 변함). 금을 쓴 적이 없으니 할인 계산은 관여하지 않았다. 차이가 생긴 구간의 수입은 520352957이 양 식량 내려놓기 넷(107.5~109.2초: 10.0, 8.09, 10.57, 11.96), 520282194가 멧돼지 식량 2.88 하나(133.5초)다 — 모두 일을 바꾸며 내려놓은 덜 찬 짐이라 양이 주민의 위치·시각에 달렸고, 두 선수 다 그 전에 위치가 이미 어긋나 있다(단어 7: 51.9초 / 15.2초). 기록 쪽 합은 엔진보다 0.38~1.38 / 0.96~1.96 많다.
- 결론: 문명 고유 계산의 증거가 없다. 앞선 위치 어긋남 뒤에 따라온 짐 크기 차이로 본다(추정 — 이 판들은 원본 메모리 기록이 없어 어느 내려놓기가 다른지는 못 가린다). 엔진은 안 고쳤다. 포르투갈 금 할인 자체는 이 구간에서 쓰이지 않아 **확인 못 함** 그대로다.

## 72. 뒤쪽 멈춤 셋은 안 넣었다 (고친 것 없음; ENG-12)

- 520162577 P1 57,289 "a farm's bonus near a master"(폴란드 폴바르크): 원본을 읽기 시작했다. 농장 보너스 주기 0x127e5a0(농장, 자원, 마스터, 양) — 마스터 < 0이거나, 선수가 그 마스터를 못 가졌거나(0x1728c10), **근처 판정 0x128b590이 참**이면 자원(0 이상, 속성 수 이하)에 양을 준다(선수 슬롯 0xf8에 1, 1). 완공 쪽 호출은 0x127ea40 안(0x127ee33), 다른 호출은 0x1283010(속성 237 ÷ 속성 36 × 양 — 농장 다시 심기로 추정). 근처 판정 0x128b590은 0xb7e바이트짜리 타일 번지기 탐색(농장 타일에서 시작, 타일마다 0x127dd40(농장, x, y, 마스터)로 개체를 찾아 이어 간다)이라 **한 갈래로 끝나지 않아 넣지 않았다.** 다음 첫 동작: 0x128b590을 끝까지, 0x127dd40을 읽는다.
- 519002991 P1 38,158 "a missed missile meeting another object than its target"(`combat/missile/unit.rs:266`), 520352957 가이아 48,495 "an attacker whose hits apply effects"(`combat/damage/taking.rs:323`): 엔진 쪽 멈춤 자리만 확인했고 원본은 안 읽었다(사용량 한도). 둘 다 첫 어긋남 뒤다.
'''
wr(R+'truth-log-findings.md',F)
N='''# Player attribute 204: a flare at the other players' buildings of a kind (session E12, 2026-11-14)

Build 188329, RVAs (image base 0x140000000). Decompiles were made in the cloud container
(`re/out_E12/a.c`, `b.c`) and are not kept; what was read is below.

## 1. Addresses

| what | address | engine |
|---|---|---|
| World pass over the kinds the players' attribute 204 names | 0x15fec80 | `players/diplomacy.rs` `World::reveal_units` |
| Same test for one object at its creation (called from the object setup 0x1264680, unit vtable slot 171, and from 0x125cb40) | 0x1247920 | not modelled (see 4) |
| Builder's work on a building; calls the pass after `set_state(2)` (slot 0xa8) | 0x1284670 (call at 0x1284b3e) | `construction/build/world_side.rs` (after `set_state`) |
| Diplomacy change; calls the pass at its end | 0x170ca30 (call at 0x170cb1f) | `World::set_diplomacy` |
| World load (world vtable 0x32e8948 slot 7); calls the pass once | 0x160bfc0 (call at 0x160fd7a) | not modelled |
| Player slot 0x1c8: make an object of a master at a place (the same function makes the hit flare 112, call at 0x12bbd81) | 0x16fd190 | `World::remains` + `World::made_new_object` |
| Set relation byte (`player+0x180[other]`) and unit kind (`+0x198`) | 0x17486e0 | `World::set_stance` |
| Mark test / set (`object+0x2d8`, bit per player) | 0x12473d0 / 0x12476b0 | `World::reveal_marks` |
| Marks cleared (`+0x2d8` bit, `+0x2dc` bit and bit 31) | 0x1247170, 0x1247190 | same |
| Second mark (`+0x2dc`) and slot 0x1e8, for a negative value | 0x12478d0 | not modelled (stop) |
| abs / sort of the kind (below 900: 0, 900 to 999: 1, 1000 up: 2) | 0xa82800 / 0x10baf30 | inline |

Player layout used here: attribute count `+0x90`, attributes `+0x98` (8 bytes each, obfuscated
float; 204 at `+0x660`), object list `+0x30` (array `+8`, count `+0x10`), relation bytes `+0x180`,
own number `+0x648`. World: players `+0x770`..`+0x778` (16 bytes each). Master: type `+0x08`, id
`+0x18`, class `+0x38`, a cache of the creation test `+0x1d4`.

## 2. The DAT side

Only one effect writes attribute 204: effect 1386 "C-Bonus, Mapuche Vision" (set, 82 = the castle
master). Master 697 is FLARE4: type 10, no hit points, attribute 12 = 10 running down by 1 per
second.

## 3. The world pass (0x15fec80)

Not in the editor's mode (4). For each player a of the world's list (Gaia first) with more than 204
attributes: k = attribute 204 cut to an integer; n = |k|; n = 0 does nothing. Sort of n: below 900 a
master id, 900 to 999 the class n - 900, 1000 and up a master id. For each other player b in the
list's order:

1. If `a.relation[b] == 0` and `b.relation[a] == 0`: every object of b loses a's marks.
2. Else each object of b's list, in order, that (is of that master id (`+0x18`) or class (`+0x38`))
   and (is no building, or is a building with build points `+0x900` not 0 and state 2) and has not
   a's mark: with k below 1 the second mark is set (0x12478d0) and, if the object's slot 0x198
   gives 0, 0x12420b0(object, player a, 0) runs; with k above 0 player a's slot 0x1c8 makes master
   0x2b9 (697) at the object's x, y, z with flag 0. Then a's mark is set (0x12476b0).

## 4. The test at an object's creation (0x1247920)

Runs only while the object's master cache `+0x1d4` is not 1. For the first player (not the owner,
relation byte not 0 either way) whose k is not 0: with the cache 0, an object that is not of the
kind, or is a building with build points 0 or not in state 2, or is marked already, sets the cache
to 1 and ends; else the cache becomes 2. With the cache 2: k above 0 makes the flare and sets the
mark; else the second mark and slot 0x1e8. A building starts as a foundation, so its master's cache
becomes 1 at its first creation and the test never acts for it; the engine does not model this
function and stops when the kind names objects that are no buildings.

## 5. Engine change

`World::reveal_units` follows section 3 for k above 0 (marks in `World::reveal_marks`, a map by
object id). k below 0 and a kind of objects that are no buildings stop the run. The builder's work
calls it after the completion; `complete_building` no longer stops. A building that completes by
itself (`construction/building_update.rs`) still stops when some player's attribute 204 is not 0:
that path's original was not read.

## 6. Not read

The tail of 0x16fd190 (a master's flag `+0x121`: each player that sees the tile gets 0x1355030 on
its `+0x220`); 0x12420b0; slot 0x1e8; the callers 0x1664f80 and 0x181d490 (they clear and set the
marks themselves); who resets the master cache `+0x1d4`; whether the marks are saved.

## 7. Farm bonus near a master (read in part, not implemented)

0x127e5a0(farm, resource, master, amount): gives the amount (player slot 0xf8 with 1, 1) when
(master < 0, or the player has not that master (0x1728c10), or 0x128b590(farm, master) holds) and
0 <= resource <= the player's attribute count; returns whether it gave. Callers: the completion
part 0x127ea40 (at 0x127ee33) and 0x1283010 (attribute 237 / attribute 36 x an amount). 0x128b590
(0xb7e bytes) is a flood fill over tiles from the farm's tile, asking 0x127dd40(farm, x, y, master)
per tile; not read to its end.
'''
wr(R+'original-188329-reveal-attribute-204.md',N)
C=rd(R+'CONTINUE.md')
def rep(old,new):
    global C
    assert C.count(old)==1,(old[:40],C.count(old)); C=C.replace(old,new)
rep('지금 마지막은 69번','지금 마지막은 72번')
rep('''
"근거" 열의 문서는 모두 이 폴더의''','''| (스위치 없음) 70 | 선수 속성 204(마푸체: 82 = 성): 건축가가 건물을 완공할 때와 외교 변경 때, 다른 선수의 그 종류 완공 건물마다 신호 개체(마스터 697)를 만들고 표시한다 | `players/diplomacy.rs` `reveal_units`, `construction/build/world_side.rs`, `World::reveal_marks` | `original-188329-reveal-attribute-204.md`, findings 70 | 실행 확인(520219269가 1,758 → 63,232까지; 신호가 실제로 만들어지는 경우는 못 봄) |

"근거" 열의 문서는 모두 이 폴더의''')
i=C.index('- (2026-11-14 세션 E11, 확인 V의 프로 경기 일곱')
C=C[:i]+'''- (2026-11-14 세션 E12; 실행 `E12a_V_520219269`) 520219269(촉 대 마푸체)는 속성 204를 넣은 뒤(findings 70) update 63,232(P2) / 64,160(P1)까지 돈다. **새 문명 둘의 첫 어긋남**: 마푸체 P2 60.7초 단어 7(엔진 −9), 67.2초 단어 9; 촉 P1 119.2초 단어 7·9. 단어 1은 P2 145.2초, P1 210.2초까지 같다. 첫 동작: `E5_go.sh <이름> 520219269 4700 "GENIE_TRACE_OBJECTS_RANGE=4000-4700"`으로 P2의 54~61초를 추적한다(원본 기록이 없으니 체크포인트 단어 7의 차이 9가 어느 개체인지는 `checkpoint_words.py`로). 남은 멈춤: P2 63,232 "a player's attribute 204" — 건물이 스스로 완공되는 길(`building_update.rs`)에 남겨 둔 멈춤으로 추정(안 봄; 그 길의 원본을 읽고 `reveal_units`를 부르면 된다). 포르투갈의 단어 1 −1은 금 할인이 아니다(findings 71). 뒤쪽 멈춤 셋은 안 넣었다(findings 72: 농장 보너스는 0x128b590 타일 번지기 탐색을 끝까지 읽어야 한다).
'''+C[i:]
i=C.index('**2026-11-14 낮, Claude (세션 E11 = ONBOARDING `ENG-11`')
C=C[:i]+'''**2026-11-14 저녁, Claude (세션 E12 = ONBOARDING `ENG-12`, ENG-11 뒤에 드러난 멈춤과 포르투갈 −1). 결론: 반쯤 하던 일 없음. ① 520219269의 "선수 속성 204" 멈춤을 원본대로 넣어 없앴다(findings 70, 문서 `original-188329-reveal-attribute-204.md`, 스위치 없음): update 1,758 → 63,232까지 돌고 체크포인트가 P1 17개, P2 8개 맞는다. ② 포르투갈의 단어 1 −1은 금 할인이 아니었다(findings 71: 그 앞에 금을 쓴 적이 없다; 덜 찬 짐 내려놓기의 크기 차이, 추정) — 고친 것 없음. ③ 뒤쪽 멈춤 셋은 안 넣었다(findings 72). 기본 열한 리플의 체크포인트 줄과 `.out` 끝 줄은 `E11c_*`와 바이트까지 같다(`E12a_*`; 518239882 55 / 54, 멈춤 없음) → 2.1 표 그대로. 로컬 커밋만 했고 푸시하지 않았다(사용자 확인 대기).**

- 엔진 소스 `genie`: 빌드됨(70 포함), 저장소 패치와 같음(sha256 LF `'''+sha[:8]+'…'+sha[-6:]+'''`, '''+format(size,',')+'''바이트, PC 사본 `runs\\E12.patch`; 만들기 `runs\\M6_mkpatch.ps1 -Name runs\\E12` 뒤 `python3 runs/M3_striplf.py runs/E12`). 새 스위치 없음 → main의 `engine/switches.env`·engine-check 기대값(55 / 54, no stop) 그대로. `runs\\census_base.exe` = 이 빌드(`runs\\census_E12a.exe`). 빌드 스크립트 `runs\\E12_build.ps1`은 cargo가 끝나도 `.done`을 못 쓰고 멈춰 있었다 — 로그 `runs\\E12_build.log`의 "Finished"를 보고 exe를 손으로 복사했다. 실행·비교는 E11과 같다(`E5_go.sh`, `E5_launch.sh`, `E5_EXE=census_E12a.exe`).
- 다음 사람이 바로 할 일: 12.5 맨 위 E12 항목.

아래는 그 전의 기록이다.

'''+C[i:]
wr(R+'CONTINUE.md',C)
print('ok')
