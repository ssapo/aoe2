# ENG-27: compare runs <new prefix> against <old prefix>: .out bytes and CPWORDS lines; prints the differing ones
import sys,glob,os
new,old=sys.argv[1],sys.argv[2]
for f in sorted(glob.glob(new+'_*.out')):
    tail=f[len(new):]; o=old+tail
    if not os.path.exists(o): print('NO BASE',f); continue
    a=open(f,'rb').read(); b=open(o,'rb').read()
    ca=[l for l in open(f[:-4]+'.err','rb') if l.startswith(b'CPWORDS')]
    cb=[l for l in open(o[:-4]+'.err','rb') if l.startswith(b'CPWORDS')]
    same_out=a==b; same_cp=ca==cb
    if same_out and same_cp: print('SAME',tail); continue
    print('DIFF',tail,'out' if not same_out else '','cp' if not same_cp else '', 'cps',len(ca),len(cb))
    for la,lb in zip(a.decode(errors='replace').splitlines(),b.decode(errors='replace').splitlines()):
        if la!=lb: print('  new:',la[:230]); print('  old:',lb[:230])
