import io,json,struct,tempfile,importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('host','helper/host.py');host=importlib.util.module_from_spec(spec);spec.loader.exec_module(host)
def exercise(slide=None,count=None,entries=None,poster='',outputs=1):
 with tempfile.TemporaryDirectory() as tmp:
  paths=[Path(tmp)/f'clip{i}.mp4' for i in range(outputs)]
  for path in paths:path.write_bytes(b'original')
  request={'action':'download','url':'https://www.instagram.com/p/test/'}
  if slide is not None:request.update(slide=slide,slideCount=count,poster=poster)
  data=json.dumps(request).encode();sent=[];commands=[];converted=[]
  def run(args,**kwargs):
   if '--dump-single-json' in args:return SimpleNamespace(stdout=json.dumps({'entries':entries}))
   converted.append(args);Path(args[-1]).write_bytes(b'compatible');return SimpleNamespace(returncode=0)
  def popen(args,**kwargs):
   commands.append(args);return SimpleNamespace(stdout=iter(str(p)+'\n' for p in paths),wait=lambda:0)
  with patch.object(host.sys,'stdin',SimpleNamespace(buffer=io.BytesIO(struct.pack('@I',len(data))+data))),patch.object(host,'send',sent.append),patch.object(host.shutil,'which',lambda x:'/bin/'+x),patch.object(host.Path,'home',lambda:Path(tmp)),patch.object(host.subprocess,'run',run),patch.object(host.subprocess,'Popen',popen):
   try:host.main();error=None
   except ValueError as e:error=str(e)
  return commands,converted,sent,error
commands,converted,sent,error=exercise(3,8,[{'id':str(i)} for i in range(8)])
assert commands[0][commands[0].index('--playlist-items')+1]=='3'
assert len(converted)==1 and sent[-1]['ok']
commands,_,_,error=exercise(3,8,[{'id':'video'}]);assert not commands and 'safely identify' in error
commands,_,_,error=exercise(3,8,[{'id':'video','thumbnails':[{'url':'https://cdn.example/poster.jpg'}]}],'https://cdn.other/poster.jpg')
assert commands[0][commands[0].index('--playlist-items')+1]=='1'
_,converted,sent,error=exercise(outputs=3);assert len(converted)==3 and sent[-1]['ok']
print('PASS: selected carousel entry, mixed-carousel safety, poster matching, conversion of every output.')
