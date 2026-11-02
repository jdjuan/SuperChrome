#!/opt/homebrew/bin/python3
import json,struct,sys,subprocess,os
from pathlib import Path
from urllib.parse import urlsplit
os.environ['PATH']='/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'
def send(value):
 data=json.dumps(value).encode();sys.stdout.buffer.write(struct.pack('@I',len(data))+data);sys.stdout.buffer.flush()
def main():
 header=sys.stdin.buffer.read(4)
 if len(header)!=4:return
 size=struct.unpack('@I',header)[0]
 if size>16384:raise ValueError('Message too large')
 request=json.loads(sys.stdin.buffer.read(size))
 if request.get('action')=='ping':send({'ok':True});return
 if request.get('action')!='download':raise ValueError('Unknown action')
 url=request.get('url',''); parsed=urlsplit(url)
 if parsed.scheme!='https' or parsed.hostname not in {'youtube.com','www.youtube.com','m.youtube.com','youtu.be','instagram.com','www.instagram.com','x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'} or parsed.username or parsed.password:raise ValueError('Unsupported URL')
 folder=Path.home()/'Downloads/Local Videos';folder.mkdir(parents=True,exist_ok=True)
 args=['/opt/homebrew/bin/yt-dlp','--ignore-config','--no-playlist','--no-overwrites','--newline','--progress','--socket-timeout','30','--ffmpeg-location','/opt/homebrew/bin','-f','bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best','--merge-output-format','mp4','-o',str(folder/'%(title).150B [%(id)s].%(ext)s'),'--',url]
 process=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 tail=[]
 for line in process.stdout:
  line=line.strip()
  if line:tail.append(line);tail=tail[-8:];send({'message':line})
 code=process.wait()
 send({'ok':code==0,'message':('Saved to '+str(folder)) if code==0 else 'Download failed. '+ '\n'.join(tail)})
if __name__=='__main__':
 try:main()
 except Exception as e:send({'ok':False,'message':str(e),'error':str(e)})
