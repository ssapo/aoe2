# usage: python3 J_edit.py file  (reads pairs from J_edit_spec.py: EDITS=[(old,new),...]) keeps line endings
import sys,runpy
f=sys.argv[1]; spec=runpy.run_path(sys.argv[2])['EDITS']
b=open(f,'rb').read(); crlf=b'\r\n' in b
s=b.decode('utf-8')
if crlf: s=s.replace('\r\n','\n')
for old,new in spec:
    n=s.count(old)
    if n!=1: sys.exit('count %d for %r'%(n,old[:80]))
    s=s.replace(old,new)
if crlf: s=s.replace('\n','\r\n')
open(f,'wb').write(s.encode('utf-8')); print('ok',f,'crlf' if crlf else 'lf')
