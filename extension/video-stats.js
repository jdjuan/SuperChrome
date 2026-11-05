(() => {
  const url=new URL(location.href),host=url.hostname;
  const youtube=/(^|\.)(youtube\.com|youtu\.be)$/.test(host);
  const instagram=/(^|\.)instagram\.com$/.test(host);
  const id=youtube ? url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|live)\/([^/]+)/)?.[1] || (host==='youtu.be'?url.pathname.slice(1):null) : instagram ? url.pathname.match(/^\/(?:p|reel|reels)\/([^/]+)/)?.[1] : url.pathname.match(/\/status\/(\d+)/)?.[1];
  if(!id)return null;
  const dates=new Set(),views=new Set();
  const meta=key=>document.querySelector(`meta[itemprop="${key}"],meta[property="${key}"]`)?.content;
  const addDate=value=>{if(!value)return;const d=new Date(value);if(Number.isFinite(d.getTime()))dates.add(d.toLocaleString());};
  const addViews=value=>{if(value!==undefined&&value!==null&&/^[\d,.\sKMBkmb]+$/.test(String(value)))views.add(String(value));};
  // YouTube's item metadata belongs to the selected watch/Shorts page.
  if(youtube && matches(document.querySelector('link[rel=canonical]')?.href||location.href)){addDate(meta('datePublished')||meta('uploadDate'));addViews(meta('interactionCount'));}
  function matches(value){
    if(typeof value!=="string"||!value)return false;
    try{const u=new URL(value,location.href);return u.hostname.replace(/^www\./,'')===host.replace(/^www\./,'')&&(youtube ? (u.searchParams.get('v')===id||u.pathname.endsWith('/'+id)) : u.pathname.split('/').includes(id));}catch{return false;}
  }
  function scan(value,inherited=false){
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value)){for(const item of value)scan(item,inherited);return;}
    const match=matches(value.url)||matches(value.contentUrl)||matches(value.mainEntityOfPage?.['@id']||value.mainEntityOfPage);
    const video=[value['@type']].flat().includes('VideoObject');
    if(video&&(match||inherited)){
      addDate(value.uploadDate||value.datePublished);
      for(const item of [value.interactionStatistic].flat())if(item&&/WatchAction|ViewAction/.test(String(item.interactionType?.['@type']||item.interactionType)))addViews(item.userInteractionCount);
    }
    for(const [key,item] of Object.entries(value))if(item&&typeof item==='object')scan(item,match&&key==='video');
  }
  for(const script of document.querySelectorAll('script[type="application/ld+json"]')){try{scan(JSON.parse(script.textContent));}catch{}}
  // Scope X timestamps to the matching post; recommendations are ignored.
  if(!youtube&&!instagram){for(const article of document.querySelectorAll('article')){const link=[...article.querySelectorAll('a[href]')].find(a=>matches(a.href)&&a.querySelector('time'));if(link){addDate(link.querySelector('time')?.dateTime);const analytics=[...article.querySelectorAll('a[href]')].find(a=>new URL(a.href,location.href).pathname.endsWith('/status/'+id+'/analytics'));const count=analytics?.textContent?.trim().replace(/ views?$/i,'');if(count)addViews(count);}}}
  const unavailable='Not exposed in readable page data.';
  const text=`Video: ${id}\n\nDate / time: ${dates.size?[...dates].join('\n'):unavailable}\n\nViews / plays: ${views.size?[...views].join('\n'):unavailable}\n\nDates use your computer’s timezone. These are public page values, not private creator analytics. Some platforms do not expose these fields.`;
  return {id,text};
})();
