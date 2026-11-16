# Python copy of the engine's Well512 (math/rng.rs) for seed searches
M=0xffffffff
def jenkins(a):
    a=(a*0x1001+0x7ed55d16)&M
    a=(((a>>19)^a^0xc761c23c)*0x21)&M
    a=((((a+0xe9f8cc1d)&M) ^ (((a+0x165667b1)&M)*0x200&M))*9+0xfd7046c5)&M
    return (a>>16)^a^0xb55a4f09
def bswap(x): return int.from_bytes(x.to_bytes(4,'little'),'big')
def set_seed(seed):
    shift=bswap(seed)^0xaac29377; h=seed; st=[]
    for _ in range(16):
        shift^=(shift<<17)&M; shift^=shift>>13; shift^=(shift<<5)&M
        h=jenkins(h); st.append(shift^h)
    return st
def raw(s):
    v0=s[0]; t=s[13]
    z1=((((((v0<<1)&M)^t)<<15)&M)^t^v0)
    c=s[9]; z2=c^(c>>11); new1=z1^z2
    s[0]=new1; z0=s[15]
    s[15]=(z0 ^ ((((((((z2<<10)&M)^z1)<<16)&M) ^ z0)<<2)&M) ^ (((new1&0xfed22169)<<5)&M) ^ new1 ^ z1)&M
    s.insert(0,s.pop())
    return s[0]
def seed_all(seed, upto=11):
    out=[]
    for i in range(upto):
        st=set_seed(seed); seed=raw(st); out.append(st)
    return out
