import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addScope, renameScope, removeScope, syncScopeNames } from '../../src/incontainer/scope';

test('scope: create adds, update renames in place, delete/archive removes; absent file untouched', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-scope-'));
  const scope = path.join(dir, 'workflow-ids.json');
  const ids = (): Array<{ id: string; name: string }> => JSON.parse(fs.readFileSync(scope, 'utf8')).workflows;
  process.env.SCOPE_FILE = scope;
  try {
    addScope('a', 'Alpha');
    assert.equal(fs.existsSync(scope), false, 'absent scope must NOT be created (empty = all)');

    fs.writeFileSync(scope, '{\n  "workflows": []\n}\n');
    addScope('a', 'Alpha');
    assert.deepEqual(ids(), [{ id: 'a', name: 'Alpha' }], 'create adds {id,name}');
    renameScope('a', 'Alpha v2');
    assert.deepEqual(ids(), [{ id: 'a', name: 'Alpha v2' }], 'update renames in place');
    renameScope('a', 'Alpha v2');
    assert.equal(ids().length, 1, 'no-op rename does not duplicate');
    renameScope('untracked', 'Ghost');
    assert.deepEqual(ids().map((w) => w.id), ['a'], 'rename of an UNtracked id must NOT add it');
    addScope('b', 'Beta');
    assert.equal(ids().length, 2, 'second create appends');
    removeScope('a');
    assert.deepEqual(ids(), [{ id: 'b', name: 'Beta' }], 'delete removes by id');
    removeScope('b'); // archive path also calls removeScope
    assert.deepEqual(ids(), [], 'archive/delete empties the list');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.SCOPE_FILE;
  }
});

test('scope: syncScopeNames refreshes tracked names, never adds/removes; explicit path beats env', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-scope-'));
  const scope = path.join(dir, 'workflow-ids.json');
  const ids = (): Array<{ id: string; name: string }> => JSON.parse(fs.readFileSync(scope, 'utf8')).workflows;
  try {
    syncScopeNames(new Map([['a', 'Alpha']]), scope);
    assert.equal(fs.existsSync(scope), false, 'absent scope must NOT be created (empty = all)');

    fs.writeFileSync(scope, JSON.stringify({ workflows: [
      { id: 'a', name: 'hub 178 - Alpha' },
      { id: 'b', name: 'Beta' },
    ] }));
    // Engine callers pass cfg.scopeFile explicitly — env must not be consulted.
    process.env.SCOPE_FILE = path.join(dir, 'WRONG.json');
    syncScopeNames(new Map([['a', 'va3/Alpha'], ['ghost', 'Ghost'], ['b', 'Beta']]), scope);
    assert.deepEqual(ids(), [
      { id: 'a', name: 'va3/Alpha' },
      { id: 'b', name: 'Beta' },
    ], 'renames stale entry in place, keeps matching one, never adds untracked ids');
    assert.equal(fs.existsSync(path.join(dir, 'WRONG.json')), false, 'env SCOPE_FILE ignored when a path is passed');

    const before = fs.statSync(scope).mtimeMs;
    syncScopeNames(new Map([['a', 'va3/Alpha']]), scope);
    assert.equal(fs.statSync(scope).mtimeMs, before, 'no-op sync must not rewrite the file');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.SCOPE_FILE;
  }
});
