#!/bin/bash
# usage: P26_launch.sh <prefix> [extra envs]: the fourteen pro games (P26_out/picks.txt) through E5_go.sh, 75000 updates
d="$(cd "$(dirname "$0")" && pwd)"
for r in $(cut -d' ' -f1 "$d/P26_out/picks.txt"); do
  bash "$d/E5_go.sh" "${1}_$r" "$r" 75000 "$2" >/dev/null 2>&1 &
done
wait; echo done > "$d/${1}_all.done"
