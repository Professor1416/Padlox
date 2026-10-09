const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

test('settings modal stays hidden until an action; password confirmation removes protection',async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const local={padlox_sites:{'example.com':{addedAt:1}}};const session={};
   const area=data=>({get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,data[k]])),set:async values=>Object.assign(data,values),remove:async keys=>{for(const k of Array.isArray(keys)?keys:[keys])delete data[k]}});
   globalThis.chrome={storage:{local:area(local),session:area(session)},scripting:{unregisterContentScripts:async()=>{}},permissions:{remove:async()=>true}};
  });
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.goto(origin+'/settings/settings.html');
  await page.getByRole('button',{name:'Remove protection',exact:true}).waitFor();
  await page.evaluate(async()=>{const {createVerifier}=await import('/shared/crypto.js');await chrome.storage.local.set({padlox_config:await createVerifier('test-pin-123')})});
  assert.equal(await page.locator('#modal-backdrop').isVisible(),false,'confirmation dialog must not cover dashboard on initial load');
  await page.getByRole('button',{name:'Remove protection',exact:true}).click();
  await page.locator('#modal-password').fill('wrong-pin');
  await page.locator('#modal-confirm').click();
  await page.getByText('Incorrect password.',{exact:true}).waitFor();
  assert(await page.locator('#modal-backdrop').isVisible());
  assert((await page.evaluate(()=>chrome.storage.local.get('padlox_sites'))).padlox_sites['example.com']);
  await page.locator('#modal-password').fill('test-pin-123');
  await page.locator('#modal-confirm').click();
  await page.locator('#modal-backdrop').waitFor({state:'hidden'});
  assert.deepEqual((await page.evaluate(()=>chrome.storage.local.get('padlox_sites'))).padlox_sites,{});
  await page.locator('#reset-btn').click();
  await page.locator('#modal-cancel').click();
  assert.equal(await page.locator('#modal-backdrop').isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
