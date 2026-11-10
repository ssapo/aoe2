import struct,mmap,bisect,os
# the analysis EXE: AOE2_RE_EXE, or AoE2DE_s_unpacked.exe beside this file
P=os.environ.get('AOE2_RE_EXE', os.path.join(os.path.dirname(os.path.abspath(__file__)),'AoE2DE_s_unpacked.exe'))
f=open(P,'rb'); d=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ)
BASE=0x140000000
pe=struct.unpack_from('<I',d,0x3c)[0]; ns=struct.unpack_from('<H',d,pe+6)[0]; osz=struct.unpack_from('<H',d,pe+20)[0]
secs=[]
for i in range(ns):
    s=d[pe+24+osz+i*40:pe+24+osz+i*40+40]; vs,va,rs,rp=struct.unpack_from('<IIII',s,8); secs.append((s[:8].rstrip(b'\0').decode('latin1'),va,vs,rp,rs))
def rva(o):
    for n,va,vs,rp,rs in secs:
        if rp<=o<rp+rs: return va+o-rp
def off(r):
    for n,va,vs,rp,rs in secs:
        if va<=r<va+rs: return rp+r-va
def sec(r):
    for n,va,vs,rp,rs in secs:
        if va<=r<va+max(vs,rs): return n
pd=[s for s in secs if s[0]=='.pdata'][0]; funcs=[]
for o in range(pd[3],pd[3]+pd[2]-11,12):
    b,e,u=struct.unpack_from('<III',d,o)
    if b: funcs.append((b,e))
funcs.sort(); starts=[x[0] for x in funcs]
def fn(r):
    i=bisect.bisect_right(starts,r)-1
    return funcs[i] if i>=0 and funcs[i][0]<=r<funcs[i][1] else None
def q(r): return struct.unpack_from('<Q',d,off(r))[0]
def u32(r): return struct.unpack_from('<I',d,off(r))[0]
def cstr(r,n=200):
    o=off(r); e=d.find(b'\0',o); return d[o:min(e,o+n)].decode('latin1')
def rtti(vt):
    try:
        col=q(vt-8)-BASE
        if sec(col)!='.rdata': return None
        sig,offs,cd,td,chd,selfr=struct.unpack_from('<IIIIII',d,off(col))
        if sig!=1 or selfr!=col: return None
        return cstr(td+16)
    except Exception: return None
def vtable(vt,maxn=200):
    out=[]
    for i in range(maxn):
        v=q(vt+8*i)-BASE
        if not (0x1000<=v<0x3196000): break
        out.append(v)
    return out
