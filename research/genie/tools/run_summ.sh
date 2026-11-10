#!/bin/bash
# usage: summ.sh <name>  : checkpoints + resource grade summary of runs/<name>
cd "$(dirname "$0")"
f=$1
tail -3 $f.out | cut -c1-190
python3 - $f.err <<'P'
import re,sys
first={}; 
for l in open(sys.argv[1],errors='replace'):
    if l.startswith('CPWORDS'):
        m=re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\] eng=\[(.*?)\]',l)
        if not m: continue
        p=int(m.group(3)); rec=m.group(4).split(','); eng=m.group(5).split(',')
        for i,(a,b) in enumerate(zip(rec,eng)):
            if a.strip()!=b.strip() and (p,i) not in first: first[(p,i)]=int(m.group(2))
for p in (1,2):
    print('P%d first word mismatch (s):'%p, {i:round(first[(p,i)]/1000,1) for (q,i) in sorted(first) if q==p})
P
python3 grade_res.py $f.err --truth-dir ../truth/analysis --out /tmp/g_$f 2>&1 | grep "first difference > 0.01\|first difference > 50\|^|food|900\|^|wood|900" | cut -c1-150
