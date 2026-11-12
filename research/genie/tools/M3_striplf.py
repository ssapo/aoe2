# usage: python3 runs/M3_striplf.py <name>   : <name>.raw -> <name>.patch with CR removed, prints sha256
import sys,hashlib
n=sys.argv[1]; b=open(n+'.raw','rb').read().replace(b'\r',b'')
open(n+'.patch','wb').write(b); print(len(b), hashlib.sha256(b).hexdigest())
