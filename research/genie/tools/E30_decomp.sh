#!/bin/bash
# usage: E30_decomp.sh <list file name in re-kit/re> <out name>: Ghidra headless RangeDecomp, Windows toolchain
k=/c/Users/ssapo/genie-replays/re-kit
export JAVA_HOME="$(cygpath -w $k/toolchain/jdk-21.0.13+9)"
export JAVA_TOOL_OPTIONS=-Duser.name=root
export PATH="$k/toolchain/jdk-21.0.13+9/bin:$PATH"
cd $k/re
cmd //c "$(cygpath -w $k/toolchain/ghidra_11.3.2_PUBLIC/support/analyzeHeadless.bat)" "$(cygpath -w $k/re/proj2)" aoe -process AoE2DE_s_unpacked.exe -noanalysis -scriptPath "$(cygpath -w $k/re/gs)" -postScript RangeDecomp.java "$(cygpath -w $k/re/$1)" "$(cygpath -w $k/re/out_e30/$2.c)" > $k/re/out_e30/$2.log 2>&1 < /dev/null
echo done > $k/re/out_e30/$2.done
