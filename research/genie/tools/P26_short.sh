#!/bin/bash
# usage: P26_short.sh <prefix> <updates> [extra]: the fourteen pro games, short runs
d="$(cd "$(dirname "$0")" && pwd)"
for r in $(cut -d' ' -f1 "$d/P26_out/picks.txt"); do
  bash "$d/E5_go.sh" "${1}_$r" "$r" "$2" "$3" >/dev/null 2>&1 &
done
wait; echo done > "$d/${1}_all.done"
