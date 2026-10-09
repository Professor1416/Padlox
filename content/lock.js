// No password or security storage is available in the website context.
(function(){
 if(window.__padloxInitialized)return;
 window.__padloxInitialized=true;
  const STYLES = `
:root, :host {
  --background: #0e0f12;
  --surface: #17181c;
  --surface-raised: #1c1d22;
  --accent: #4a6cf7;
  --action: #3d5be0;
  --action-hover: #344ec4;
  --text: #f2f2f3;
  --muted: #b3b6c1;
  --subtle: #9a9ba3;
  --error: #ff6b6b;
  --success: #93d9b0;
  --warning: #f0c477;
  --control-border: #686b78;
  --border: #363943;
  --focus: #9aaaff;
  --radius: 10px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* Runtime shadow styles are synchronized by npm run sync:styles. */
* { box-sizing: border-box; }
.padlox-overlay { position: fixed; inset: 0; width: 100vw; height: 100vh; background: var(--background); display: grid; place-items: center; padding: 24px; font: 14px/1.6 var(--font); color: var(--text); }
.padlox-card { width: 360px; max-width: 100%; padding: 32px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); text-align: center; }
.padlox-icon { width: 48px; height: 48px; border: 1px solid var(--border); border-radius: 12px; display: grid; place-items: center; color: var(--focus); margin: 0 auto 24px; }
.padlox-icon svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.8; }
.padlox-title { font-size: 21px; font-weight: 600; letter-spacing: -.4px; margin: 0 0 12px; }
.padlox-subtitle { color: var(--muted); margin: 0 0 24px; font-size: 14px; }
.padlox-footer { color: var(--subtle); font-size: 12px; border-top: 1px solid var(--border); padding-top: 16px; }
@media (max-width: 400px) { .padlox-overlay { padding: 16px; } .padlox-card { padding: 24px; } }
`;


 let host=null,revision=0,previousOverflow=null;
 const blockedEvents=['keydown','keyup','keypress','click','mousedown','mouseup','touchstart','wheel','contextmenu'];
 function blockEvent(event){
  if(host&&event.composedPath().includes(host))return;
  event.preventDefault();event.stopImmediatePropagation();
 }
 function removeCover(){
  if(!host)return;
  for(const type of blockedEvents)window.removeEventListener(type,blockEvent,true);
  if(previousOverflow){
   const [value,priority]=previousOverflow;
   if(value)document.documentElement.style.setProperty('overflow',value,priority);
   else document.documentElement.style.removeProperty('overflow');
  }
  host.remove();host=null;previousOverflow=null;
 }

 function cover(){
  if(host)return;
  host=document.createElement('div');host.id='padlox-host';
  host.style.cssText='all:initial;position:fixed;inset:0;z-index:2147483647';
  host.tabIndex=-1;
  const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>${STYLES}</style><div class="padlox-overlay" role="dialog" aria-modal="true" aria-label="Padlox privacy lock"><div class="padlox-card"><div class="padlox-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></div><h2 class="padlox-title">This tab is locked</h2><p class="padlox-subtitle">Open the Padlox toolbar icon to enter your password and unlock this tab.</p><div class="padlox-footer" role="status">Checking protection…</div></div></div>`;
  (document.documentElement||document).appendChild(host);
  if(document.documentElement){previousOverflow=[document.documentElement.style.getPropertyValue('overflow'),document.documentElement.style.getPropertyPriority('overflow')];document.documentElement.style.setProperty('overflow','hidden','important');}
  for(const type of blockedEvents)window.addEventListener(type,blockEvent,{capture:true,passive:false});
  host.focus();
 }
 async function refresh(){
  const current=++revision;cover();
  try{
   const status=await chrome.runtime.sendMessage({action:'STATUS'});
   if(current!==revision)return;
   if(!status?.ok)throw Error();
   if(!status.protected||status.unlocked){removeCover();}
   else if(host)host.shadowRoot.querySelector('.padlox-footer').textContent='Password entry stays inside Padlox.';
  }catch{
   if(current===revision&&host)host.shadowRoot.querySelector('.padlox-footer').textContent='Padlox is unavailable. Reload the extension and this tab.';
  }
 }
 chrome.runtime.onMessage.addListener((message,sender)=>{
  if(sender.id===chrome.runtime.id&&!sender.tab&&message?.action==='REFRESH_STATUS')refresh();
 });
 refresh();
})();
