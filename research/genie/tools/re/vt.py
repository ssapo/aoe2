from pe import *
import sys
for a in sys.argv[1:]:
    vt=int(a,16); print(hex(vt),'RTTI',rtti(vt)); 
    for i,v in enumerate(vtable(vt,40)): F=fn(v); print('  [%d]'%i,hex(v),'size',hex(F[1]-F[0]) if F else None)
