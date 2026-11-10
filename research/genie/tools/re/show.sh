#!/bin/bash
# usage: show.sh file rva [maxlines]
F=$1; R=$2; N=${3:-400}
S=$(grep -n "==== RVA $R " $F | cut -d: -f1)
awk -v s=$S 'NR>s && /==== RVA/{exit} NR>=s' $F | grep -v '^\s*$' | grep -vE '^\s+(undefined[0-9]*|int|uint|longlong|ulonglong|char|byte|bool|float|double|short|ushort|code) \*?\*?\*?[a-zA-Z_0-9]+( \[[0-9]+\])?;$' | grep -v 'WARNING' | cut -c1-150 | head -$N
