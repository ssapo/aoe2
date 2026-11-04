#!/bin/bash
# Build header_probe and run it on every replay under $REPLAYS; print the first error frames.
# env: GENIE=<genie checkout with the patch>  REPLAYS=<dir with */*.aoe2record>
: "${GENIE:?set GENIE}"; : "${REPLAYS:?set REPLAYS}"
cd "$GENIE"
cargo build --release -q -p genie-oracle --example header_probe --ignore-rust-version 2>&1 | grep -E "^error" -A10 | head -30
for f in "$REPLAYS"/*/*.aoe2record "$REPLAYS"/*.aoe2record; do [ -f "$f" ] || continue
  printf "%s " "$(basename "$f" .aoe2record)"
  ./target/release/examples/header_probe "$f" 2>&1 | sed 's/\\n/\n/g' | grep -oE "^players: [0-9]+|Error: [^G].{0,100}|While parsing field '[a-z_0-9]+' in [A-Za-z0-9]+" | head -${1:-4} | tr '\n' ' '; echo
done
