const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

test('trusted popup/Settings and password-free overlay integrate with authorization controller',async t=>{
 const {createAuthorization}=await import('../background/authorization.js');
 const {createVerifier}=await import('../shared/crypto.js');
 const root=process.env.PADLOX_TEST_ROOT ? path.resolve(process.env.PADLOX_TEST_ROOT) : path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  if(req.url==='/site'){res.end('<html><body><button id="private">Private content</button></body></html>');return;}
  const file=path.join(root,new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const origin=`http://127.0.0.1:${server.address().port}`;
  async function fixture(){
   const local={padlox_config:await createVerifier('test-pin-123'),padlox_sites:{'example.com':{addedAt:1}}};const session={};let time=Date.now();
   const area=data=>({get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,structuredClone(data[k])])),set:async v=>Object.assign(data,structuredClone(v)),remove:async keys=>{for(const k of Array.isArray(keys)?keys:[keys])delete data[k]}});
   const api={runtime:{id:'padlox',getURL:p=>'chrome-extension://padlox/'+p},storage:{local:area(local),session:area(session)},tabs:{get:async id=>({id,url:'https://example.com/'})},permissions:{contains:async()=>true,remove:async()=>true},scripting:{executeScript:async()=>[{documentId:'site-a'}],getRegisteredContentScripts:async()=>[{id:'padlox-example.com',matches:['*://example.com/*','*://*.example.com/*'],js:['content/lock.js'],runAt:'document_start',world:'ISOLATED',persistAcrossSessions:true}],registerContentScripts:async()=>{},unregisterContentScripts:async()=>{}}};
   const handle=createAuthorization(api,()=>time);const context=await browser.newContext();const errors=[];
   context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
   await context.exposeBinding('__dispatch',async({page},message)=>{
    const pathname=new URL(page.url()).pathname;
    const sender=pathname.startsWith('/settings/')?{id:'padlox',url:api.runtime.getURL('settings/settings.html'),tab:{id:3},frameId:0,documentId:'settings-a'}:pathname.startsWith('/popup/')?{id:'padlox',url:api.runtime.getURL('popup/popup.html')}:{id:'padlox',url:'https://example.com/',tab:{id:1},frameId:0,documentId:'site-a'};
    return handle(message,sender);
   });
   await context.exposeFunction('__grantAccess',()=>{api.permissions.contains=async()=>true;return true;});
   await context.addInitScript(()=>{globalThis.__listeners=[];globalThis.chrome={runtime:{id:'padlox',getURL:p=>'chrome-extension://padlox/'+p,sendMessage:m=>__dispatch(m),onMessage:{addListener:f=>__listeners.push(f)}},tabs:{query:async()=>[{id:1,url:'https://example.com/'}],create:async()=>{}},permissions:{request:async()=>__grantAccess()}}});
   const page=await context.newPage();
   return {local,session,api,context,page,errors,tick:()=>time+=16000};
  }
  await t.test('Settings hides sensitive list until authenticated; wrong password cannot authorize',async()=>{
   const f=await fixture();try{await f.page.goto(origin+'/settings/settings.html');await f.page.locator('#settings-auth-submit').waitFor();assert.equal(await f.page.locator('#settings-dashboard').isVisible(),false);assert.equal(await f.page.locator('#sites-list').textContent(),'');
    await f.page.locator('#settings-auth-password').fill('wrong');await f.page.locator('#settings-auth-submit').click();await f.page.getByText('Incorrect password.',{exact:true}).waitFor();assert.equal(await f.page.locator('#settings-dashboard').isVisible(),false);f.tick();
    await f.page.locator('#settings-auth-password').fill('test-pin-123');await f.page.locator('#settings-auth-submit').click();await f.page.locator('#settings-dashboard').waitFor({state:'visible'});assert.equal(await f.page.locator('#modal-backdrop').isVisible(),false);
    if(process.env.PADLOX_SCREENSHOTS) await f.page.screenshot({path:'/tmp/padlox-settings.png',fullPage:true});
    await f.page.getByRole('button',{name:'Remove protection',exact:true}).click();await f.page.locator('#modal-password').fill('wrong');await f.page.locator('#modal-confirm').click();await f.page.getByText('Incorrect password.',{exact:true}).waitFor();assert(f.local.padlox_sites['example.com']);f.tick();
    await f.page.locator('#modal-password').fill('test-pin-123');await f.page.locator('#modal-confirm').click();await f.page.locator('#modal-backdrop').waitFor({state:'hidden'});assert.deepEqual(f.local.padlox_sites,{});assert.deepEqual(f.errors,[]);
   }finally{await f.context.close();}
  });
  await t.test('minimal UI keeps password visibility, modal focus and expiry cleanup predictable',async()=>{
   const f=await fixture();try{
    await f.page.goto(origin+'/settings/settings.html');
    await f.page.locator('#settings-auth-password').fill('test-pin-123');
    await f.page.locator('[aria-controls="settings-auth-password"]').click();
    assert.equal(await f.page.locator('#settings-auth-password').getAttribute('type'),'text');
    await f.page.locator('#settings-auth-submit').click();
    await f.page.locator('#settings-dashboard').waitFor({state:'visible'});
    assert.equal(await f.page.locator('#settings-auth-password').getAttribute('type'),'password');
    f.local.padlox_sites={['a'.repeat(63)+'.'+'b'.repeat(63)+'.example.com']:{addedAt:1}};
    await f.page.setViewportSize({width:360,height:740});
    await f.page.locator('#sites-search').fill('example');
    await f.page.getByText(Object.keys(f.local.padlox_sites)[0],{exact:true}).waitFor();
    assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await f.page.setViewportSize({width:1280,height:720});
    const remove=f.page.getByRole('button',{name:'Remove protection',exact:true});
    await remove.click(); await f.page.locator('#modal-password').waitFor();
    assert.equal(await f.page.locator('.page').evaluate(e=>e.inert),true);
    await f.page.locator('#modal-password').focus(); await f.page.keyboard.press('Shift+Tab');
    assert.equal(await f.page.locator('#modal-confirm').evaluate(e=>e===document.activeElement),true);
    await f.page.locator('[aria-controls="modal-password"]').click();
    await f.page.keyboard.press('Escape');
    assert.equal(await remove.evaluate(e=>e===document.activeElement),true);
    assert.equal(await f.page.locator('.page').evaluate(e=>e.inert),false);
    await remove.click();
    assert.equal(await f.page.locator('#modal-password').getAttribute('type'),'password');
    assert.equal(await f.page.locator('[aria-controls="modal-password"]').getAttribute('aria-pressed'),'false');
    await f.page.keyboard.press('Escape');
    await f.page.locator('#current-password').fill('visible secret');
    await f.page.locator('[aria-controls="current-password"]').click();
    f.session.padlox_settings_grants={};
    await f.page.evaluate(()=>__listeners.forEach(listener=>listener({action:'REFRESH_STATUS'},{id:'padlox'})));
    await f.page.locator('#settings-gate').waitFor({state:'visible'});
    assert.equal(await f.page.locator('#current-password').inputValue(),'');
    assert.equal(await f.page.locator('#current-password').getAttribute('type'),'password');
    assert.deepEqual(f.errors,[]);
   }finally{await f.context.close();}
  });
  await t.test('authenticated reset deletes data and completes without DOM cleanup errors',async()=>{
   const f=await fixture();try{await f.page.goto(origin+'/settings/settings.html');await f.page.locator('#settings-auth-password').fill('test-pin-123');await f.page.locator('#settings-auth-submit').click();await f.page.locator('#settings-dashboard').waitFor({state:'visible'});await f.page.locator('#reset-btn').click();await f.page.locator('#modal-password').fill('test-pin-123');await f.page.locator('#modal-confirm').click();await f.page.getByRole('heading',{name:'Padlox has been reset'}).waitFor();await f.page.evaluate(()=>__listeners.forEach(listener=>listener({action:'REFRESH_STATUS'},{id:'padlox'})));assert.equal(f.local.padlox_config,undefined);assert.deepEqual(f.errors,[])}finally{await f.context.close()}
  });
  await t.test('revoked access offers restoration and requires a fresh unlock afterward',async()=>{
   const f=await fixture();
   try{
    await f.page.goto(origin+'/popup/popup.html');
    await f.page.locator('#unlock-password').fill('test-pin-123');
    await f.page.locator('#unlock-submit').click();
    await f.page.getByText('This tab is unlocked',{exact:true}).waitFor();
    f.api.permissions.contains=async()=>false;
    await f.page.reload();
    await f.page.getByRole('button',{name:'Restore site access',exact:true}).waitFor();
    assert.equal(await f.page.locator('#unlock-form').isVisible(),false);
    await f.page.getByRole('button',{name:'Restore site access',exact:true}).click();
    await f.page.getByText('This tab is locked',{exact:true}).waitFor();
    assert.equal(f.session.padlox_tab_unlocks,undefined);
    await f.page.locator('#unlock-password').fill('test-pin-123');
    await f.page.locator('#unlock-submit').click();
    await f.page.getByText('This tab is unlocked',{exact:true}).waitFor();
    assert.deepEqual(f.errors,[]);
   }finally{await f.context.close();}
  });
  await t.test('Lock now remains disabled after success and remains retryable after an API failure',async()=>{
   const f=await fixture();try{
    await f.page.goto(origin+'/popup/popup.html');
    await f.page.locator('#unlock-password').fill('test-pin-123');
    await f.page.locator('#unlock-submit').click();
    await f.page.getByText('This tab is unlocked',{exact:true}).waitFor();
    const set=f.api.storage.session.set;
    f.api.storage.session.set=async()=>{throw Error('storage write failed')};
    await f.page.locator('#lock-now-btn').click();
    await f.page.getByText('Could not complete the action. Please try again.',{exact:true}).waitFor();
    assert.equal(await f.page.locator('#lock-now-btn').isDisabled(),false);
    f.api.storage.session.set=set;
    await f.page.locator('#lock-now-btn').click();
    await f.page.getByText('This tab is locked',{exact:true}).waitFor();
    assert.equal(await f.page.locator('#lock-now-btn').isDisabled(),true);
    assert.equal(await f.page.locator('#lock-now-btn').textContent(),'Already locked');
    assert.deepEqual(f.errors,[]);
   }finally{await f.context.close();}
  });
  await t.test('popup owns password input; content overlay has no password/storage/crypto dependency',async()=>{
   const f=await fixture();try{await f.page.goto(origin+'/popup/popup.html');await f.page.locator('#unlock-password').waitFor();if(process.env.PADLOX_SCREENSHOTS) await f.page.screenshot({path:'/tmp/padlox-popup.png'});await f.page.locator('#unlock-password').fill('test-pin-123');await f.page.locator('#unlock-submit').click();await f.page.getByText('This tab is unlocked',{exact:true}).waitFor();assert.equal(await f.page.locator('#unlock-password').inputValue(),'');
    const site=await f.context.newPage();await site.goto(origin+'/site');await site.addScriptTag({path:path.join(root,'content/lock.js')});await site.locator('#padlox-host').waitFor({state:'detached'});
    await f.page.locator('#lock-now-btn').click();await f.page.getByText('This tab is locked',{exact:true}).waitFor();await site.evaluate(()=>__listeners.forEach(f=>f({action:'REFRESH_STATUS'},{id:'padlox'})));await site.locator('#padlox-host').waitFor();if(process.env.PADLOX_SCREENSHOTS) await site.screenshot({path:'/tmp/padlox-lock.png'});assert.equal(await site.locator('input').count(),0);assert.equal(await site.evaluate(()=>!!chrome.storage),false);
    const source=fs.readFileSync(path.join(root,'content/lock.js'),'utf8');assert(!source.includes('crypto.subtle'));assert(!source.includes('chrome.storage'));assert.deepEqual(f.errors,[]);
   }finally{await f.context.close()}
  });
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
