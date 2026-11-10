from pe import *
import sys,capstone
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_64); md.detail=False
def dis(start,end=None,maxi=400):
    if end is None:
        F=fn(start); end=F[1] if F else start+0x100
    o=off(start); code=d[o:o+(end-start)]; out=[]
    for i,ins in enumerate(md.disasm(code,BASE+start)):
        if i>=maxi: break
        out.append('%x: %s %s'%(ins.address-BASE,ins.mnemonic,ins.op_str.replace('0x14','@0x14') if False else ins.op_str))
    return out
if __name__=='__main__':
    a=int(sys.argv[1],16); e=int(sys.argv[2],16) if len(sys.argv)>2 else None
    import re
    for l in dis(a,e,int(sys.argv[3]) if len(sys.argv)>3 else 400):
        m=re.search(r'rip ([+-]) (0x[0-9a-f]+)\]',l)
        print(l)
