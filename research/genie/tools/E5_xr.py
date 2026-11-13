# pure-python reader of the call index (no numpy): callers(dst) / callees(fn)
import sys, os, array
RE = os.environ.get('RE', r'C:\Users\ssapo\genie-replays\re-kit\re')
sys.path.insert(0, RE); sys.path.insert(0, os.path.join(RE, '..', 'python-deps'))
import pe
def load(n):
    b = open(os.path.join(RE, n), 'rb').read()
    hl = int.from_bytes(b[8:10], 'little'); a = array.array('q'); a.frombytes(b[10+hl:]); return a
SRC = load('calls_src.npy'); DST = load('calls_dst.npy')
def callers(dst):
    out = {}
    for s, d in zip(SRC, DST):
        if d == dst:
            f = pe.fn(s); out.setdefault(f[0] if f else None, []).append(s)
    return out
def callees(fn_start):
    f = pe.fn(fn_start); out = []
    for s, d in zip(SRC, DST):
        if f[0] <= s < f[1]: out.append((s, d))
    return sorted(out)
if __name__ == '__main__':
    mode, a = sys.argv[1], int(sys.argv[2], 16)
    if mode == 'to':
        for f, ss in sorted(callers(a).items(), key=lambda x: x[0] or 0):
            print('fn %x..%x' % (pe.fn(ss[0]) or (0, 0)), 'sites', ' '.join('%x' % s for s in ss[:8]))
    else:
        f = pe.fn(a); print('fn %x..%x size %x' % (f[0], f[1], f[1]-f[0]))
        for s, d in callees(a): print('  %x -> %x' % (s, d))
