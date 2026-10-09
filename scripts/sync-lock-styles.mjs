import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const tokens=await readFile(new URL('shared/tokens.css',root),'utf8');
const css=await readFile(new URL('content/lock.css',root),'utf8');
const file=new URL('content/lock.js',root);
const source=await readFile(file,'utf8');
const styles=tokens+'\n'+css;
if(/[`\\]|\$\{/.test(styles))throw Error('Lock CSS contains characters requiring template-string escaping.');
await writeFile(file,source.replace(/const STYLES = `[\s\S]*?`;/,()=>`const STYLES = \`\n${styles}\`;`));
