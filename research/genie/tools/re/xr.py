from pe import *
import numpy as np, sys
tx=[s for s in secs if s[0]=='.text'][0]
buf=np.frombuffer(d,dtype=np.uint8,count=tx[4],offset=tx[3])
_views=None
def _prep():
    global _views
    if _views is None:
        _views=[]
        n=len(buf)
        for k in range(4):
            m=(n-k)//4
            v=np.frombuffer(buf[k:k+m*4].tobytes(),dtype='<i4').astype(np.int64)
            pos=np.arange(m,dtype=np.int64)*4+k+tx[1]   # rva of disp field
            _views.append(pos+4+v)   # target assuming no trailing imm
    return _views
def xrefs(lo,hi):
    """return list of (disp_field_rva, target) for rip-relative refs into [lo,hi), trailing imm 0/1/4"""
    out=[]
    for k,t in enumerate(_prep()):
        for imm in (0,1,4):
            idx=np.nonzero((t+imm>=lo)&(t+imm<hi))[0]
            for i in idx:
                r=int(i)*4+k+tx[1]; out.append((r,int(t[i])+imm,imm))
    return sorted(out)
if __name__=='__main__':
    lo=int(sys.argv[1],16); hi=int(sys.argv[2],16)
    for r,t,imm in xrefs(lo,hi):
        F=fn(r); o=off(r)
        print(hex(r),'->',hex(t),'imm',imm,'func',hex(F[0]) if F else None,'sz',hex(F[1]-F[0]) if F else None,'bytes',d[o-3:o].hex())
