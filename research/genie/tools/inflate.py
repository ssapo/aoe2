import sys, zlib, struct
for p in sys.argv[1:]:
    d=open(p,'rb').read()
    hl,=struct.unpack('<I',d[:4])
    h=zlib.decompress(d[8:hl],-15)
    out=p.rsplit('/',1)[-1].replace('.aoe2record','.hdr')
    open(out,'wb').write(h)
    idx=[i for i in range(len(h)-3) if h[i:i+4]==b'\xad\xde\xad\xde']
    print(out,len(h),[hex(i) for i in idx[:6]])
