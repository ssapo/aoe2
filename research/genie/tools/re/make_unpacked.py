#!/usr/bin/env python3
"""Rebuild the analysis EXE: the original AoE2DE_s.exe with its .text taken from a memory dump.

usage: make_unpacked.py <AoE2DE_s.exe> <memory dump of the whole image, RVA 0 first> <out.exe>

The dump is the image as mapped (offset in the dump = RVA), read from the running game at the
menu screen with read-only access (see original-188329-code-map.md). Only .text is replaced:
.rdata/.data keep the file's unrelocated contents, which the helper scripts expect.
For build 101.103.57257.0 (#188329) the result must have the SHA-256 printed in CONTINUE.md.
NOT RE-RUN since the first session: check the hash.
"""
import struct, sys, hashlib
exe, dump, out = sys.argv[1:4]
d = bytearray(open(exe, 'rb').read()); m = open(dump, 'rb').read()
pe = struct.unpack_from('<I', d, 0x3c)[0]; ns = struct.unpack_from('<H', d, pe + 6)[0]
osz = struct.unpack_from('<H', d, pe + 20)[0]
for i in range(ns):
    o = pe + 24 + osz + i * 40
    name = bytes(d[o:o + 8]).rstrip(b'\0')
    vs, va, rs, rp = struct.unpack_from('<IIII', d, o + 8)
    if name == b'.text':
        n = min(vs, rs)
        d[rp:rp + n] = m[va:va + n]
        print('patched .text', hex(va), hex(n))
open(out, 'wb').write(d); print('sha256', hashlib.sha256(d).hexdigest())
