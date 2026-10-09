export async function request(action,payload={}){
 const result=await chrome.runtime.sendMessage({action,...payload});
 if(!result?.ok)throw Error(result?.error||'Padlox is unavailable. Reload the extension and try again.');
 return result;
}
