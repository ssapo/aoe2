"""Build site/data/civ-reference.json: a small table of facts about each 1v1 ranked civilization.

Sources (all from the local game install, read only; nothing is copied whole):
- resources/_common/dat/civilizations.json: civilization list, name and description string ids.
- resources/_common/dat/CivTechTrees/<CIV>.json: each civilization's tech tree (which units and
  techs exist; "NotAvailable" means the civilization lacks it).
- resources/_common/dat/empires2_x2_p1.dat: unit attacks and armours (attack bonus classes),
  hit points, ranges and costs. The layout follows genieutils / genie-dat (VER 7.1 to 8.9).
- resources/ko/strings/key-value/key-value-strings-utf8.txt: Korean game text for names and
  the civilization descriptions (bonus lines). Bonus text is never written by hand here.

Run again after every patch with the game's build number:
    .venv\\Scripts\\python.exe scripts\\civ_reference.py --build 188329
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import sys
import zlib
from pathlib import Path

DEFAULT_GAME = Path(r"C:\Program Files (x86)\Steam\steamapps\common\AoE2DE")
OUT = Path(__file__).resolve().parent.parent / "site" / "data" / "civ-reference.json"
SCHEMA_VERSION = 1

# Site civilization keys (match.civilization) that differ from civilizations.json internal_name.
SITE_NAME = {"Mayans": "Maya", "Indians": "Hindustanis"}

# Buildings whose techs are grouped on the page (tech tree "Building ID").
TECH_GROUPS = {
    "blacksmith": [103],
    "university": [209],
    "monastery": [104],
    "economy": [109, 584, 562, 68, 84],
    "military": [12, 87, 101, 49, 82],
    "dock": [45],
}
UNIT_NODE_TYPES = {"Unit", "UnitUpgrade", "UniqueUnit", "RegionalUnit"}
TECH_NODE_TYPES = {"Research", "UniqueTech", "RegionalTech"}
# Land unit lines compared on the page, by the unit id of the line's first unit.
# Buildings: 12 barracks, 87 archery range, 101 stable, 49 siege workshop, 82 castle, 104 monastery.
LAND_BUILDINGS = {12, 87, 101, 49, 82, 104}

# Armour classes named on the page. Names are the class meanings used by the game data
# (genieutils armour class list); a class without a name is shown as its number.
ARMOR_CLASS_KO = {
    1: "보병", 2: "거북선", 3: "관통(기본)", 4: "근접(기본)", 5: "코끼리", 8: "기병",
    11: "건물", 13: "석조 방어시설", 14: "맹수", 15: "궁사", 16: "함선·낙타·자폭병",
    17: "충차·트레뷰셋", 19: "고유 유닛", 20: "공성 무기", 21: "일반 건물", 22: "성벽·성문",
    23: "화약 유닛", 24: "멧돼지", 25: "수도사", 26: "성", 27: "창병", 28: "기마 궁사",
    29: "독수리 전사", 30: "낙타", 32: "용병", 34: "고기잡이배", 35: "맘루크", 36: "영웅·왕",
    37: "공성 무기(대형)", 38: "척후병", 39: "기병 저항",
}
BASE_CLASSES = {3, 4}
# Effect attributes that change how a unit fights or what it costs (genieutils attribute ids):
# 0 hit points, 5 speed, 8 armour, 9 attack, 10 reload time, 12 range, 100/103-106 costs, 101 train time.
COMBAT_ATTRS = {0, 5, 8, 9, 10, 12, 100, 101, 103, 104, 105, 106}
MODIFY_KINDS = {0, 4, 5, 10, 14, 15}  # set / add / multiply attribute, and their team versions


# Age techs (Feudal, Castle, Imperial) -> age number as in the tech tree's "Age ID" (1 Dark .. 4 Imperial).
AGE_TECHS = {101: 2, 102: 3, 103: 4}
# Generic techs whose stat effects the per-age matchup applies (besides every blacksmith tech):
# Bloodlines, Husbandry, Thumb Ring, Parthian Tactics, Squires, Chemistry.
STAT_TECHS = [435, 39, 437, 436, 215, 47]


def tech_age(dat: dict, tech_id: int, memo: dict | None = None, depth: int = 0) -> int:
    """The earliest age a tech can be researched: the age techs reached through its requirements.

    A tech needs `required_count` of its listed techs; the earliest age is the required_count-th
    smallest age among them. No requirement means the Dark Age (1). Cycles or depth > 12 count as 1.
    """
    memo = {} if memo is None else memo
    if tech_id in AGE_TECHS:
        return AGE_TECHS[tech_id]
    if tech_id in memo:
        return memo[tech_id]
    memo[tech_id] = 1
    if not 0 <= tech_id < len(dat["techs"]) or depth > 12:
        return 1
    t = dat["techs"][tech_id]
    ages = sorted(tech_age(dat, r, memo, depth + 1) for r in t.get("required", []))
    need = max(1, min(t.get("required_count") or len(ages), len(ages))) if ages else 0
    age = ages[need - 1] if ages else 1
    memo[tech_id] = age
    return age


def stat_commands(dat: dict, effect_id: int) -> list[list]:
    """The effect's attribute changes on combat stats: [kind, unit, class, attribute, amount]."""
    if not 0 <= effect_id < len(dat["effects"]):
        return []
    return [[k, u, c, a, round(x, 4)] for k, u, c, a, x in dat["effects"][effect_id]["commands"]
            if k in MODIFY_KINDS and a in COMBAT_ATTRS]


