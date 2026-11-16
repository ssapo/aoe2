# usage: seedsearch.py <truth jsonl> <ms> [K]: which SeedAll(s) seed (0..32767) and draw count k
# reproduce a word of the game's AI generator (0x4354d00 +0x20..+0x60) at that sample
import sys,json,re
import os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from rng import *
tf=sys.argv[1]; want=set(int(x) for x in sys.argv[2].split(',')); K=int(sys.argv[3]) if len(sys.argv)>3 else 6
for line in open(tf,'rb'):
    m=int(re.search(rb'"ms":(\d+)',line[:30]).group(1))
    if m not in want: continue
    a=re.search(rb'"airng":"([0-9A-F]+)"',line[:300]).group(1).decode(); rb=bytes.fromhex(a)
    words=set(int.from_bytes(rb[k:k+4],'little') for k in range(0x20,0x60,4))
    found=[]
    for s in range(32768):
        st=seed_all(s,5)[4]
        if any(w in words for w in st): found.append((s,0))
        for k in range(1,K+1):
            if raw(st) in words: found.append((s,k)); break
    print(m,'count',int.from_bytes(rb[0x18:0x20],'little'),found)
