"""Fetch the unit and tech icons the civ matchup section uses into site/assets/units and site/assets/techs.

Source: SiegeEngineers/aoe2techtree (code MIT; the icons are game artwork, see THIRD_PARTY_NOTICES.txt),
pinned to the commit that implements DE update 188329. Files are named by the tech tree's
"Picture Index", the same number site/data/civ-reference.json keeps as each node's "icon".
Only icons referenced by the table are fetched; existing files are kept.

    .venv\\Scripts\\python.exe scripts\\fetch_icons.py
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

COMMIT = "e56728e76b7d08301fba7b18d5f16bc8554c109a"  # "Implement DE Update 188329", 2026-10-27
BASE = f"https://raw.githubusercontent.com/SiegeEngineers/aoe2techtree/{COMMIT}/img"
ROOT = Path(__file__).resolve().parent.parent
REFERENCE = ROOT / "site" / "data" / "civ-reference.json"
PNG = b"\x89PNG\r\n\x1a\n"


def wanted(ref: dict) -> dict[str, set[int]]:
    """Icon numbers by folder: every unit in a land line, every tech node."""
    units = {u for civ in ref["civs"].values() for line in civ["lines"] for u in line}
    return {
        "units": {ref["nodes"][f"u{u}"]["icon"] for u in units if ref["nodes"].get(f"u{u}", {}).get("icon") is not None},
        "techs": {n["icon"] for k, n in ref["nodes"].items() if k[0] == "t" and n.get("icon") is not None},
    }


def main() -> int:
    ref = json.loads(REFERENCE.read_text(encoding="utf-8"))
    fetched = kept = 0
    for folder, icons in wanted(ref).items():
        out = ROOT / "site" / "assets" / folder
        out.mkdir(parents=True, exist_ok=True)
        remote = "Unit" if folder == "units" else "Tech"
        for icon in sorted(icons):
            path = out / f"{icon}.png"
            if path.exists():
                kept += 1
                continue
            request = urllib.request.Request(f"{BASE}/{remote}/{icon}.png", headers={"User-Agent": "aoe2-icon-fetch"})
            with urllib.request.urlopen(request, timeout=20) as response:
                data = response.read()
            if not data.startswith(PNG) or len(data) > 64_000:
                raise SystemExit(f"{remote}/{icon}.png is not a small PNG")
            path.write_bytes(data)
            fetched += 1
    print(f"icons: {fetched} fetched, {kept} kept")
    return 0


if __name__ == "__main__":
    sys.exit(main())
