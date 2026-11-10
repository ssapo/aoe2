from emu3 import *
print('=====')
for dx in range(-12,13):
    for dz in range(-12,13):
        F=[fb('%08x'%(bx+dx)),f32(0),fb('%08x'%(bz+dz))]
        n,log=run(F)
        if n>=8: print(dx,dz,n,[l[0][-4:] for l in log])
