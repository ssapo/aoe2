"""Apply the reviewed fast-parser compatibility fix to pinned mgz 1.8.51.

Source: Kjir, aoc-mgz PR #139, commit b4a30d8539c2fed4cbfc7b8cfec874e65cdc50a2.
Only fast-parser changes and the unknown-civilization fallback are needed here.
Upstream license: MIT; see THIRD_PARTY_NOTICES.txt.
"""
from importlib.metadata import version
import importlib.util
from pathlib import Path


def replace_once(text, before, after):
    if after in text:
        return text
    if text.count(before) != 1:
        raise RuntimeError('Parser compatibility patch preimage changed; refusing to modify it.')
    return text.replace(before, after, 1)


def main():
    if version('mgz') != '1.8.51':
        raise RuntimeError('This compatibility fix is only reviewed for mgz==1.8.51.')
    root = Path(importlib.util.find_spec('mgz').origin).parent
    path = root / 'fast/header.py'
    text = path.read_text(encoding='utf-8')
    text = replace_once(text,
        '        if save >= 64.3:\n            data.read(4)\n\n        players.append(dict(',
        '        if save >= 64.3:\n            data.read(4)\n        if save >= 67.2:\n            de_string(data)\n\n        players.append(dict(')
    text = replace_once(text,
        '    if not skip:\n        de_string(data)\n        data.read(8)\n',
        '    if not skip:\n        de_string(data)\n        if save >= 67.2:\n            de_string(data)\n            de_string(data)\n        data.read(8)\n')
    path.write_text(text, encoding='utf-8')
    path = root / 'model/__init__.py'
    text = path.read_text(encoding='utf-8')
    text = replace_once(text,
        "dataset['civilizations'][str(player['civilization_id'])]['name']",
        "dataset['civilizations'].get(str(player['civilization_id']), {'name': f\"<Unknown civ: {player['civilization_id']}>\"})['name']")
    path.write_text(text, encoding='utf-8')
    print('Applied mgz fast-parser compatibility fix (upstream PR #139).')


if __name__ == '__main__': main()
