#!/bin/bash
# usage: J25_V.sh <prefix> [extra]: the seven V games (E11c's set) through E5_go.sh, 75000 updates
d="$(cd "$(dirname "$0")" && pwd)"
for r in 518801961 519002991 520162577 520169985 520219269 520282194 520352957; do
  bash "$d/E5_go.sh" "${1}_V_$r" "$r" 75000 "$2" >/dev/null 2>&1 &
done
wait; echo done > "$d/${1}_V.done"
