#!/bin/bash
# usage: U15_launch.sh <prefix> [extra envs]: E5_launch.sh's eleven runs plus the three other animal games (x_*)
d="$(cd "$(dirname "$0")" && pwd)"
prefix=$1; extra=$2
for r in 519925669 519930254 520848973; do
  bash "$d/E5_go.sh" "${prefix}_x_$r" "$r" 75000 "$extra" >/dev/null 2>&1 &
done
bash "$d/E5_launch.sh" "$prefix" "$extra"
wait
echo done > "$d/${prefix}_all.done"
