#!/bin/bash
# ENG-27: the four group-B pro games, short, with DROP/EXTRA/RES traces. usage: K27_b.sh <prefix> <updates> [extra]
d="$(cd "$(dirname "$0")" && pwd)"
for r in 517429796 520842005 520199364 521069970; do
  bash "$d/E5_go.sh" "${1}_$r" "$r" "$2" "GENIE_TRACE_DROP=1;GENIE_TRACE_EXTRA=1;GENIE_TRACE_RES=1;$3" >/dev/null 2>&1 &
done
wait; echo done > "$d/${1}_all.done"
