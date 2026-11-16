import json
import struct
import sys
import unittest
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "scripts"))
import civ_reference as cr  # noqa: E402

DATA = root / "site" / "data" / "civ-reference.json"


class HelperTests(unittest.TestCase):
    def test_dat_version_maps_ver_strings_to_genieutils_ordinals(self):
        self.assertEqual(cr.dat_version(b"VER 7.1\x00"), 14)
        self.assertEqual(cr.dat_version(b"VER 8.0\x00"), 23)
        self.assertEqual(cr.dat_version(b"VER 8.9\x00"), 32)
        with self.assertRaises(ValueError):
            cr.dat_version(b"VER 5.8\x00")

    def test_debug_string_needs_its_marker(self):
        r = cr.Reader(struct.pack("<HH", 0x0A60, 3) + b"abc")
        self.assertEqual(r.debug_string(), "abc")
        with self.assertRaises(ValueError):
            cr.Reader(struct.pack("<HH", 0x1234, 0)).debug_string()

    def test_description_lines_keep_game_text_and_mark_headings(self):
        text = "궁사 문명\\n\\n• 보너스 하나\\n\\n<b>특수 유닛:<b>\\n라탄 궁사(보병 궁사)"
        self.assertEqual(cr.description_lines(text), ["궁사 문명", "• 보너스 하나", "#특수 유닛:", "라탄 궁사(보병 궁사)"])

    def test_unit_lines_follow_link_ids(self):
        nodes = [
            {"Node Type": "Unit", "Node ID": 38},
            {"Node Type": "UnitUpgrade", "Node ID": 283, "Link ID": 38},
            {"Node Type": "UnitUpgrade", "Node ID": 569, "Link ID": 283},
            {"Node Type": "Unit", "Node ID": 4},
            {"Node Type": "Research", "Node ID": 67},
        ]
        self.assertEqual(cr.unit_lines(nodes), [[38, 283, 569], [4]])

    def test_unit_facts_drop_base_classes_from_bonuses(self):
        u = {"hp": 60, "class": 6, "attacks": {4: 6, 8: 32, 5: 28, 21: 0}, "armours": {4: 0, 3: 0, 27: 0, 1: 0},
             "range": 0.0, "reload": 3.0, "bonus_resist": 0.0, "cost": {"0": 35, "1": 25}}
        facts = cr.unit_facts(u)
        self.assertEqual(facts["melee_attack"], 6)
        self.assertEqual(facts["bonus"], {"5": 28, "8": 32})
        self.assertEqual(facts["armour_classes"], {"1": 0, "27": 0})
        self.assertNotIn("bonus_resist", facts)


class SavedReferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(DATA.read_text(encoding="utf-8"))

    def test_records_build_and_source_hashes(self):
        self.assertEqual(self.data["schema_version"], 1)
        self.assertEqual(self.data["game_build"], 188329)
        self.assertEqual(len(self.data["sources"]), 3)
        self.assertTrue(all(len(h) == 64 for h in self.data["sources"].values()))

    def test_ranked_civs_use_site_names_and_skip_chronicles(self):
        civs = self.data["civs"]
        for name in ("Vietnamese", "Mongols", "Maya", "Hindustanis", "Wu"):
            self.assertIn(name, civs)
        for name in ("Mayans", "Indians", "Spartans", "Achaemenids", "Gaia"):
            self.assertNotIn(name, civs)

    def test_known_tech_tree_facts(self):
        civs, nodes = self.data["civs"], self.data["nodes"]
        self.assertIn(569, civs["Mongols"]["missing_units"])  # Paladin
        self.assertIn(441, civs["Vietnamese"]["missing_units"])  # Hussar
        self.assertIn(182, civs["Vietnamese"]["missing_techs"])  # Gold Shaft Mining
        self.assertNotIn(569, civs["Franks"]["missing_units"])
        self.assertIn([38, 283, 569], civs["Franks"]["lines"])
        self.assertEqual(nodes["u569"]["name"], "Paladin")
        self.assertEqual(nodes["t75"]["building"], 103)
        self.assertNotIn("\\n", json.dumps(nodes, ensure_ascii=False))

    def test_every_node_has_an_icon_number(self):
        nodes = self.data["nodes"]
        self.assertTrue(all(isinstance(n.get("icon"), int) for n in nodes.values()))
        self.assertTrue((root / "site" / "assets" / "units" / f"{nodes['u359']['icon']}.png").exists())

    def test_descriptions_come_from_game_strings(self):
        viet = self.data["civs"]["Vietnamese"]
        self.assertEqual(viet["description_string_id"], 120180)
        self.assertEqual(viet["description"][0], "궁사 문명")
        self.assertIn("#특수 유닛:", viet["description"])
        self.assertGreater(len(viet["description"]), 8)

    def test_unit_stats_match_the_game_data(self):
        stats = self.data["unit_stats"]
        knight = stats["38"]
        self.assertEqual((knight["hp"], knight["melee_attack"], knight["melee_armour"], knight["pierce_armour"]), (100, 10, 2, 2))
        self.assertEqual(stats["359"]["bonus"]["8"], 32)  # Halberdier vs cavalry
        self.assertIn("8", knight["armour_classes"])


@unittest.skipUnless((cr.DEFAULT_GAME / "resources/_common/dat/empires2_x2_p1.dat").exists(), "game not installed")
class InstalledGameTests(unittest.TestCase):
    def test_saved_table_matches_the_installed_game(self):
        built = cr.build(cr.DEFAULT_GAME, 188329)
        saved = json.loads(DATA.read_text(encoding="utf-8"))
        if built["sources"] != saved["sources"]:
            self.skipTest("installed game files changed since the table was saved; rerun scripts/civ_reference.py")
        self.assertEqual(json.loads(json.dumps(built, ensure_ascii=False)), saved)


if __name__ == "__main__":
    unittest.main()
