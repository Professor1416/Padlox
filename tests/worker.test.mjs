import {test} from 'node:test';
import assert from 'node:assert/strict';

test('worker restricts both storage areas before serving requests; initialization failure fails closed',async()=>{
 for(const fail of [false,true]){
  const levels=[];let listener;let resolveSession;
  const sessionReady=new Promise(resolve=>{resolveSession=resolve});
  globalThis.chrome={
   runtime:{id:'padlox',getURL:p=>'chrome-extension://padlox/'+p,onMessage:{addListener:f=>listener=f},onInstalled:{addListener:()=>{}},onStartup:{addListener:()=>{}}},
   storage:{local:{setAccessLevel:async x=>levels.push(['local',x.accessLevel]),get:async()=>({})},session:{setAccessLevel:async x=>{levels.push(['session',x.accessLevel]);await sessionReady;if(fail)throw Error('storage unavailable')},get:async()=>({}),set:async()=>{},remove:async()=>{}}},
   tabs:{onRemoved:{addListener:()=>{}}},
   scripting:{getRegisteredContentScripts:async()=>[]},
   permissions:{onRemoved:{addListener:()=>{}},onAdded:{addListener:()=>{}}}
  };
  try{
   await import(`../background/service-worker.js?test=${fail}`);
   let response;
   assert.equal(listener({action:'LIST_SITES'},{id:'other'},r=>response=r),true);
   await new Promise(r=>setImmediate(r));assert.equal(response,undefined);
   assert.deepEqual(levels,[['local','TRUSTED_CONTEXTS'],['session','TRUSTED_CONTEXTS']]);
   resolveSession();await new Promise(r=>setImmediate(r));assert.equal(response.ok,false);
   if(fail)assert(response.error.includes('initialize securely'));
  }finally{delete globalThis.chrome;}
 }
});
