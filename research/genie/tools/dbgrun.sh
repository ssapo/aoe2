#!/bin/bash
# usage: GENIE=<genie checkout> dbgrun.sh "StructA StructB" <replay> [tail-lines]
# Adds #[br(dbg)] to every field of the named structs in generated/world.rs, runs header_probe,
# prints "offset] field = value" lines, then restores the file (also on early exit).
: "${GENIE:?set GENIE}"
set -e
cd "$GENIE"
F=crates/formats/genie-save/src/generated/world.rs
B=$(mktemp); cp $F $B; trap 'cp $B $F; rm -f $B' EXIT
python3 - "$F" "$1" <<'PY'
import sys,re
p,names=sys.argv[1],sys.argv[2].split()
out=[]; inside=False
for l in open(p).read().split('\n'):
    m=re.match(r'pub struct (\w+)',l)
    if m: inside = m.group(1) in names
    if inside and re.match(r'    pub [a-z_0-9]+:',l): out.append('    #[br(dbg)]')
    if l=='}': inside=False
    out.append(l)
open(p,'w').write('\n'.join(out))
PY
cargo build --release -q -p genie-oracle --example header_probe --ignore-rust-version 2>&1 | grep -E "^error" -A8 | head -20 || true
./target/release/examples/header_probe "$2" 2>&1 >/dev/null | grep -E "offset" | sed 's/.*offset //' | cut -c1-110 | tail -${3:-40} || true
