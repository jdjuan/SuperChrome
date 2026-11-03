(() => {
 const API='https://api.github.com/repos/jdjuan/SuperChrome/releases/latest';
 const ROOT='https://github.com/jdjuan/SuperChrome/releases';
 const current=chrome.runtime.getManifest().version;
 const status=document.getElementById('update-status'),copy=document.getElementById('copy-update-prompt'),check=document.getElementById('check-updates');
 let latest=null,busy=false;
 const parts=v=>/^\d+(\.\d+){0,3}$/.test(v)?v.split('.').map(Number):null;
 function newer(a,b){a=parts(a);b=parts(b);if(!a||!b)return false;for(let i=0;i<4;i++){if((a[i]||0)!==(b[i]||0))return(a[i]||0)>(b[i]||0);}return false;}
 function validate(r){
  const version=String(r.tag_name||'').replace(/^v/,'');
  if(!parts(version)||r.draft||r.prerelease)throw Error('Invalid release');
  const base=`${ROOT}/download/v${version}/`;
  const asset=r.assets?.find(a=>a.name==='SuperChrome.zip');
  if(!asset||asset.browser_download_url!==base+'SuperChrome.zip')throw Error('Missing release package');
  return {version,url:asset.browser_download_url,checksum:base+'SHA256SUMS.txt'};
 }
 function render(r){latest=r;copy.hidden=!newer(r.version,current);status.textContent=copy.hidden?`v${current} · Up to date`:`v${r.version} available · Installed v${current}`;}
 async function refresh(force=false){
  if(busy)return;busy=true;check.disabled=true;
  try{
   const {superChromeUpdateCache:cache}=await chrome.storage.local.get('superChromeUpdateCache');
   if(!force&&cache&&Date.now()-cache.checkedAt>=0&&Date.now()-cache.checkedAt<86400000){if(cache.release)render(validate(cache.release));else status.textContent=`v${current} · Check unavailable`;return;}
   status.textContent='Checking updates…';
   const response=await fetch(API,{credentials:'omit',cache:'no-store',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('Check unavailable');
   const release=await response.json();render(validate(release));
   await chrome.storage.local.set({superChromeUpdateCache:{checkedAt:Date.now(),release}});
  }catch{
   status.textContent=`v${current} · Couldn’t check. Try again.`;
   // Cache failed attempts too, avoiding a request on every popup open.
   await chrome.storage.local.set({superChromeUpdateCache:{checkedAt:Date.now()}}).catch(()=>{});
  }finally{busy=false;check.disabled=false;}
 }
 copy.onclick=async()=>{
  if(!latest||!newer(latest.version,current))return;
  const prompt=`Update my existing SuperChrome extension from ${current} to ${latest.version} in Chrome and/or Brave. Download ${latest.url} and ${latest.checksum}. Verify the ZIP against SHA-256 before using it, and inspect the manifest and bundled sources. Find the existing installed extension folder; ask me for its location if needed. Back up the folder, then replace extension files IN PLACE using the folder containing manifest.json from the ZIP. Do not uninstall the extension, clear browser storage, overwrite unrelated files or change its manifest key. Preserve extension ID ${chrome.runtime.id} and browser preferences. The ZIP includes a helper subfolder; keep any existing helper and native-host registrations working, and only update them if needed after review. Use supported browser UI to reload SuperChrome in each installed browser, then refresh affected website tabs. If your tools cannot perform the reload, give me exact short steps rather than bypassing restrictions. Verify the loaded extension version is ${latest.version}, its ID is unchanged, and existing settings remain. Do not claim success just because files were extracted. Follow your tool approval requirements. No security setting changes, credentials or browser cookies are needed.`;
  try{await navigator.clipboard.writeText(prompt);status.textContent='Copied. Paste into your AI.';}catch{status.textContent='Copy failed. Try again.';}
 };
 check.onclick=()=>refresh(true);
 refresh();
})();
