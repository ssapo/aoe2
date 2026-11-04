import pathlib,subprocess,os,json,time
r=pathlib.Path(os.environ.get('GENIE','genie-check'));out=r/'matrix';out.mkdir(exist_ok=True);rows=[]
exe=os.environ.get('CENSUS',str(r/'target/research/examples/census'));dat=os.environ.get('DAT','upload/empires2_x2_p1.dat');replays=pathlib.Path(os.environ.get('REPLAYS',str(r/'replays')))
for p in sorted(replays.glob('*.aoe2record')):
 start=time.monotonic();env=dict(os.environ,GENIE_EXPERIMENT_CAPTURE_SETUP='1')
 result=subprocess.run([exe,str(p),dat,'1500'],capture_output=True,text=True,env=env,timeout=90)
 (out/(p.stem+'.log')).write_text(result.stdout+result.stderr)
 rows.append({'game':p.stem,'exit':result.returncode,'seconds':round(time.monotonic()-start,3),'summary':[l for l in (result.stdout+result.stderr).splitlines() if l.startswith('player ') or 'updates (' in l or l.startswith('Error:')]})
 print(json.dumps(rows[-1]),flush=True)
(out/'summary.json').write_text(json.dumps(rows,indent=2))
