from emu2 import *
import itertools
P0=[fb('41dbb6ca'),f32(0),fb('424bb255')]
truth=['41dbd503 424baa1c','41dbf33c 424ba1e3','41dc1175 424b99aa','41dc2fae 424b9171','41dc4de7 424b8938','41dc6c20 424b80ff','41dc8a59 424b78c6','41dca890 424b708c','41dcc6c7 424b6852','41dce500 424b6019','41dd0339 424b57e0','41dd2172 424b4fa7','41dd3fab 424b476e','41dd5de4 424b3f35']
def run(F,verbose=False):
    P=P0; n=0; log=[]
    for i,t in enumerate(truth):
        if i>0:
            D=direction_to(P,W); F,a=steer(F,D)
        else: a=f32(0)
        P=move(P,F,0.021)
        log.append((hx(a),hx(F[0]),hx(F[2])))
        if hx(P[0])+' '+hx(P[2])!=t: break
        n+=1
    return n,log
Fprev=[fb('3f7ca5e5'),f32(0),fb('be252a6e')]
D=direction_to(P0,W); F1,a=steer(Fprev,D); print('python first turn',hx(a),hx(F1[0]),hx(F1[2]),'engine 3eac398c 3f60dc1d bef4bcb7')
bx=int('3f60dc1d',16); bz=int('bef4bcb7',16)
for dx in range(-3,4):
    for dz in range(-3,4):
        F=[fb('%08x'%(bx+dx)),f32(0),fb('%08x'%(bz+dz))]
        n,log=run(F)
        if n>=8: print(dx,dz,n,[l[0] for l in log])
print('---')
for dx in range(-3,4):
    for dz in range(-3,4):
        F=[fb('%08x'%(bx+dx)),f32(0),fb('%08x'%(bz+dz))]
        n,log=run(F)
        if n>=5: print(dx,dz,n,[l[0][-4:] for l in log])
