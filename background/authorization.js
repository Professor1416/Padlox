import {createVerifier, verifyPassword} from '../shared/crypto.js';
import {isSupportedUrl, normalizeDomain, hostnameFromUrl, findProtectedDomain, buildOriginPatterns} from '../shared/utils.js';

import {UNLOCKED_KEY as UNLOCKS, SETTINGS_GRANTS_KEY as GRANTS, ATTEMPTS_KEY as ATTEMPTS, CONFIG_KEY, SITES_KEY} from '../shared/storage.js';
const schemas={STATUS:[],POPUP_STATE:['tabId'],SETUP:['password'],PROTECT:['tabId'],UNLOCK:['tabId','password','documentId'],LOCK:['tabId'],AUTH_SETTINGS:['password'],LIST_SITES:[],REMOVE_SITE:['domain','password'],RESET:['password'],CHANGE_PASSWORD:['password','next']};
const popupActions=new Set(['POPUP_STATE','SETUP','PROTECT','UNLOCK','LOCK']);
const settingsActions=new Set(['AUTH_SETTINGS','LIST_SITES','REMOVE_SITE','RESET','CHANGE_PASSWORD']);

// One queue owns all read/verify/write transitions, including failed attempts.
// The durable session records survive worker suspension, but not browser restart.
export function createAuthorization(api,now=Date.now){
 let queue=Promise.resolve();
 const get=async(area,key)=>(await api.storage[area].get(key))[key];
 const set=async(area,key,value)=>api.storage[area].set({[key]:value});
 const grantKey=sender=>`${sender.tab.id}:${sender.documentId}`;
 async function authenticate(password){
  const attempts=await get('session',ATTEMPTS)||{count:0,lockUntil:0};
  if(now()<attempts.lockUntil)throw Error(`Try again in ${Math.ceil((attempts.lockUntil-now())/1000)}s.`);
  const config=await get('local',CONFIG_KEY);
  if(!config)throw Error('Open Padlox to create your password first.');
  let valid;try{valid=await verifyPassword(password,config)}catch{throw Error('Padlox password data is invalid.');}
  if(!valid){const count=attempts.count+1;await set('session',ATTEMPTS,{count,lockUntil:now()+Math.min(count*1000,15000)});throw Error('Incorrect password.');}
  await api.storage.session.remove(ATTEMPTS);
 }
 async function target(tabId){
  const tab=await api.tabs.get(tabId);
  if(!isSupportedUrl(tab.url))throw Error('This page cannot be protected.');
  return {tab,domain:normalizeDomain(hostnameFromUrl(tab.url))};
 }
 async function currentDocument(tabId){
  const results=await api.scripting.executeScript({target:{tabId},func:()=>true});
  if(!results[0]?.documentId)throw Error('Reload this tab and try again.');
  return results[0].documentId;
 }
 async function revokeAll(){await api.storage.session.remove([UNLOCKS,GRANTS,'padlox_unlocked','padlox_attempts']);}
 async function run(message,sender){
  try{
   if(!message||typeof message!=='object'||Array.isArray(message)||typeof message.action!=='string'||!Object.hasOwn(schemas,message.action))throw Error('Invalid request.');
   const fields=schemas[message.action];
   if(Object.keys(message).some(k=>k!=='action'&&!fields.includes(k))||fields.some(k=>!Object.hasOwn(message,k)))throw Error('Invalid request.');
   if(sender?.id!==api.runtime.id)throw Error('Unauthorized request.');
   const popup=sender.url===api.runtime.getURL('popup/popup.html')&&!sender.tab;
   const settings=sender.url===api.runtime.getURL('settings/settings.html')&&Number.isInteger(sender.tab?.id)&&sender.frameId===0&&typeof sender.documentId==='string'&&!!sender.documentId;
   const content=Number.isInteger(sender.tab?.id)&&sender.frameId===0&&typeof sender.documentId==='string'&&!!sender.documentId&&isSupportedUrl(sender.url);
   const action=message.action;
   if(action==='STATUS'?!content:popupActions.has(action)?!popup:settingsActions.has(action)?!settings:true)throw Error('Unauthorized request.');
   if(fields.includes('tabId')&&(!Number.isInteger(message.tabId)||message.tabId<0))throw Error('Invalid tab.');
   if(fields.includes('documentId')&&(typeof message.documentId!=='string'||!message.documentId||message.documentId.length>256))throw Error('Invalid request.');
   for(const key of ['password','next'])if(fields.includes(key)&&(typeof message[key]!=='string'||message[key].length>1024))throw Error('Invalid password.');
   if(fields.includes('domain')&&(typeof message.domain!=='string'||message.domain.length>253))throw Error('Invalid domain.');
   const sites=await get('local',SITES_KEY)||{};
   if(action==='STATUS'){
    const domain=findProtectedDomain(hostnameFromUrl(sender.url),sites);
    const record=(await get('session',UNLOCKS)||{})[sender.tab.id];
    return {ok:true,protected:!!domain,unlocked:!!domain&&record?.documentId===sender.documentId&&record.domain===domain};
   }
   if(action==='SETUP'){
    if(await get('local',CONFIG_KEY)||Object.keys(sites).length)throw Error('Padlox is already configured.');
    if(message.password.length<4)throw Error('Password must be at least 4 characters.');
    await set('local',CONFIG_KEY,await createVerifier(message.password));await revokeAll();return {ok:true};
   }
   if(settings&&action!=='AUTH_SETTINGS'){
    const grants=await get('session',GRANTS)||{};
    if(!(grants[grantKey(sender)]>now()))throw Error('Authenticate Settings again.');
   }
   if(action==='AUTH_SETTINGS'){
    await authenticate(message.password);const grants=Object.fromEntries(Object.entries(await get('session',GRANTS)||{}).filter(([,expires])=>expires>now()));
    grants[grantKey(sender)]=now()+5*60*1000;await set('session',GRANTS,grants);return {ok:true,expiresInMs:5*60*1000};
   }
   if(action==='LIST_SITES')return {ok:true,sites};
   if(['REMOVE_SITE','RESET','CHANGE_PASSWORD'].includes(action)){
    if(action==='REMOVE_SITE'&&!Object.hasOwn(sites,message.domain))throw Error('Site is no longer protected.');
    if(action==='CHANGE_PASSWORD'&&message.next.length<4)throw Error('New password must be at least 4 characters.');
    await authenticate(message.password);
    if(action==='CHANGE_PASSWORD'){
     // Revoke authorization first: a partial password write must not retain unlocks.
     await revokeAll();await set('local',CONFIG_KEY,await createVerifier(message.next));return {ok:true};
    }
    const domains=action==='RESET'?Object.keys(sites):[message.domain];
    for(const domain of domains){
     const registered=await api.scripting.getRegisteredContentScripts({ids:['padlox-'+domain]});
     if(registered.length)await api.scripting.unregisterContentScripts({ids:['padlox-'+domain]});
     await api.permissions.remove({origins:buildOriginPatterns(domain)});
     delete sites[domain];
    }
    if(action==='RESET')await revokeAll();
    else await api.storage.session.remove(UNLOCKS);
    if(action==='RESET')await api.storage.local.remove(['padlox_config','padlox_sites']);
    else await set('local',SITES_KEY,sites);
    return {ok:true};
   }
   if(action==='POPUP_STATE'){
    const configured=!!await get('local',CONFIG_KEY);
    let domain=null,unlocked=false,documentId=null;
    try{const t=await target(message.tabId);domain=findProtectedDomain(t.domain,sites);if(domain){const doc=await currentDocument(message.tabId);documentId=doc;const record=(await get('session',UNLOCKS)||{})[message.tabId];unlocked=record?.documentId===doc&&record.domain===domain}}catch{/* Unsupported tabs still permit password setup/settings access. */}
    return {ok:true,configured,domain,unlocked,documentId,count:Object.keys(sites).length};
   }
   const {domain:hostname}=await target(message.tabId);let domain=findProtectedDomain(hostname,sites);
   if(action==='PROTECT'){
    if(!await get('local',CONFIG_KEY))throw Error('Create your password first.');
    domain=domain||hostname;
    if(!await api.permissions.contains({origins:buildOriginPatterns(domain)}))throw Error('Site permission was not granted.');
    const id='padlox-'+domain;
    if(!(await api.scripting.getRegisteredContentScripts({ids:[id]})).length)await api.scripting.registerContentScripts([{id,matches:buildOriginPatterns(domain),js:['content/lock.js'],runAt:'document_start',world:'ISOLATED',persistAcrossSessions:true}]);
    sites[domain]={addedAt:now()};await set('local',SITES_KEY,sites);
    // Inject immediately into the current document. Protection never grants an unlock.
    await api.scripting.executeScript({target:{tabId:message.tabId},files:['content/lock.js']});return {ok:true};
   }
   if(!domain)throw Error('This site is not protected.');
   const unlocks=await get('session',UNLOCKS)||{};
   if(action==='LOCK'){delete unlocks[message.tabId];await set('session',UNLOCKS,unlocks);return {ok:true};}
   const documentId=await currentDocument(message.tabId);
   if(documentId!==message.documentId)throw Error('Tab changed. Try again.');
   await authenticate(message.password);
   if(await currentDocument(message.tabId)!==documentId)throw Error('Tab changed. Try again.');
   unlocks[message.tabId]={documentId,domain};await set('session',UNLOCKS,unlocks);return {ok:true};
  }catch(error){return {ok:false,error:['Invalid request.','Unauthorized request.','Invalid tab.','Invalid password.','Invalid domain.'].includes(error.message)||/^(Try again|Incorrect password|Authenticate Settings|Padlox|Open Padlox|This |Site |Create |Password |New password|Reload |Tab changed)/.test(error.message)?error.message:'Could not complete the action. Please try again.'};}
 }
 const handle=(message,sender)=>{const result=queue.then(()=>run(message,sender));queue=result.catch(()=>{});return result;};
 handle.clearTab=tabId=>{const result=queue.then(async()=>{const records=await get('session',UNLOCKS)||{};delete records[tabId];await set('session',UNLOCKS,records);const grants=await get('session',GRANTS)||{};for(const key of Object.keys(grants))if(key.startsWith(`${tabId}:`))delete grants[key];await set('session',GRANTS,grants)});queue=result.catch(()=>{});return result;};
 return handle;
}
