import {request} from '../shared/client.js';
import {isSupportedUrl,hostnameFromUrl,normalizeDomain,buildOriginPatterns} from '../shared/utils.js';
const el=id=>document.getElementById(id);
let activeTab=null,currentDomain=null,currentDocumentId=null,permissionDomain=null;
async function render(){
 const state=await request('POPUP_STATE',{tabId:activeTab?.id||0});
 currentDocumentId=state.documentId;
 permissionDomain=state.domain||currentDomain;
 el('setup-screen').hidden=state.configured;el('main-screen').hidden=!state.configured;
 el('current-site-box').hidden=!currentDomain;el('unsupported-msg').hidden=!!currentDomain;
 el('current-site-domain').textContent=currentDomain||'';
 el('current-site-status').textContent=state.domain?(state.needsPermission?'Site access revoked — protection is unavailable':state.needsRepair?'Protection needs repair':state.unlocked?'This tab is unlocked':'This tab is locked'):'';
 el('protect-btn').hidden=!!state.domain&&!state.needsPermission&&!state.needsRepair;
 el('protect-btn').textContent=state.needsPermission?'Restore site access':state.needsRepair?'Retry protection':'Lock this site';
 el('lock-now-btn').hidden=!state.domain;
 el('lock-now-btn').disabled=!state.unlocked;
 el('lock-now-btn').textContent=state.unlocked?'Lock now':'Already locked';
 el('unlock-form').hidden=!state.domain||state.unlocked||state.needsPermission||state.needsRepair;
 el('sites-summary').textContent=state.count?`${state.count} site${state.count===1?'':'s'} protected`:'No protected websites yet.';
}
async function perform(button,errorId,operation){
 button.disabled=true;el(errorId).textContent='';
 try{await operation();await render()}catch(error){el(errorId).textContent=error.message}finally{button.disabled=false;}
}
function settings(){chrome.tabs.create({url:chrome.runtime.getURL('settings/settings.html')});}
el('settings-btn').addEventListener('click',settings);el('manage-sites-btn').addEventListener('click',settings);
el('setup-form').addEventListener('submit',event=>{
 event.preventDefault();const password=el('setup-password').value;
 if(password!==el('setup-confirm').value){el('setup-error').textContent='Passwords do not match.';return;}
 perform(el('setup-submit'),'setup-error',async()=>{try{await request('SETUP',{password})}finally{el('setup-password').value='';el('setup-confirm').value='';}});
});
el('protect-btn').addEventListener('click',()=>{
 // Request host access in the original click gesture, before awaiting worker work.
 const permission=chrome.permissions.request({origins:buildOriginPatterns(permissionDomain)});
 perform(el('protect-btn'),'protect-error',async()=>{
  if(!await permission)throw Error('Permission denied. Site was not protected.');
  await request('PROTECT',{tabId:activeTab.id});
 });
});
el('unlock-form').addEventListener('submit',event=>{
 event.preventDefault();const password=el('unlock-password').value;
 perform(el('unlock-submit'),'unlock-error',async()=>{try{await request('UNLOCK',{tabId:activeTab.id,password,documentId:currentDocumentId})}finally{el('unlock-password').value='';}});
});
el('lock-now-btn').addEventListener('click',()=>perform(el('lock-now-btn'),'protect-error',()=>request('LOCK',{tabId:activeTab.id})));
(async()=>{try{[activeTab]=await chrome.tabs.query({active:true,currentWindow:true});if(isSupportedUrl(activeTab?.url))currentDomain=normalizeDomain(hostnameFromUrl(activeTab.url));await render()}catch(error){el('startup-error').textContent=error.message}})();
