import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVerifier,verifyPassword,PBKDF2_ITERATIONS} from '../shared/crypto.js';
import {domainMatches,findProtectedDomain,isSupportedUrl,normalizeDomain,buildOriginPatterns} from '../shared/utils.js';

test('password verifier accepts exact password and rejects incorrect or missing credentials',async()=>{
 const password='Test PIN 123';
 const verifier=await createVerifier(password);
 assert.equal(await verifyPassword(password,verifier),true);
 assert.equal(await verifyPassword('wrong',verifier),false);
 assert.equal(await verifyPassword(password.toLowerCase(),verifier),false);
 assert.equal(await verifyPassword(password,null),false);
 await assert.rejects(()=>verifyPassword(password,{}),/Invalid Padlox password data/);
 assert.equal(verifier.iterations,PBKDF2_ITERATIONS);
 assert.equal(JSON.stringify(verifier).includes(password),false);
});
test('identical passwords receive independent random salts and hashes',async()=>{
 const a=await createVerifier('123456');const b=await createVerifier('123456');
 assert.notEqual(a.salt,b.salt);assert.notEqual(a.hash,b.hash);
 assert.equal(Buffer.from(a.salt,'base64').length,16);
 assert.equal(Buffer.from(a.hash,'base64').length,32);
});
test('domain matching respects hostname boundaries and normalization',()=>{
 assert.equal(normalizeDomain(' WWW.Example.COM '),'example.com');
 for(const host of ['example.com','www.example.com','deep.sub.example.com'])assert(domainMatches('example.com',host));
 for(const host of ['fakeexample.com','example.com.attacker.test','',null])assert.equal(domainMatches('example.com',host),false);
 assert.equal(findProtectedDomain('sub.example.com',{'example.com':{}}),'example.com');
 assert.equal(findProtectedDomain('other.test',{'example.com':{}}),null);
 assert.deepEqual(buildOriginPatterns('www.Example.com'),['*://example.com/*','*://*.example.com/*']);
});
test('only HTTP and HTTPS URLs can be protected',()=>{
 for(const url of ['https://example.com','http://localhost:8080'])assert(isSupportedUrl(url));
 for(const url of ['chrome://extensions','file:///tmp/test','javascript:alert(1)','data:text/plain,test','invalid'])assert.equal(isSupportedUrl(url),false);
});
test('corrupt verifier metadata fails closed before password derivation',async()=>{
 const record=await createVerifier('test-pin-123');
 for(const mutation of [{iterations:1},{iterations:0},{iterations:300000.5},{iterations:900000000},{algo:'SHA-1'},{version:99},{salt:'bad-base64'},{hash:'AAAA'},{salt:record.salt.replace(/=$/,'')}])await assert.rejects(()=>verifyPassword('test-pin-123',{...record,...mutation}),/Invalid Padlox password data/);
 const legacy={...record};delete legacy.version;assert(await verifyPassword('test-pin-123',legacy));
});
test('domain handling canonicalizes IDNs/dots and selects most specific protection',()=>{
 assert.equal(normalizeDomain('WWW.BÜCHER.DE.'),'xn--bcher-kva.de');
 assert.equal(findProtectedDomain('a.sub.example.com',{'example.com':{},'sub.example.com':{}}),'sub.example.com');
 for(const value of ['*.example.com','example.com/path','example.com:443','user@example.com','-bad.example','example..com','__proto__'])assert.equal(normalizeDomain(value),'');
 assert.deepEqual(buildOriginPatterns('127.0.0.1'),['*://127.0.0.1/*']);
 assert.equal(domainMatches('127.0.0.1','x.127.0.0.1'),false);
 assert.throws(()=>buildOriginPatterns('*.example.com'),/Invalid domain/);
});
test('single-label intranet hosts use exact matching rather than broad wildcard patterns',()=>{
 assert(isSupportedUrl('https://intranet/'));
 assert.deepEqual(buildOriginPatterns('intranet'),['*://intranet/*']);
 assert.equal(domainMatches('intranet','other.intranet'),false);
});
