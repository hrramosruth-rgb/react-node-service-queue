import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {QueueStore} from '../server/store.js';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'service-queue-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const file = join(dir, 'queue.json');
  return {file, store: new QueueStore(file)};
}

test('issues sequential tickets and restores persisted queue', t => {
  const {store, file} = fixture(t);
  const first = store.enqueue('  Ruth  ');
  assert.equal(first.name, 'Ruth');
  assert.equal(first.ticket, 'Q001');
  assert.equal(first.status, 'waiting');
  const reopened = new QueueStore(file);
  assert.equal(reopened.list().length, 1);
  assert.equal(reopened.enqueue('Alex').ticket, 'Q002');
});

test('rejects invalid names without allocating a ticket', t => {
  const {store} = fixture(t);
  for (const name of ['', '  ', null, 42, 'x'.repeat(61)]) assert.throws(() => store.enqueue(name), /name/i);
  assert.equal(store.enqueue('Alex').ticket, 'Q001');
});

test('enforces state transitions and a single active service desk', t => {
  const {store} = fixture(t);
  const a = store.enqueue('Alex'); const b = store.enqueue('Sam');
  assert.throws(() => store.transition(a.id, 'completed'), /transition/i);
  assert.equal(store.transition(a.id, 'serving').status, 'serving');
  assert.equal(store.transition(a.id, 'serving').status, 'serving');
  assert.throws(() => store.transition(b.id, 'serving'), /desk/i);
  store.transition(a.id, 'completed');
  assert.equal(store.transition(b.id, 'serving').status, 'serving');
  assert.throws(() => store.transition(a.id, 'waiting'), /transition/i);
});

test('cancellation persists and returned records cannot mutate the store', t => {
  const {store, file} = fixture(t);
  const a = store.enqueue('Sam');
  store.transition(a.id, 'cancelled');
  const records = store.list(); records[0].status = 'waiting';
  assert.equal(new QueueStore(file).list()[0].status, 'cancelled');
  assert.equal(store.list()[0].status, 'cancelled');
  assert.throws(() => store.transition('missing', 'serving'), /not found/i);
});

test('network retries reuse a ticket across restarts and reject key collisions', t => {
  const {store, file} = fixture(t);
  const first = store.enqueue('Alex', 'check-in-123');
  const reopened = new QueueStore(file);
  assert.equal(reopened.enqueue('Alex', 'check-in-123').id, first.id);
  assert.equal(reopened.list().length, 1);
  assert.throws(() => reopened.enqueue('Sam', 'check-in-123'), /different/i);
  assert.equal(reopened.enqueue('Sam', 'check-in-456').ticket, 'Q002');
});

test('rejects corrupted stored entries before the service starts', t => {
  const {file} = fixture(t);
  writeFileSync(file, JSON.stringify({next: 2, entries: [{id: 'a', ticket: 'Q001', name: 'Alex', status: 'unknown'}]}));
  assert.throws(() => new QueueStore(file), /Invalid queue/i);
});

test('failed disk writes do not change memory or consume a ticket number', t => {
  const {store, file} = fixture(t);
  mkdirSync(file);
  assert.throws(() => store.enqueue('Alex'));
  assert.deepEqual(store.list(), []);
  rmSync(file, {recursive: true});
  assert.equal(store.enqueue('Alex').ticket, 'Q001');
});
