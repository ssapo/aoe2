#!/bin/bash
# ENG-28: the eleven replays + three animal games (U15_launch), the seven V games, then the fourteen pro games; prefix P for the pros
d="$(cd "$(dirname "$0")" && pwd)"
p=$1; extra=$2
bash "$d/U15_launch.sh" "$p" "$extra" &
bash "$d/J25_V.sh" "$p" "$extra" &
wait
bash "$d/P26_launch.sh" "${p}P" "$extra"
echo done > "$d/${p}_ALL.done"
