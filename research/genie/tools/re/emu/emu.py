import numpy as np, struct, math
f32=np.float32
def fb(hx): return np.frombuffer(bytes.fromhex(hx)[::-1],dtype='<f4')[0]
def hx(x): return f32(x).tobytes()[::-1].hex()
def sqrt(x): return np.sqrt(f32(x))
def normalize(v):
    l=sqrt(f32(f32(v[1]*v[1]+v[0]*v[0])+v[2]*v[2])); return [f32(v[0]/l),f32(v[1]/l),f32(v[2]/l)]
def direction_to(p,w):
    x=f32(w[0]-p[0]); z=f32(w[2]-p[2]); l=sqrt(f32(f32(x*x+f32(0))+z*z)); return [f32(x/l),f32(0),f32(z/l)]
def dot(a,b): return f32(f32(f32(a[0]*b[0])+f32(a[1]*b[1]))+f32(a[2]*b[2]))
if __name__=='__main__':
    P=[fb('41dc8a59'),f32(0),fb('424b78c6')]
    for W in ([31,0,49],[31.5,0,49.5],[30.5,0,49.5]):
        D=direction_to(P,[f32(W[0]),f32(0),f32(W[2])]); print(W,hx(D[0]),hx(D[2]))
    F=[fb('3f60dc1d'),f32(0),fb('bef4bcb7')]
    fl=normalize(F); print('flat',hx(fl[0]),hx(fl[2]))
    D=[fb('3f60dc10'),f32(0),fb('bef4bce3')]
    print('dot',hx(dot(D,fl)),hx(dot(fl,D)))
