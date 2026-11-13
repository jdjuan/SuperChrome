(() => {
const root=document.querySelector('#download-panel'),find=id=>root.querySelector('#'+id);
const input=find('url'),status=find('download-status'),setup=find('helper-setup'),setupStatus=find('helper-setup-status'),download=find('download');
let available=false,checking=false,dismissed=false,needsHelper=false;
const siteOf=value=>{try{const url=new URL(value);if(url.protocol!=='https:')return null;const h=url.hostname;if(/^(www\.|m\.)?youtube\.com$|^youtu\.be$/.test(h))return 'youtube';if(/^(www\.)?instagram\.com$/.test(h))return 'instagram';if(/^(www\.|mobile\.)?(x|twitter)\.com$/.test(h))return 'x';}catch{}return null;};
async function render(){
 const site=siteOf(input.value.trim());
 const helperNeeded=!available&&(site==='youtube'||needsHelper);
 setup.hidden=available||dismissed||!helperNeeded;find('show-helper-setup').hidden=available||!setup.hidden;
 download.disabled=!site||(site==='youtube'&&!available);
 if(!input.value.trim()){status.textContent='Paste a link to begin.';return;}
 if(!site){status.textContent='Enter a YouTube, Instagram or X link.';return;}
 if(site==='youtube'&&!available){status.textContent=checking?'Checking local helper…':'YouTube downloads need the local helper. Set it up once with the prompt above.';return;}
 const {job}=await chrome.storage.local.get('job');status.textContent=job?.url===input.value.trim()&&job.message?job.message:'Ready.';
}
function check(){
 if(checking)return;checking=true;find('check-helper').disabled=true;render();
 chrome.runtime.sendMessage({action:'ping'},r=>{
  const error=chrome.runtime.lastError?.message;available=!error&&r?.ok===true;checking=false;find('check-helper').disabled=false;
  setupStatus.textContent=available?'':(r?.error&&!/not found/i.test(r.error)?r.error:'Helper not connected.');
  if(available)needsHelper=false;render();
 });
}
function prompt(){
 const id=chrome.runtime.id||'lfbikaodomamodnmfheahbcbkdkaggai';
 return `Set up the SuperChrome local video-download helper on my computer (needed for YouTube; Instagram and X download without it) for Chrome and/or Brave. Detect my OS and installed browsers first. This is a one-time local setup, not a server. Explain any system changes or installation approvals your tools require. Do not change browser security settings or read browser cookies, credentials, history or profiles.

1. Install or locate Python 3, yt-dlp and FFmpeg using reputable platform package managers or official sources. Verify each executable works by running it (yt-dlp --version, ffmpeg -version). Don't assume Homebrew, Apple Silicon, or a particular username. On macOS install yt-dlp with Homebrew (brew install yt-dlp) or pip/pipx, never the standalone yt-dlp_macos download: macOS blocks its bundled Python ("library load disallowed by system policy"). Include dependency executable directories in the helper launcher's PATH.
2. Save the Python source below in a stable user-owned application-data folder, not a temporary directory. Create an executable launcher which uses the absolute Python executable and the absolute helper file. On Windows create a supported native host executable/launcher rather than assuming a Unix shebang works. Keep stdout exclusively for native-messaging JSON frames; diagnostics go to stderr.
3. Register a native messaging host named io.jdjuan.local_video with type stdio, path set to that absolute launcher/executable, and allowed_origins exactly ["chrome-extension://${id}/"]. Do not allow wildcard origins.
4. macOS: write io.jdjuan.local_video.json in ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/ and/or ~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/ for installed browsers. Linux: use the installed browser's documented user-level NativeMessagingHosts directory. Windows: create a host manifest and the documented HKCU native-messaging registry entry for each browser (Chrome: Software\\Google\\Chrome\\NativeMessagingHosts\\io.jdjuan.local_video; Brave: Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\io.jdjuan.local_video), default value = absolute manifest path. Verify platform/browser registration against official documentation before writing. Preserve unrelated registrations.
5. Test the host with a native-messaging ping: UTF-8 JSON {"action":"ping"} preceded by its 4-byte native-endian unsigned length; expect {"ok":true}. Read back the registration and verify its path and allowed origin. In SuperChrome → Save, use Check again to verify the browser can connect. Do not claim completion based only on installing dependencies. Restart the browser only if required, without losing user work.
6. Downloads go to ~/Downloads (the current user's home). Download only videos I am authorized to save. Do not start a download until I choose one. Give me brief maintenance and uninstall instructions.

Extension ID for this installation: ${id}
Host source (save as host.py):

${globalThis.superChromeHelperSource||'Helper source unavailable: ask me for helper/host.py before proceeding.'}`;
}
find('copy-helper-prompt').onclick=async()=>{try{await navigator.clipboard.writeText(prompt());setupStatus.textContent='Copied. Paste into your AI.';}catch{setupStatus.textContent='Copy failed. Try again.';}};
find('check-helper').onclick=check;
find('dismiss-helper').onclick=()=>{dismissed=true;render();};
find('show-helper-setup').onclick=()=>{dismissed=false;needsHelper=true;render();};
input.addEventListener('input',render);
chrome.storage.onChanged.addListener(changes=>{const job=changes?.job?.newValue;if(job?.needsHelper&&!available){needsHelper=true;dismissed=false;}render();});
download.onclick=()=>{const url=input.value.trim(),site=siteOf(url);if(!site||(site==='youtube'&&!available))return;chrome.runtime.sendMessage({action:'download',url},r=>{status.textContent=chrome.runtime.lastError?.message||r?.error||'Download started…';});};
chrome.tabs.query({active:true,currentWindow:true},tabs=>{input.value=tabs[0]?.url||'';render();});
check();
})();