def civ_unlocks(dat: dict, civ_id: int, line_units: set[int]) -> dict[str, int]:
    """Line units this civ gets from one of its own techs (effect "enable unit"), with that tech's earliest age.

    Some unique units sit early in the tech tree but come from a unique tech (Flemish Militia: tree Feudal,
    enabled by Flemish Revolution in the Imperial Age). Only ages after the Dark Age are kept.
    """
    out: dict[str, int] = {}
    for i, t in enumerate(dat["techs"]):
        if t["civ"] != civ_id or not 0 <= t["effect"] < len(dat["effects"]):
            continue
        for kind, unit, mode, _attr, _amount in dat["effects"][t["effect"]]["commands"]:
            if kind == 2 and mode == 1 and unit in line_units:
                age = tech_age(dat, i)
                out[str(unit)] = min(out.get(str(unit), age), age)
    return {k: v for k, v in sorted(out.items(), key=lambda kv: int(kv[0])) if v > 1}


def civ_boosts(dat: dict, civ_id: int, line_units: set[int]) -> dict[str, dict]:
    """Units of this civ's lines that its own effects change, with the attributes changed.

    Sources: the civ's tech-tree effect, its team bonus effect (it applies to the player too) and
    every tech tagged with this civ (hidden civ-bonus techs cost nothing; unique techs cost
    resources). Only which unit and which attribute are kept: some bonus techs are staged by age or
    are inactive variants, so the amounts are not applied to the stats.
    """
    civ = dat["civs"][civ_id]
    classes = {uid: u["class"] for uid, u in civ["units"].items()}
    # (effect, source, age it applies from): tech-tree and team bonus effects apply from the start
    sources = [(civ["tech_tree"], "civ", 1), (civ["team_bonus"], "civ", 1)]
    sources += [(t["effect"], "unique" if t["cost"] else "civ", tech_age(dat, i))
                for i, t in enumerate(dat["techs"]) if t["civ"] == civ_id]
    boosts: dict[str, dict] = {}
    for effect_id, source, age in sources:
        if not 0 <= effect_id < len(dat["effects"]):
            continue
        for kind, unit, cls, attr, amount in dat["effects"][effect_id]["commands"]:
            if kind not in MODIFY_KINDS or attr not in COMBAT_ATTRS:
                continue
            hit = [unit] if unit >= 0 else [u for u in line_units if cls >= 0 and classes.get(u) == cls]
            for uid in hit:
                if uid in line_units:
                    entry = boosts.setdefault(str(uid), {"attrs": set(), "sources": set(), "steps": set()})
                    entry["attrs"].add(attr)
                    entry["sources"].add(source)
                    # [age, attribute, kind, amount, source]: the per-age matchup applies these by age
                    entry["steps"].add((age, attr, kind, round(amount, 4), source))
    return {k: {"attrs": sorted(v["attrs"]), "sources": sorted(v["sources"]), "from_age": min(s[0] for s in v["steps"]),
                "steps": [list(s) for s in sorted(v["steps"])]}
            for k, v in sorted(boosts.items(), key=lambda kv: int(kv[0]))}


