#!/bin/bash
# usage: E5_go.sh <name> <replay folder number> <updates> [extra envs "K=V;K=V"]
# The same run as go.ps1 (no build), from Git Bash: default switches = runs/M6_envs.txt
# (or the file named by E5_ENVFILE), output runs/<name>.out/.err/.done. E5_EXE = an engine build
# in runs/ (a frozen copy, so a build can go on while it runs) or in the build folder.
d="$(cd "$(dirname "$0")/.." && pwd)"
name=$1; replay=$2; updates=$3; extra=$4
rm -f "$d/runs/$name.done"
export GENIE_CORRECT=ids GENIE_EXPERIMENT_SEARCH_CLEAR=unit GENIE_EXPERIMENT_CAPTURE_SETUP=1 GENIE_NO_STOP=1 GENIE_PRINT_CHECKPOINTS=1
export GENIE_EXPERIMENT_SORT_LISTS=1 GENIE_EXPERIMENT_SHORT_188329=1 GENIE_EXPERIMENT_SPAWN_188329=1
envs="$(tr -d '\r\n' < "$d/runs/${E5_ENVFILE:-M6_envs.txt}");$extra"
IFS=';' read -ra kvs <<< "$envs"
for kv in "${kvs[@]}"; do [ -n "$kv" ] && export "$kv"; done
rep="$(ls "$d/$replay"/*.aoe2record | head -1)"
exe="$d/genie/target/release/examples/census.exe"
[ -n "$E5_EXE" ] && { [ -f "$d/runs/$E5_EXE" ] && exe="$d/runs/$E5_EXE" || exe="$d/genie/target/release/examples/$E5_EXE"; }
"$exe" "$(cygpath -w "$rep")" "$(cygpath -w "$d/data/empires2_x2_p1.dat")" "$updates" > "$d/runs/$name.out" 2> "$d/runs/$name.err"
echo "run=$?" > "$d/runs/$name.done"
