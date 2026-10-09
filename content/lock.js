// No password or security storage is available in the website context.
(function(){
 if(window.__padloxInitialized)return;
 window.__padloxInitialized=true;
  const STYLES = `
    .padlox-overlay {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(10, 11, 13, 0.97);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .padlox-card {
      width: 300px;
      max-width: 88vw;
      padding: 32px 24px 22px;
      background: #17181c;
      border: 1px solid #2a2b30;
      border-radius: 14px;
      text-align: center;
      color: #f2f2f3;
      box-shadow: 0 20px 60px rgba(0,0,0,0.55);
    }
    .padlox-icon { font-size: 26px; margin-bottom: 10px; }
    .padlox-title { font-size: 15px; font-weight: 600; letter-spacing: 0.3px; margin-bottom: 4px; }
    .padlox-subtitle { font-size: 13px; color: #9a9ba3; margin-bottom: 20px; }
    .padlox-error { min-height: 16px; font-size: 12px; color: #ff6b6b; margin-top: 10px; }
    .padlox-footer { margin-top: 14px; font-size: 11px; color: #63646b; }
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
  shadow.innerHTML=`<style>${STYLES}</style><div class="padlox-overlay" role="dialog" aria-modal="true" aria-label="Padlox privacy lock"><div class="padlox-card"><div class="padlox-icon">🔒</div><div class="padlox-title">This tab is locked</div><p class="padlox-subtitle">Open the Padlox toolbar icon to enter your password and unlock this tab.</p><div class="padlox-footer" role="status">Checking protection…</div></div></div>`;
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