class Reader:
    def __init__(self, data: bytes):
        self.data = data
        self.pos = 0

    def read(self, fmt: str):
        size = struct.calcsize("<" + fmt)
        values = struct.unpack_from("<" + fmt, self.data, self.pos)
        self.pos += size
        return values

    def one(self, fmt: str):
        return self.read(fmt)[0]

    def skip(self, n: int) -> None:
        self.pos += n

    def debug_string(self) -> str:
        marker, length = self.read("HH")
        if marker != 0x0A60:
            raise ValueError(f"debug string marker {marker:#x} at {self.pos - 4}")
        text = self.data[self.pos:self.pos + length].decode("utf-8", "replace")
        self.pos += length
        return text


def dat_version(head: bytes) -> int:
    match = re.fullmatch(rb"VER (\d)\.(\d)\x00", head)
    if not match:
        raise ValueError(f"unsupported dat version {head!r}")
    major, minor = int(match[1]), int(match[2])
    v = 14 + (major - 7) * 10 + minor - 1
    if not 14 <= v <= 32:
        raise ValueError(f"unsupported dat version {head!r}")
    return v


def _skip_terrain(r: Reader) -> None:
    r.skip(8)
    r.debug_string(); r.debug_string()
    r.skip(28)
    r.debug_string()
    r.skip(3 + 2 + 3 + 2 + 2 + 4 + 4 + 2 + 2 + 4 + 2 + 19 * 6 + 2 + 4 + 60 * 3 + 30 + 4)


def _skip_tasks(r: Reader, count: int, v: int) -> None:
    r.skip(count * (67 + (2 if v >= 28 else 0)))


def _read_unit(r: Reader, v: int) -> dict:
    kind, uid = r.read("Bh")
    if v >= 15:
        name_id, _creation = r.read("ii")
    else:
        name_id, _creation = r.read("hh")
    cls = r.one("h")
    r.skip(4 + 2 + 2 + 1)
    hp = r.one("h")
    r.skip(4 + 1 + 12 + 2 * 4 + 1 + 1 + 2 + 1 + 2 + 1 + 1 + 4 + 4 + 8 + 1 + 1 + 2 + 1 + 2 + 4)
    r.skip(1 + 1 + 1 + 1 + 1 + 4 + 1)
    help_id = r.one("i")
    r.skip(4)
    if v < 30:
        r.skip(4)
    r.skip(9 + 2 + 1 + 1 + 12 + 8 + 3 * 7)
    damage_graphics = r.one("B")
    r.skip(damage_graphics * 5 + 4 + 16 + 2)
    name = r.debug_string()
    r.skip(4)
    unit = {"kind": kind, "id": uid, "class": cls, "hp": hp, "name": name, "name_id": name_id, "help_id": help_id}
    if kind >= 20 and kind != 90:
        unit["speed"] = r.one("f")
    if kind >= 30 and kind != 90:
        r.skip(41)
    if kind >= 40 and kind != 90:
        r.skip(10)
        drops = r.one("h") if v >= 21 else 3
        r.skip(drops * 2 + 1 + 4 + 8 + 1)
        if v >= 15:
            _skip_tasks(r, r.one("h"), v)
    if kind >= 50 and kind != 90:
        base_armor, n = r.read("hh")
        attacks = {c: a for c, a in (r.read("hh") for _ in range(n))}
        n = r.one("h")
        armours = {c: a for c, a in (r.read("hh") for _ in range(n))}
        r.skip(2)
        resist = r.one("f") if v >= 16 else 0.0
        max_range, _blast, reload_time = r.read("fff")
        r.skip(2 + 2 + 1 + 2 + 12 + 1)
        min_range = r.one("f")
        r.skip(4 + 2)
        shown_melee_armour, shown_attack, shown_range, _shown_reload = r.read("hhff")
        r.skip((4 if v >= 20 else 0) + (8 if v >= 22 else 0) + (8 if v >= 27 else 0))
        unit.update(attacks=attacks, armours=armours, bonus_resist=resist, range=max_range, min_range=min_range,
                    reload=reload_time, shown_attack=shown_attack, shown_melee_armour=shown_melee_armour,
                    shown_range=shown_range)
    if kind == 60:
        r.skip(9)
    if kind >= 70 and kind != 90:
        costs = [r.read("hhh") for _ in range(3)]
        unit["cost"] = {str(k): a for k, a, f in costs if k >= 0 and a > 0 and f}
        locations = r.one("h") if v >= 29 else 1
        r.skip(locations * (5 + (4 if v >= 30 else 0)))
        r.skip(8 + 2 + 4 + 4)
        r.skip((2 if v >= 17 else 0) + (2 if v >= 26 else 0) + (12 if v >= 16 else 0)
               + (2 if v >= 23 else 0) + (9 if v >= 25 else 0) + (12 if v >= 24 else 0) + (12 if v >= 19 else 0))
        r.skip(4 + 1 + 12 + 4 + 4 + 1)
        unit["shown_pierce_armour"] = r.one("h")
    if kind == 80:
        r.skip(12 + 1 + 2 + 1 + 8 + 1 + 40 + 8 + 8 + 1 + 8 + 2 + 6)
    return unit


