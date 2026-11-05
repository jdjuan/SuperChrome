#!/opt/homebrew/bin/python3
import json,struct,sys,subprocess,os,shutil
from pathlib import Path
from urllib.parse import urlsplit
os.environ['PATH']=os.pathsep.join(filter(None,[os.environ.get('PATH',''),'/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin']))
def send(value):
 data=json.dumps(value).encode();sys.stdout.buffer.write(struct.pack('@I',len(data))+data);sys.stdout.buffer.flush()
def main():
 header=sys.stdin.buffer.read(4)
 if len(header)!=4:return
 size=struct.unpack('@I',header)[0]
 if size>16384:raise ValueError('Message too large')
 request=json.loads(sys.stdin.buffer.read(size))
 if request.get('action')=='ping':
  missing=[tool for tool in ['yt-dlp','ffmpeg'] if not shutil.which(tool)]
  send({'ok':not missing,'error':'Missing: '+', '.join(missing)} if missing else {'ok':True});return
 if request.get('action')!='download':raise ValueError('Unknown action')
 url=request.get('url',''); parsed=urlsplit(url)
 if parsed.scheme!='https' or parsed.hostname not in {'youtube.com','www.youtube.com','m.youtube.com','youtu.be','instagram.com','www.instagram.com','x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'} or parsed.username or parsed.password:raise ValueError('Unsupported URL')
 folder=Path.home()/'Downloads';folder.mkdir(parents=True,exist_ok=True)
 yt_dlp=shutil.which('yt-dlp');ffmpeg=shutil.which('ffmpeg')
 if not yt_dlp or not ffmpeg:raise ValueError('Install yt-dlp and FFmpeg first')
 args=[yt_dlp,'--ignore-config','--no-playlist','--no-overwrites','--newline','--progress','--socket-timeout','30','--ffmpeg-location',str(Path(ffmpeg).parent),'--print','after_move:filepath','--no-simulate','-f','bv*[vcodec^=avc1]+ba[ext=m4a]/b[vcodec^=avc1]/best','--merge-output-format','mp4','-o',str(folder/'%(title).150B [%(id)s].%(ext)s'),'--',url]
 process=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 tail=[];output=None
 for line in process.stdout:
  line=line.strip()
  if line and Path(line).is_file():output=Path(line)
  if line:tail.append(line);tail=tail[-8:];send({'message':line})
 code=process.wait()
 if code==0:
  if not output:raise ValueError('Download output could not be verified')
  send({'message':'Preparing compatible MP4…'})
  converted=output.with_name(output.stem+'.compatible.mp4')
  try:
   subprocess.run([ffmpeg,'-v','error','-nostdin','-y','-i',str(output),'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-crf','20','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(converted)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
   target=output.with_suffix('.mp4')
   converted.replace(target)
   if output!=target:output.unlink()
  finally:
   converted.unlink(missing_ok=True)
 send({'ok':code==0,'message':('Saved to '+str(folder)) if code==0 else 'Download failed. '+ '\n'.join(tail)})
if __name__=='__main__':
 try:main()
 except Exception as e:send({'ok':False,'message':str(e),'error':str(e)})
