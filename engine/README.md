# 재시뮬레이션 엔진 (GitHub Actions용)

- 엔진: [librematch/genie](https://github.com/librematch/genie) (AGPL-3.0) 커밋 `91d81be4` + 이 저장소 `research/genie-188329` 브랜치의 `research/genie/sorted-lists-and-truth-trace.patch`. 고친 소스는 그 패치로 공개돼 있다.
- 게임 데이터(DAT)는 **비공개 저장소 `ssapo/aoe2-data`**에 있고, 워크플로가 저장소 비밀 `AOE2_DATA_TOKEN`(그 저장소 Contents 읽기 전용)으로 받는다. 이 공개 저장소·아티팩트·로그에 DAT나 그 변환본을 올리지 않는다.
- 비공개 저장소의 `188329/` 폴더에는 DAT와, 엔진이 DAT 옆에서 읽는 게임 표(`dropsites.json`, `civilizations.json`, `linkedTechs.json`, `linkedUnits.json`, `unitcategories.json`, `unitlines.json`)가 같이 있어야 한다. 표가 없으면 엔진이 초반(약 update 4,100)에 "a drop site that does not take the load"로 멈춘다.
- `switches.env`: 엔진 실행 환경 변수(빌드 188329용). 엔진 연구가 스위치를 더하면 같이 고친다.
- 대상 빌드는 188329 하나다. 다른 빌드의 리플에는 엔진 결과를 쓰지 않는다.
- `.github/workflows/engine-check.yml`: 빌드·데이터 받기·리플 하나 실행을 확인하는 점검용 워크플로(사이트 배포와 별개).
- 2026-11-13: 연구 브랜치 `research/genie-188329`를 `1de34ac`까지 올렸다(findings 56~60: 엔진 멈춤 셋을 원본 동작으로 대체, 업그레이드된 유닛의 이동 속도). 스위치와 점검 기대값(55 / 54)은 그대로다.
