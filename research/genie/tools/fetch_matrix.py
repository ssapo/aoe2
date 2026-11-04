import concurrent.futures,urllib.request,zipfile,io,pathlib,json
ids=[518470161,518239882,517426097,516956894,516746960,516495787,516293031,515741992]
r=pathlib.Path('genie-check/replays');r.mkdir(exist_ok=True)
def get(i):
 p=r/f'{i}.aoe2record'
 try:
  if not p.exists():
   with urllib.request.urlopen(f'https://aoe.ms/replay/?gameId={i}&profileId=26260702',timeout=35) as f:b=f.read(64*1024*1024+1)
   if len(b)>64*1024*1024:raise ValueError('download exceeds limit')
   z=zipfile.ZipFile(io.BytesIO(b));names=[n for n in z.infolist() if n.filename.endswith('.aoe2record') and n.file_size<=256*1024*1024]
   if len(names)!=1:raise ValueError('ambiguous replay archive')
   p.write_bytes(z.read(names[0]))
  return {'id':i,'status':'ready','bytes':p.stat().st_size}
 except Exception as e:return {'id':i,'status':'download_failed','reason':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:a=list(pool.map(get,ids))
(r/'downloads.json').write_text(json.dumps(a,indent=2));print(json.dumps(a))
