# ENG-30: object vtables (preceded by a pointer into .rdata = the RTTI locator) with >= N code slots,
# compared slot by slot with a reference vtable. usage: python E30_vtscan.py <ref vt hex> [min slots]
import sys,struct
sys.path.insert(0,'.')
from pe import *
ref=int(sys.argv[1],16); N=int(sys.argv[2]) if len(sys.argv)>2 else 270
rd=[s for s in secs if s[0]=='.rdata'][0]
va,off_,size=rd[1],rd[3],rd[4]
n=size//8
arr=struct.unpack_from('<%dQ'%n,d,off_)
def code(v): v-=BASE; return 0x1000<=v<0x2000000
def inrd(v): v-=BASE; return va<=v<va+size
R=[arr[(ref-va)//8+i] for i in range(N)]
i=1
while i<n-N:
    if inrd(arr[i-1]) and code(arr[i]):
        k=0
        while i+k<n and code(arr[i+k]): k+=1
        if k>=N:
            same=sum(1 for j in range(N) if arr[i+j]==R[j])
            print(hex(va+i*8),'slots',k,'same',same,'s1f0',hex(arr[i+0x1f0//8]-BASE),'s860',hex(arr[i+0x860//8]-BASE) if k>0x860//8 else '-')
        i+=max(k,1)
    else: i+=1
