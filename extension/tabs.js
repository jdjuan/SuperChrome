(() => {
 const tabs=[...document.querySelectorAll('[role=tab]')];
 const select=tab=>{for(const item of tabs){const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!active;}};
 tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();select(tabs[next]);tabs[next].focus();}});});
 chrome.tabs.query({active:true,currentWindow:true},([tab])=>{try{const url=new URL(tab?.url);if(/(^|\.)facebook\.com$/.test(url.hostname))select(tabs[1]);else if(guardPolicy.defaultFor(url.hostname))select(tabs[2]);}catch{}});
})();
