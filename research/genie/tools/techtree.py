import struct,sys
class R:
    def __init__(s,h,p): s.h=h; s.p=p
    def u(s,f):
        v=struct.unpack_from('<'+f,s.h,s.p); s.p+=struct.calcsize('<'+f); return v[0] if len(v)==1 else v
    def ids(s,n): v=struct.unpack_from('<%dI'%n,s.h,s.p); s.p+=4*n; return v
def entry1(r):
    r.u('iB'); a=[]
    for _ in range(3): n=r.u('B'); a.append(r.ids(n))
    r.p+=84+1+10+10+1+4; return a
def entry2(r):
    bid,st=r.u('iB'); a=[]
    for _ in range(3): n=r.u('B'); a.append(r.ids(n))
    r.p+=84+1+5+5; nk,en=r.u('Ii'); return bid,st,nk,en
def entry3(r):
    uid,st,bf=r.u('iBi'); r.p+=84; g=r.u('i'); n=r.u('B'); r.ids(n); lv,tt,nk,en=r.u('iiIi'); return uid,st,bf,g,lv,tt,nk,en
def entry4(r):
    tid,st,rf=r.u('iBi'); a=[]
    for _ in range(3): n=r.u('B'); a.append(r.ids(n))
    r.p+=84; g,lv,nk=r.u('iiI'); return tid,st,rf,g,lv,nk
def parse(h,p,layout):
    r=R(h,p)
    if layout=='H1': A,B,U,T=r.u('BBBB'); extra=r.u('B'); G=r.u('i')
    elif layout=='H2': A,B,U,T=r.u('BBBB'); G=r.u('i'); extra=r.u('B')
    elif layout=='H3': A,B=r.u('BB'); U=r.u('H'); T=r.u('B'); G=r.u('i'); extra=None
    out=dict(A=A,B=B,U=U,T=T,G=G,extra=extra)
    ages=[entry1(r) for _ in range(A)]
    out['ages_end']=hex(r.p)
    bl=[entry2(r) for _ in range(B)]; out['b0']=bl[:3]; out['b_end']=hex(r.p)
    ul=[entry3(r) for _ in range(U)]; out['u0']=ul[:3]; out['ulast']=ul[-2:]; out['u_end']=hex(r.p)
    tl=[entry4(r) for _ in range(T)]; out['t0']=tl[:2]; out['tlast']=tl[-2:]
    out['end']=hex(r.p); out['after']=h[r.p:r.p+16].hex(' ')
    return out
if __name__=='__main__':
    h=open(sys.argv[1],'rb').read(); p=int(sys.argv[2],16)
    for L in sys.argv[3:]:
        try: print(L, parse(h,p,L))
        except Exception as e: print(L,'ERR',e)