def read_dat(path: Path) -> dict:
    """Civilizations (index = civ id, Gaia 0) with their units, read from the compressed dat."""
    data = zlib.decompress(path.read_bytes(), -15)
    r = Reader(data)
    v = dat_version(data[:8])
    r.skip(8)
    restrictions, terrains_used = r.read("hh")
    r.skip(restrictions * 8 + restrictions * terrains_used * (4 + 16))
    r.skip(r.one("h") * 36)
    for _ in range(r.one("h")):
        r.skip(4)
        files = r.one("h")
        r.skip(6)
        for _ in range(files):
            r.debug_string(); r.skip(10)
    pointers = r.read(f"{r.one('h')}i")
    for p in pointers:
        if not p:
            continue
        r.debug_string(); r.debug_string(); r.debug_string()
        r.skip(4 + 3 + 2 + 1 + 8)
        deltas = r.one("h")
        r.skip(2 + 4)
        angle_sounds = r.one("B")
        r.skip(2)
        angles = r.one("h")
        r.skip(12 + 1 + 2 + 2)
        r.skip(deltas * 16 + (angles * 24 if angle_sounds and angles > 0 else 0))
    r.skip(8 + 16 + 19 * 6 + 2)
    for _ in range(200):
        _skip_terrain(r)
    r.skip(24 + 28 + 8 + 3)
    maps = r.one("I")
    r.skip(4 + maps * 72)
    for _ in range(maps):
        r.skip(36)
        for size in (44, 24, 44, 24):
            n = r.one("I")
            r.skip(4 + n * size)
    effects = []
    for _ in range(r.one("i")):
        name = r.debug_string()
        effects.append({"name": name, "commands": [r.read("Bhhhf") for _ in range(r.one("h"))]})
    for _ in range(r.one("i")):
        if r.one("B"):
            _skip_tasks(r, r.one("h"), v)
    civs = []
    for _ in range(r.one("h")):
        r.skip(1)
        name = r.debug_string()
        resources, tech_tree, team_bonus = r.read("hhh")
        r.skip(resources * 4 + 1)
        count = r.one("h")
        present = r.read(f"{count}i")
        units = {}
        for p in present:
            if p:
                u = _read_unit(r, v)
                units[u["id"]] = u
        civs.append({"name": name, "units": units, "tech_tree": tech_tree, "team_bonus": team_bonus})
    techs = []
    for _ in range(r.one("h")):
        required = r.read("6h")
        costs = [r.read("hhB") for _ in range(3)]
        required_count = r.one("h")
        civ, _mode = r.read("hh")
        if v < 31:
            r.skip(2)
        r.skip(8 if v >= 18 else 4)
        if v < 31:
            r.skip(2)
        effect, _kind, _icon = r.read("hhh")
        r.skip((1 if v < 31 else 0) + 8 + (4 if v < 31 else 0))
        name = r.debug_string()
        if v >= 15:
            r.skip(1)
        if v >= 31:
            r.skip(r.one("h") * 9)
        techs.append({"civ": civ, "effect": effect, "name": name, "cost": sum(a for k, a, f in costs if k >= 0 and f),
                      "required": [t for t in required if t >= 0], "required_count": required_count})
    return {"version": v, "civs": civs, "effects": effects, "techs": techs}


