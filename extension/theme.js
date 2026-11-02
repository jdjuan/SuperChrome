(() => {
  if(globalThis.SuperChromeTheme)return;
  const palettes={
    light:{surface:'#ffffff',text:'#182238',muted:'#526078',button:'#edf1f8',border:'#bdc8da',accent:'#294cc7'},
    dark:{surface:'#1c2940',text:'#eef3ff',muted:'#b9c6dd',button:'#293346',border:'#65748c',accent:'#aec3ff'}
  };
  function rgba(value){const match=value?.match(/^rgba?\(([^)]+)\)$/);if(!match)return null;const parts=match[1].split(/[,\s/]+/).filter(Boolean).map(Number);return parts.length>=3?[...parts.slice(0,3),parts[3]??1]:null;}
  function mode(host){
    const backgrounds=[];
    for(let node=host.parentElement;node;node=node.parentElement){const color=rgba(getComputedStyle(node).backgroundColor);if(color&&color[3]>0)backgrounds.push(color);}
    let rgb=globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches?[18,18,18]:[255,255,255];
    for(const color of backgrounds.reverse())rgb=rgb.map((v,i)=>color[i]*color[3]+v*(1-color[3]));
    const linear=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
    return .2126*linear[0]+.7152*linear[1]+.0722*linear[2]>.35?'light':'dark';
  }
  function apply(host){
    if(!host?.isConnected)return;
    const theme=mode(host);
    if(host.dataset.superchromeTheme===theme)return;
    host.dataset.superchromeTheme=theme;
    host.style.setProperty('color-scheme',theme);
    for(const [key,value]of Object.entries(palettes[theme]))host.style.setProperty(`--sc-${key}`,value);
  }
  const css=`
    .canvas,section,.pill,.bar{color:var(--sc-text,#182238);background:var(--sc-surface,#fff);color-scheme:inherit}
    .canvas{border-radius:18px}.canvas .mark{background:var(--sc-accent,#294cc7)}.canvas h1,h2{color:var(--sc-text,#182238)}
    .canvas p{color:var(--sc-muted,#526078)}
    button{color:var(--sc-text,#182238);background:var(--sc-button,#edf1f8);border:1px solid var(--sc-border,#bdc8da)}
    button:hover{background:var(--sc-button,#edf1f8);border-color:var(--sc-accent,#294cc7)}
    button:focus-visible{outline:2px solid var(--sc-accent,#294cc7);outline-offset:3px}
    .pill{border-color:var(--sc-border,#bdc8da)}.pill button{color:var(--sc-accent,#294cc7)}
  `;
  function attach(host,shadow){const style=document.createElement('style');style.textContent=css;shadow.append(style);apply(host);}
  globalThis.SuperChromeTheme={apply,attach};
})();
