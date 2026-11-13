#!/bin/bash
# usage: E5_launch.sh <prefix> [extra envs] : the eleven default runs (as M5_launch.ps1) through E5_go.sh, all at once.
# E5_EXE (a file name in runs/ or genie/target/release/examples/) picks the engine build.
d="$(cd "$(dirname "$0")" && pwd)"
prefix=$1; extra=$2
for x in 'p_239 518239882 41600' 'p_161 518470161 75000' 'p_097 517426097 75000' 'n_894 516956894 75000' 'n_090 519686090 75000' 'n_670 519700670 75000' 'q_411 520397411 75000' 'q_236 520394236 75000' 'q_901 520386901 75000' 'q_921 520596921 75000' 'q_057 520592057 75000'; do
  set -- $x
  bash "$d/E5_go.sh" "${prefix}_$1" "$2" "$3" "$extra" >/dev/null 2>&1 &
done
wait