def read_strings(path: Path) -> dict[int, str]:
    strings = {}
    pattern = re.compile(r'^(\d+)\s+"(.*)"\s*$')
    for line in path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line)
        if match:
            strings[int(match[1])] = match[2].replace('\\"', '"')
    return strings


def description_lines(text: str) -> list[str]:
    """The civilization description as the game writes it, split into lines; headings start with '#'."""
    rows = []
    for raw in text.replace("\\n", "\n").split("\n"):
        line = raw.strip()
        if not line:
            continue
        heading = "<b>" in line
        line = re.sub(r"<[^>]*>", "", line).strip()
        if line:
            rows.append(("#" if heading else "") + line)
    return rows


def unit_lines(nodes: list[dict]) -> list[list[int]]:
    """Unit lines as chains of node ids, from each line's first unit through its upgrades (Link ID)."""
    units = [n for n in nodes if n.get("Node Type") in UNIT_NODE_TYPES]
    by_link: dict[int, list[dict]] = {}
    for n in units:
        if "Link ID" in n:
            by_link.setdefault(n["Link ID"], []).append(n)
    ids = {n["Node ID"] for n in units}
    lines = []
    for root in units:
        if "Link ID" in root and root["Link ID"] in ids:
            continue
        chain, cur = [root["Node ID"]], root["Node ID"]
        while by_link.get(cur):
            cur = by_link[cur][0]["Node ID"]
            if cur in chain:
                break
            chain.append(cur)
        lines.append(chain)
    return lines


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def unit_facts(u: dict) -> dict:
    facts = {"hp": u["hp"], "class": u["class"]}
    if u.get("speed"):
        facts["speed"] = round(u["speed"], 3)
    if "attacks" in u:
        facts["melee_attack"] = u["attacks"].get(4, 0)
        facts["pierce_attack"] = u["attacks"].get(3, 0)
        facts["melee_armour"] = u["armours"].get(4, 0)
        facts["pierce_armour"] = u["armours"].get(3, 0)
        facts["range"] = round(u["range"], 2)
        facts["reload"] = round(u["reload"], 3)
        facts["bonus"] = {str(c): a for c, a in sorted(u["attacks"].items()) if c not in BASE_CLASSES and a}
        facts["armour_classes"] = {str(c): a for c, a in sorted(u["armours"].items()) if c not in BASE_CLASSES}
        if u["bonus_resist"]:
            facts["bonus_resist"] = round(u["bonus_resist"], 4)
    if u.get("cost"):
        facts["cost"] = u["cost"]
    return facts


