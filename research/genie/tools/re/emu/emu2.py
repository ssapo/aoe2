from emu import *
def acosf(x): return f32(math.acos(float(x)))
def yaw(F,ang):
    c=f32(math.cos(float(ang))); s=f32(math.sin(float(ang))); t=f32(f32(1)-c)
    # axis (0,1,0): m = [[c,0,s],[0,t+c,0],[-s,0,c]]  (engine rotation formulas)
    x,y,z=f32(0),f32(1),f32(0)
    xy=f32(f32(y*x)*t); xz=f32(f32(z*x)*t); yz=f32(f32(z*y)*t)
    m=[[f32(f32(x*x*t)+c), f32(xy-f32(z*s)), f32(f32(y*s)+xz)],
       [f32(f32(z*s)+xy), f32(f32(y*y*t)+c), f32(yz-f32(x*s))],
       [f32(xz-f32(y*s)), f32(f32(x*s)+yz), f32(f32(z*z*t)+c)]]
    v=F
    r=[f32(f32(f32(v[1]*m[0][1])+f32(v[0]*m[0][0]))+f32(v[2]*m[0][2])),
       f32(f32(f32(v[0]*m[1][0])+f32(v[1]*m[1][1]))+f32(v[2]*m[1][2])),
       f32(f32(f32(v[0]*m[2][0])+f32(v[1]*m[2][1]))+f32(v[2]*m[2][2]))]
    return normalize(r)
def cross_h(a,b):  # height comp of cross(a,b) per 96e790: out[1] = b0*a2 - a0*b2
    return f32(f32(b[0]*a[2])-f32(a[0]*b[2]))
def angle_between(a,b):
    d=dot(a,b)
    if abs(d)<f32(1e-7): return f32(math.pi/2)
    if d>=f32(1): return f32(0)
    if d<=f32(-1): return f32(math.pi)
    return acosf(d)
def steer(F,D):
    fl=normalize([F[0],f32(0),F[2]])
    a=angle_between(D,fl)
    if f32(0)<cross_h(D,fl): a=f32(-a)
    return yaw(F,a),a
def move(P,F,dt,speed=f32(0.8)):
    d=f32(f32(dt)*speed)
    return [f32(P[0]+f32(d*F[0])),f32(0),f32(P[2]+f32(d*F[2]))]
W=[f32(31),f32(0),f32(49)]
if __name__=='__main__':
    P0=[fb('41dc8a59'),f32(0),fb('424b78c6')]; F0=[fb('3f60dc1d'),f32(0),fb('bef4bcb7')]
    truth=['41dca890 424b708c','41dcc6c7 424b6852','41dce500 424b6019','41dd0339 424b57e0','41dd2172 424b4fa7']
    for name,q in [('none',0)]+[('acos(1-%d ulp) %s'%(k,sg),sg1*float(acosf(fb('%08x'%(0x3f800000-k))))) for k in (1,2,3,4) for sg,sg1 in (('+',1),('-',-1))]:
        P=P0; F=yaw(F0,f32(q)) if q else F0; out=[]
        for i in range(5):
            if i>0:
                D=direction_to(P,W); F,a=steer(F,D)
            else: a=q
            P=move(P,F,0.021); out.append('%s %s%s'%(hx(P[0]),hx(P[2]),'' if (hx(P[0])+' '+hx(P[2]))==truth[i] else '*'))
        print('%-22s'%name, out)
