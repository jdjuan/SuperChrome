(() => {
const root=document.querySelector('#download-panel'),find=id=>root.querySelector('#'+id);
const setup=find('helper-setup'),setupStatus=find('helper-setup-status');
let available=false,checking=false,dismissed=false;
function render(){
 setup.hidden=available||dismissed;
 find('show-helper-setup').hidden=available||!dismissed;
 find('helper-ready').hidden=!available;
}
function check(){
 if(checking)return;checking=true;find('check-helper').disabled=true;render();
 chrome.runtime.sendMessage({action:'ping'},r=>{
  const error=chrome.runtime.lastError?.message;available=!error&&r?.ok===true;checking=false;find('check-helper').disabled=false;
  setupStatus.textContent=available?'':(r?.error&&!/not found/i.test(r.error)?r.error:'Helper not connected.');
  render();
 });
}
function prompt(){
 const id=chrome.runtime.id||'lfbikaodomamodnmfheahbcbkdkaggai';
 return `Set up the SuperChrome local video-download helper on my computer (needed for YouTube; Instagram and X download without it) for Chrome and/or Brave. Detect my OS and installed browsers first. This is a one-time local setup, not a server. Explain any system changes or installation approvals your tools require. Do not change browser security settings or read browser cookies, credentials, history or profiles.

1. Install or locate Python 3, yt-dlp and FFmpeg using reputable platform package managers or official sources. Verify each executable works by running it (yt-dlp --version, ffmpeg -version). Don't assume Homebrew, Apple Silicon, or a particular username. On macOS install yt-dlp with Homebrew (brew install yt-dlp) or pip/pipx, never the standalone yt-dlp_macos download: macOS blocks its bundled Python ("library load disallowed by system policy"). Include dependency executable directories in the helper launcher's PATH.
2. Save the Python source below in a stable user-owned application-data folder, not a temporary directory. Create an executable launcher which uses the absolute Python executable and the absolute helper file. On Windows create a supported native host executable/launcher rather than assuming a Unix shebang works. Keep stdout exclusively for native-messaging JSON frames; diagnostics go to stderr.
3. Register a native messaging host named io.jdjuan.local_video with type stdio, path set to that absolute launcher/executable, and allowed_origins exactly ["chrome-extension://${id}/"]. Do not allow wildcard origins.
4. macOS: write io.jdjuan.local_video.json in ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/ and/or ~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/ for installed browsers. Linux: use the installed browser's documented user-level NativeMessagingHosts directory. Windows: create a host manifest and the documented HKCU native-messaging registry entry for each browser (Chrome: Software\\Google\\Chrome\\NativeMessagingHosts\\io.jdjuan.local_video; Brave: Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\io.jdjuan.local_video), default value = absolute manifest path. Verify platform/browser registration against official documentation before writing. Preserve unrelated registrations.
5. Test the host with a native-messaging ping: UTF-8 JSON {"action":"ping"} preceded by its 4-byte native-endian unsigned length; expect {"ok":true}. Read back the registration and verify its path and allowed origin. In SuperChrome → YouTube, use Check again to verify the browser can connect. Do not claim completion based only on installing dependencies. Restart the browser only if required, without losing user work.
6. Downloads go to ~/Downloads (the current user's home). Download only videos I am authorized to save. Do not start a download until I choose one. Give me brief maintenance and uninstall instructions.

Extension ID for this installation: ${id}
Host source (save as host.py):

${globalThis.superChromeHelperSource||'Helper source unavailable: ask me for helper/host.py before proceeding.'}`;
}
find('copy-helper-prompt').onclick=async()=>{try{await navigator.clipboard.writeText(prompt());setupStatus.textContent='Copied. Paste into your AI.';}catch{setupStatus.textContent='Copy failed. Try again.';}};
find('check-helper').onclick=check;
find('dismiss-helper').onclick=()=>{dismissed=true;render();};
find('show-helper-setup').onclick=()=>{dismissed=false;render();};
chrome.storage.onChanged.addListener(changes=>{if(changes?.job?.newValue?.needsHelper&&!available){dismissed=false;render();}});
check();
})();
