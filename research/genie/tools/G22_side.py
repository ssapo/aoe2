import json,re,struct,sys
# G22_side.py engine.err truth.jsonl ms0 ms1 id,id
ef,tf,a,b,ids=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),[int(x) for x in sys.argv[5].split(',')]
hx=lambda x: struct.pack('>f',x).hex()
E={}
for l in open(ef,errors='replace'):
    if l.startswith('OBJECT'):
        try: r=json.loads(l[7:])
        except Exception: continue
        if a<=r['ms']<=b and r['id'] in ids: E.setdefault(r['ms'],{})[r['id']]=r
with open(tf,'rb') as f:
    for line in f:
        m=re.search(rb'"ms":\s*(\d+)',line[:100])
        if not m: continue
        ms=int(m.group(1))
        if ms<a: continue
        if ms>b: break
        d=json.loads(line)
        for p in d['players']:
            for o in p['o']:
                if o[0] not in ids: continue
                e=E.get(ms,{}).get(o[0])
                ex=o[-1] if isinstance(o[-1],dict) else {}
                print('T',ms,o[0],o[2],o[3],hx(o[4]),hx(o[5]),o[6:10],'v=',ex.get('v'),'ai=',ex.get('ai'),'an=',ex.get('an'),'ao=',(ex.get('ao') or '')[:64])
                if e: print('E',ms,o[0],e['state'],e['held'],hx(e['position'][0]),hx(e['position'][1]),e['action_kind'],e['action_state'],e.get('ai'))
