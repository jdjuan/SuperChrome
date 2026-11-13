#!/opt/homebrew/bin/python3
import json,struct,sys,subprocess,os,shutil
from pathlib import Path
from urllib.parse import urlsplit
os.environ['PATH']=os.pathsep.join(filter(None,[os.environ.get('PATH',''),'/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin']))
def send(value):
 data=json.dumps(value).encode();sys.stdout.buffer.write(struct.pack('@I',len(data))+data);sys.stdout.buffer.flush()
def explain(text):
 if 'PYI-' in text or 'disallowed by system policy' in text or 'Failed to load Python shared library' in text:return 'macOS blocked the standalone yt-dlp app. Reinstall yt-dlp with Homebrew (brew install yt-dlp) or pip (python3 -m pip install --user yt-dlp), remove the standalone yt-dlp_macos file, then click Check again.'
 return text[-1500:]
def saved_file(line):
 try:return len(line)<1024 and Path(line).is_absolute() and Path(line).is_file()
 except (OSError,ValueError):return False
def main():
 header=sys.stdin.buffer.read(4)
 if len(header)!=4:return
 size=struct.unpack('@I',header)[0]
 if size>16384:raise ValueError('Message too large')
 request=json.loads(sys.stdin.buffer.read(size))
 if request.get('action')=='ping':
  missing=[tool for tool in ['yt-dlp','ffmpeg'] if not shutil.which(tool)]
  if missing:send({'ok':False,'error':'Missing: '+', '.join(missing)});return
  try:
   check=subprocess.run([shutil.which('yt-dlp'),'--version'],capture_output=True,text=True,timeout=60)
   if check.returncode!=0:raise ValueError(check.stdout+check.stderr)
  except Exception as e:send({'ok':False,'error':explain(str(e))});return
  send({'ok':True});return
 if request.get('action')!='download':raise ValueError('Unknown action')
 url=request.get('url',''); parsed=urlsplit(url)
 if parsed.scheme!='https' or parsed.hostname not in {'youtube.com','www.youtube.com','m.youtube.com','youtu.be','instagram.com','www.instagram.com','x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'} or parsed.username or parsed.password:raise ValueError('Unsupported URL')
 folder=Path.home()/'Downloads';folder.mkdir(parents=True,exist_ok=True)
 yt_dlp=shutil.which('yt-dlp');ffmpeg=shutil.which('ffmpeg')
 if not yt_dlp or not ffmpeg:raise ValueError('Install yt-dlp and FFmpeg first')
 selection=[]
 slide=request.get('slide')
 if slide is not None:
  if parsed.hostname not in {'instagram.com','www.instagram.com'} or type(slide) is not int or not 1<=slide<=100:raise ValueError('Invalid carousel slide')
  send({'message':'Finding selected carousel slide…'})
  metadata=subprocess.run([yt_dlp,'--ignore-config','--skip-download','--dump-single-json','--socket-timeout','30','--',url],capture_output=True,text=True,check=True)
  info=json.loads(metadata.stdout)
  entries=info.get('entries')
  if entries:
   poster=urlsplit(request.get('poster') or '').path.rsplit('/',1)[-1]
   matches=[i for i,e in enumerate(entries,1) if poster and any(urlsplit(t.get('url','')).path.rsplit('/',1)[-1]==poster for t in e.get('thumbnails',[]))]
   if len(matches)==1:index=matches[0]
   elif len(entries)==request.get('slideCount') and slide<=len(entries):index=slide
   else:raise ValueError('Could not safely identify the selected video in this mixed carousel. Open its individual post and retry.')
   selection=['--playlist-items',str(index)]
 args=[yt_dlp,*selection,'--ignore-config','--no-playlist','--no-overwrites','--newline','--progress','--socket-timeout','30','--ffmpeg-location',str(Path(ffmpeg).parent),'--print','after_move:filepath','--no-simulate','-f','bv*[vcodec^=avc1]+ba[ext=m4a]/b[vcodec^=avc1]/best','--merge-output-format','mp4','-o',str(folder/'%(title).150B [%(id)s].%(ext)s'),'--',url]
 process=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 tail=[];outputs=[]
 for line in process.stdout:
  line=line.strip()
  if line and saved_file(line) and Path(line) not in outputs:outputs.append(Path(line))
  if line:tail.append(line);tail=tail[-8:];send({'message':line})
 code=process.wait()
 if code==0:
  if not outputs:raise ValueError('Download output could not be verified')
  for output in outputs:
   send({'message':'Preparing compatible MP4…'})
   converted=output.with_name(output.stem+'.compatible.mp4')
   try:
    subprocess.run([ffmpeg,'-v','error','-nostdin','-y','-i',str(output),'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-crf','20','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(converted)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    target=output.with_suffix('.mp4')
    converted.replace(target)
    if output!=target:output.unlink()
   finally:
    converted.unlink(missing_ok=True)
 send({'ok':code==0,'message':('Saved to '+str(folder)) if code==0 else 'Download failed. '+explain('\n'.join(tail))})
if __name__=='__main__':
 try:main()
 except Exception as e:send({'ok':False,'message':explain(str(e)),'error':explain(str(e))})
