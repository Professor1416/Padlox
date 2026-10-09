import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('document-start lock styles contain the current shared tokens and CSS source', async () => {
  const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
  const [tokens, css, script] = await Promise.all([
    read('shared/tokens.css'), read('content/lock.css'), read('content/lock.js')
  ]);
  const embedded = script.match(/const STYLES = `([\s\S]*?)`;/)?.[1];
  assert.equal(embedded, '\n' + tokens + '\n' + css);
});
