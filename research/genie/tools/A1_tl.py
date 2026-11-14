import json,sys,re
f=sys.argv[1]; ids=[int(x) for x in sys.argv[2].split(',')]; step=int(sys.argv[3]) if len(sys.argv)>3 else 40
last={};tick=0
for line in open(f,encoding='utf-8',errors='replace'):
    if line.startswith('OBJECT '):
        o=json.loads(line[7:]); tick=o['tick']
        if o['id'] not in ids: continue
        key=(o['action_kind'],o['action_state'],re.sub(r'idle=\d+','',o.get('ai','')))
        if key!=last.get(o['id']) or tick%step==0:
            p=o['position']; print(tick,o['ms'],o['id'],'(%.3f,%.3f)'%(p[0],p[1]),o['action_kind'],o['action_state'],o.get('ai','')[:70])
            last[o['id']]=key
    elif line.startswith('ANIMAL') or line.startswith('update ') and any(str(i) in line for i in ids):
        if 'ANIMAL' in line:
            m=re.search(r'pos=Position\(\[([\d.]+), ([\d.]+)',line) or re.search(r'from=Position\(\[([\d.]+), ([\d.]+)',line)
            if m and abs(float(m.group(1))-74)<6 and abs(float(m.group(2))-74)<6: print(' ',tick,line.strip()[:200])
        else: print(' ',line.strip()[:220])
