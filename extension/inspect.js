(() => {
  const url = new URL(location.href);
  const id = url.pathname.match(/^\/reel\/(\d+)\/?$/)?.[1]
    || url.pathname.match(/\/videos\/(?:[^/]+\/)?(\d+)\/?$/)?.[1]
    || url.searchParams.get('v');
  if (!id) return null;
  const dates = new Set();
  const counts = new Set();
  const dateKeys = new Set(['creation_time','publish_time','published_time','uploadDate','datePublished']);
  const countKeys = new Set(['play_count','video_view_count','view_count','video_play_count','play_count_reduced']);
  function dateValue(value, key) {
    let d;
    if (typeof value === 'number' || /^\d{10,13}$/.test(String(value))) {
      const n=Number(value); d=new Date(n < 1e12 ? n*1000:n);
    } else if (typeof value === 'string' && /^\d{4}-\d\d-\d\d/.test(value)) d=new Date(value);
    if (d && Number.isFinite(d.getTime()) && d.getFullYear()>=2004 && d.getTime()<=Date.now()+86400000) {
      dates.add(`${d.toLocaleString()} (${key})`);
    }
  }
  // Only read fields on the matching video or its immediate post wrapper.
  // A global first-match timestamp could belong to a comment or another reel.
  function collect(obj) {
    for (const [key,value] of Object.entries(obj)) {
      if (dateKeys.has(key)) dateValue(value,key);
      if (countKeys.has(key) && (typeof value==='number' || typeof value==='string') && /^[\d,.\sKMBkmb]+$/.test(String(value))) {
        counts.add(`${value} (${key})`);
      }
    }
  }
  function scan(root) {
    const stack=[root]; let visited=0;
    while (stack.length && visited++<250000) {
      const obj=stack.pop();
      if (!obj || typeof obj!=='object') continue;
      const ownMatch=String(obj.id)===id || String(obj.video_id)===id;
      const childMatch=String(obj.video?.id)===id;
      if (ownMatch || childMatch) {
        collect(obj);
        if (childMatch) collect(obj.video);
      }
      for (const value of Object.values(obj)) if (value && typeof value==='object') stack.push(value);
    }
  }
  for (const script of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
    try {scan(JSON.parse(script.textContent));} catch {}
  }
  const text=`Video: ${id}\n\nDate / time: ${dates.size ? [...dates].join('\n') : 'Not exposed in readable page data.'}\n\nViews / plays: ${counts.size ? [...counts].join('\n') : 'Not exposed in readable page data.'}\n\nDates are in your computer’s timezone. Fields report Facebook metadata; creation time may differ from public publication time. Plays and views may use different counting rules.`;
  document.getElementById('fb-reel-details-panel')?.remove();
  const host=document.createElement('div'); host.id='fb-reel-details-panel';
  const shadow=host.attachShadow({mode:'open'});
  const style=document.createElement('style');
  style.textContent=':host{all:initial;position:fixed;bottom:18px;right:18px;z-index:2147483647;width:340px;max-width:calc(100vw - 36px)}section{font:13px/1.5 system-ui;background:#fff;color:#182338;padding:18px;border:1px solid #ccd6e5;border-radius:12px;box-shadow:0 5px 30px #0004;max-height:65vh;overflow:auto}button{float:right;cursor:pointer;border:0;background:#e9eef6;border-radius:4px;padding:4px 8px}h2{font-size:16px;margin:0 0 12px}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}';
  const panel=document.createElement('section');
  const close=document.createElement('button');close.textContent='Close';close.onclick=()=>host.remove();
  const heading=document.createElement('h2');heading.textContent='Facebook Reel Details';
  const body=document.createElement('p');body.textContent=text;
  panel.append(close,heading,body);shadow.append(style,panel);document.documentElement.append(host);
  return {id,text};
})();
