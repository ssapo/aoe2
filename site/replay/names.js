// 엔진 재생 (APP-22): 자주 나오는 마스터의 표시 이름. DE 마스터 번호로 손으로 적은 작은 표이고, 게임 문자열
// 파일은 싣지 않는다. 표에 없는 마스터는 리플 헤더의 내부 이름(예: "VMBAS"), 그것도 없으면 "#번호".
'use strict';
const MASTER_NAMES = {
  // 장식 새: 하늘을 맴돌 뿐, 사냥·시야·경기 결과와 상관없음
  96: 'Hawk (장식)', 917: 'Vulture (장식)', 1305: 'Vulture (장식)', 2578: 'Raven (장식)', 816: 'Macaw (장식)', 1028: 'Stork (장식)', 2742: 'Flamingo (장식)',
  // 일꾼 (작업별 남/여)
  83: 'Villager', 293: 'Villager', 118: 'Builder', 212: 'Builder', 120: 'Forager', 354: 'Forager',
  122: 'Hunter', 216: 'Hunter', 123: 'Lumberjack', 218: 'Lumberjack', 124: 'Stone Miner', 220: 'Stone Miner',
  579: 'Gold Miner', 581: 'Gold Miner', 259: 'Farmer', 214: 'Farmer', 56: 'Fisherman', 57: 'Fisherman',
  156: 'Repairer', 222: 'Repairer', 590: 'Shepherd', 592: 'Shepherd',
  // 군사·기타 유닛
  448: 'Scout Cavalry', 751: 'Eagle Scout', 4: 'Archer', 24: 'Crossbowman', 7: 'Skirmisher', 6: 'Elite Skirmisher',
  74: 'Militia', 75: 'Man-at-Arms', 77: 'Long Swordsman', 93: 'Spearman', 358: 'Pikeman', 38: 'Knight',
  283: 'Cavalier', 329: 'Camel Rider', 39: 'Cavalry Archer', 5: 'Hand Cannoneer', 125: 'Monk',
  280: 'Mangonel', 279: 'Scorpion', 35: 'Battering Ram', 545: 'Transport Ship', 13: 'Fishing Ship',
  17: 'Trade Cog', 128: 'Trade Cart', 539: 'Galley', 1808: 'Mule Cart', 2550: 'Champi Scout',
  // 건물
  109: 'Town Center', 71: 'Town Center', 141: 'Town Center', 142: 'Town Center', 70: 'House', 12: 'Barracks',
  87: 'Archery Range', 101: 'Stable', 103: 'Blacksmith', 104: 'Monastery', 84: 'Market', 68: 'Mill',
  562: 'Lumber Camp', 584: 'Mining Camp', 45: 'Dock', 50: 'Farm', 72: 'Palisade Wall', 117: 'Stone Wall',
  79: 'Watch Tower', 199: 'Fish Trap', 82: 'Castle', 49: 'Siege Workshop', 209: 'University', 598: 'Outpost',
  // 가이아
  594: 'Sheep', 705: 'Cow', 305: 'Llama', 333: 'Turkey', 48: 'Wild Boar', 810: 'Iron Boar', 822: 'Javelina',
  65: 'Deer', 1026: 'Ostrich', 1239: 'Ibex', 1060: 'Zebra', 126: 'Wolf', 59: 'Forage Bush', 66: 'Gold Mine',
  102: 'Stone Mine',
};
// 마을회관 부속 건물: 이름표를 달지 않는다
const UNLABELLED = new Set([618, 619, 620, 1651]);
// 엔진의 행동 종류(ActionKind 번호)를 말로
const ACTION_NAMES = {
  1: '이동', 3: '들어가기', 4: '정찰', 6: '사냥', 7: '전투', 9: '공격', 13: '경계',
  101: '건설', 102: '생산', 103: '연구', 104: '개종', 105: '치료', 106: '수리',
  107: '몰이', 110: '채집', 111: '교역', 136: '내려놓기',
};
// 들고 있는 자원: 0 식량, 1 나무, 2 돌, 3 금, 15-17 고기
const HELD_NAMES = { 0: '식량', 1: '나무', 2: '돌', 3: '금', 15: '고기', 16: '고기', 17: '고기' };
// 장식 새: 흐리고 작게, 이름은 고르거나 올렸을 때만
const DECOR_BIRDS = new Set([96, 917, 1305, 2578, 816, 1028, 2742]);
