import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {cp, mkdtemp, readFile, writeFile, mkdir, rm, symlink, utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const run = promisify(execFile);
const python = process.env.PYTHON_PATH || 'python3';
const root = fileURLToPath(new URL('../', import.meta.url));
async function fixture() {
  const base = await mkdtemp(path.join(tmpdir(), 'padlox-release-'));
  const source = path.join(base, 'source');
  await mkdir(source);
  for (const name of ['manifest.json', 'PRIVACY.md', 'package.json', 'package-lock.json', 'background', 'content', 'icons', 'popup', 'settings', 'shared', 'scripts']) {
    await cp(path.join(root, name), path.join(source, name), {recursive: true});
  }
  return {base, source, build: output => run(python, [path.join(source, 'scripts/package-release.py'), '--output-dir', output])};
}
async function inspect(zip) {
  const {stdout} = await run(python, ['-c', `import zipfile,json,base64,sys
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 print(json.dumps({i.filename:{'data':base64.b64encode(z.read(i)).decode(),'date':i.date_time,'mode':i.external_attr>>16,'compression':i.compress_type} for i in z.infolist()}))`, zip]);
  return JSON.parse(stdout);
}

test('release ZIP is byte-reproducible, excludes development/private files, and closes runtime references', async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.source, '.env'), 'FAKE_TEST_ONLY=must-not-package\n');
    await mkdir(path.join(f.source, 'node_modules'), {recursive: true});
    await writeFile(path.join(f.source, 'node_modules/private.txt'), 'must-not-package');
    const a = path.join(f.base, 'a'), b = path.join(f.base, 'b');
    await f.build(a);
    await utimes(path.join(f.source, 'manifest.json'), new Date(0), new Date(0));
    await f.build(b);
    const zipName = 'padlox-1.0.1.zip';
    const bytes = await readFile(path.join(a, zipName));
    assert.deepEqual(bytes, await readFile(path.join(b, zipName)));
    const sha = createHash('sha256').update(bytes).digest('hex');
    assert.equal(await readFile(path.join(a, 'padlox-1.0.1.sha256'), 'utf8'), `${sha}  ${zipName}\n`);
    const archive = await inspect(path.join(a, zipName));
    const names = Object.keys(archive);
    assert.deepEqual(names, [...names].sort());
    assert(names.includes('PRIVACY.md'));
    assert(!names.some(name => /(^|\/)(?:\.|node_modules|tests|scripts|docs|dist)/.test(name)));
    assert(!names.includes('package.json') && !names.includes('package-lock.json') && !names.includes('content/lock.css'));
    const text = name => Buffer.from(archive[name].data, 'base64').toString('utf8');
    const hasReference = (name, reference) => {
      assert(!/^[a-z]+:|^\/\//i.test(reference), `remote runtime reference ${reference}`);
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), reference));
      assert(Object.hasOwn(archive, target), `${name} requires ${target}`);
    };
    for (const name of names) {
      const entry = archive[name];
      assert.deepEqual(entry.date, [1980, 1, 1, 0, 0, 0]);
      assert.equal(entry.mode, 0o100644); assert.equal(entry.compression, 0);
      assert.deepEqual(Buffer.from(entry.data, 'base64'), await readFile(path.join(f.source, name)));
      if (name.endsWith('.js')) for (const match of text(name).matchAll(/\b(?:from|import)\s*['"]([^'"]+)['"]/g)) hasReference(name, match[1]);
      if (name.endsWith('.css')) for (const match of text(name).matchAll(/@import\s+url\(['"]?([^'"\)]+)['"]?\)/g)) hasReference(name, match[1]);
      if (name.endsWith('.html')) for (const match of text(name).matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g)) hasReference(name, match[1]);
      if (name.endsWith('.png')) {
        const png = Buffer.from(entry.data, 'base64'), expected = Number(name.match(/icon(\d+)/)[1]);
        assert.equal(png.readUInt32BE(16), expected); assert.equal(png.readUInt32BE(20), expected);
      }
    }
    const manifest = JSON.parse(text('manifest.json'));
    for (const reference of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)]) hasReference('manifest.json', reference);
  } finally { await rm(f.base, {recursive: true, force: true}); }
});

test('release builder refuses mismatched versions and stale document-start styles', async () => {
  const f = await fixture();
  try {
    const manifestPath = path.join(f.source, 'manifest.json');
    const original = await readFile(manifestPath, 'utf8');
    await writeFile(manifestPath, original.replace('"1.0.1"', '"1.0.2"'));
    await assert.rejects(f.build(path.join(f.base, 'bad-version')), /versions must agree/);
    for (const invalid of ['01.0.1', '0.0.0', '1.65536']) {
      await writeFile(manifestPath, original.replace('"1.0.1"', JSON.stringify(invalid)));
      await assert.rejects(f.build(path.join(f.base, 'invalid-version')), /Invalid manifest version/);
    }
    await writeFile(manifestPath, original);
    await writeFile(path.join(f.source, 'content/lock.css'), '/* changed CSS not synchronized */');
    await assert.rejects(f.build(path.join(f.base, 'stale-styles')), /styles are stale/);
  } finally { await rm(f.base, {recursive: true, force: true}); }
});

test('release builder refuses symlinked runtime sources', async () => {
  const f = await fixture();
  try {
    const policy = path.join(f.source, 'PRIVACY.md');
    await rm(policy); await symlink(path.join(root, 'PRIVACY.md'), policy);
    await assert.rejects(f.build(path.join(f.base, 'symlink')), /Symlink is not a release source/);
  } finally { await rm(f.base, {recursive: true, force: true}); }
});
