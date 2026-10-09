import {createAuthorization} from './authorization.js';
const authorize=createAuthorization(chrome);
// Restore storage boundaries and registrations on EVERY worker activation.
// Keep document-bound unlocks on normal suspension; capability changes revoke them.
const ready=Promise.all([
 chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),
 chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})
]).then(async()=>{
 const result=await authorize.reconcile(false);
 if(!result.ok)throw Error('Protection recovery failed.');
});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 ready.then(()=>authorize(message,sender)).then(result=>{
  respond(result);
  if(result.ok&&['UNLOCK','LOCK','PROTECT','REMOVE_SITE','RESET','CHANGE_PASSWORD'].includes(message.action)){
   notifyTabs().catch(()=>console.warn('Padlox: a tab could not be notified.'));
  }
 },()=>respond({ok:false,error:'Padlox could not initialize securely. Reload the extension.'}));
 return true;
});
async function notifyTabs(){
 const tabs=await chrome.tabs.query({});
 await Promise.all(tabs.map(tab=>chrome.tabs.sendMessage(tab.id,{action:'REFRESH_STATUS'}).catch(()=>{})));
}
async function reconcile(revoke=true){
 await ready;
 const result=await authorize.reconcile(revoke);
 if(!result.ok||result.issues.length)console.warn('Padlox: some sites need protection recovery. Open the popup to retry.');
 await notifyTabs();
}
chrome.tabs.onRemoved.addListener(id=>{ready.then(()=>authorize.clearTab(id)).catch(()=>{});});
chrome.permissions.onRemoved.addListener(()=>reconcile().catch(()=>console.warn('Padlox: permission recovery failed.')));
chrome.permissions.onAdded.addListener(()=>reconcile().catch(()=>console.warn('Padlox: permission recovery failed.')));
chrome.runtime.onInstalled.addListener(()=>{
 ready.then(()=>chrome.storage.session.remove(['padlox_unlocked','padlox_attempts','padlox_tab_unlocks','padlox_settings_grants']))
  .then(()=>reconcile()).catch(()=>console.warn('Padlox: startup failed.'));
});
chrome.runtime.onStartup.addListener(()=>reconcile(false).catch(()=>console.warn('Padlox: startup failed.')));
ready.catch(()=>console.warn('Padlox: trusted startup initialization failed.'));