def build(game: Path, build_number: int) -> dict:
    dat_dir = game / "resources" / "_common" / "dat"
    civ_json = dat_dir / "civilizations.json"
    dat_path = dat_dir / "empires2_x2_p1.dat"
    strings_path = game / "resources" / "ko" / "strings" / "key-value" / "key-value-strings-utf8.txt"
    strings = read_strings(strings_path)
    dat = read_dat(dat_path)
    civ_list = json.loads(civ_json.read_text(encoding="utf-8"))["civilization_list"]
    nodes_meta: dict[str, dict] = {}
    units_meta: dict[str, dict] = {}
    civs: dict[str, dict] = {}

    def ko(sid):
        text = strings.get(int(sid)) if sid is not None else None
        return re.sub(r"\s*\\n\s*", " ", text).strip() if text else None

    for civ_id, info in enumerate(civ_list):
        if info.get("era") != "base" or info["internal_name"] == "Gaia":
            continue  # 1v1 ranked uses the base-game civilizations (Chronicles "antiquity" civs excluded)
        tree = json.loads((dat_dir / "CivTechTrees" / f"{info['tech_tree_name']}.json").read_text(encoding="utf-8"))
        site = SITE_NAME.get(info["internal_name"], info["internal_name"])
        dat_civ = dat["civs"][civ_id]["units"]
        missing_units, missing_techs = [], []
        for n in tree["civ_techs_units"]:
            kind = n.get("Node Type")
            if kind not in UNIT_NODE_TYPES | TECH_NODE_TYPES:
                continue
            is_unit = kind in UNIT_NODE_TYPES
            meta = nodes_meta.setdefault(f"{'u' if is_unit else 't'}{n['Node ID']}", {
                "name": n["Name"], "ko": ko(n.get("Name String ID")) or n["Name"],
                "building": n.get("Building ID"), "age": n.get("Age ID"), "type": kind,
                # icon file: site/assets/units|techs/<Picture Index>.png (scripts/fetch_icons.py)
                "icon": n.get("Picture Index"),
            })
            if kind != meta["type"] and kind in ("UniqueUnit", "RegionalUnit"):
                meta["type"] = kind
            if n["Node Status"] == "NotAvailable":
                (missing_units if is_unit else missing_techs).append(n["Node ID"])
        lines = []
        for chain in unit_lines(tree["civ_techs_units"]):
            first = next(n for n in tree["civ_techs_units"] if n.get("Node ID") == chain[0] and n.get("Node Type") in UNIT_NODE_TYPES)
            if first.get("Building ID") not in LAND_BUILDINGS:
                continue
            lines.append(chain)
            for uid in chain:
                if str(uid) not in units_meta and uid in dat_civ and uid not in missing_units:
                    units_meta[str(uid)] = unit_facts(dat_civ[uid])
        civs[site] = {
            "civ_id": civ_id,
            "internal_name": info["internal_name"],
            "name_ko": ko(info.get("name_string_id")),
            "description": description_lines(strings.get(info.get("tech_tree_description_string_id", -1), "")),
            "description_string_id": info.get("tech_tree_description_string_id"),
            "unique_techs": [t for t in (info.get("unique_tech_id_1"), info.get("unique_tech_id_2")) if t is not None],
            "missing_units": sorted(set(missing_units)),
            "missing_techs": sorted(set(missing_techs)),
            "lines": lines,
            "boosts": civ_boosts(dat, civ_id, {u for chain in lines for u in chain}),
            # unit id -> age its civ tech enables it (when later than the Dark Age); see civ_unlocks
            "unlock_ages": civ_unlocks(dat, civ_id, {u for chain in lines for u in chain}),
        }
    return {
        "schema_version": SCHEMA_VERSION,
        "game_build": build_number,
        "dat_version": dat["version"],
        "sources": {
            "civilizations.json": sha256(civ_json),
            "empires2_x2_p1.dat": sha256(dat_path),
            "key-value-strings-utf8.txt (ko)": sha256(strings_path),
        },
        "armor_classes": {str(k): v for k, v in ARMOR_CLASS_KO.items()},
        "tech_groups": TECH_GROUPS,
        "nodes": dict(sorted(nodes_meta.items(), key=lambda kv: (kv[0][0], int(kv[0][1:])))),
        "unit_stats": dict(sorted(units_meta.items(), key=lambda kv: int(kv[0]))),
        # generic techs the per-age matchup applies (all blacksmith techs + STAT_TECHS): their tech-tree age and
        # combat stat changes [kind, unit, class, attribute, amount] (attack/armour amount = class * 256 + value)
        "tech_effects": {str(t): {"age": nodes_meta[f"t{t}"]["age"], "commands": stat_commands(dat, dat["techs"][t]["effect"])}
                         for t in sorted({int(k[1:]) for k, m in nodes_meta.items() if k[0] == "t" and m["building"] == 103
                                          and m["type"] == "Research"} | set(STAT_TECHS))
                         if f"t{t}" in nodes_meta},
        "civs": dict(sorted(civs.items())),
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--build", type=int, required=True, help="game build number the install is on (e.g. 188329)")
    parser.add_argument("--game", type=Path, default=DEFAULT_GAME)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args(argv)
    data = build(args.game, args.build)
    args.out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{args.out}: {len(data['civs'])} civs, {len(data['unit_stats'])} units, build {args.build}, dat v{data['dat_version']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
