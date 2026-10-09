import {createAuthorization} from './authorization.js';
import {buildOriginPatterns} from '../shared/utils.js';
const authorize=createAuthorization(chrome);
const ready=Promise.all([
 chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),
 chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})
]);
// Every worker activation restores the boundary before accepting requests.
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
chrome.tabs.onRemoved.addListener(id=>{ready.then(()=>authorize.clearTab(id)).catch(()=>{});});
async function restoreScripts(){
 await ready;
 const {padlox_sites:sites={}}=await chrome.storage.local.get('padlox_sites');
 const existing=new Set((await chrome.scripting.getRegisteredContentScripts()).map(s=>s.id));
 for(const domain of Object.keys(sites)){
  const id='padlox-'+domain;
  if(existing.has(id))continue;
  try{if(await chrome.permissions.contains({origins:buildOriginPatterns(domain)}))await chrome.scripting.registerContentScripts([{id,matches:buildOriginPatterns(domain),js:['content/lock.js'],runAt:'document_start',world:'ISOLATED',persistAcrossSessions:true}]);}catch{console.warn('Padlox: a protected site could not be registered.');}
 }
}
chrome.runtime.onInstalled.addListener(()=>{ready.then(()=>chrome.storage.session.remove(['padlox_unlocked','padlox_attempts','padlox_tab_unlocks','padlox_settings_grants'])).then(restoreScripts).catch(()=>console.warn('Padlox: startup failed.'));});
chrome.runtime.onStartup.addListener(()=>restoreScripts().catch(()=>console.warn('Padlox: startup failed.')));
ready.catch(()=>console.warn('Padlox: trusted storage initialization failed.'));
