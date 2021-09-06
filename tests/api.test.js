import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {QueueStore} from '../server/store.js';
import {createApp} from '../server/app.js';
function appFor(t) {
  const dir = mkdtempSync(join(tmpdir(), 'queue-api-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  return createApp(new QueueStore(join(dir, 'queue.json')));
}
test('creates, lists, and serves a ticket through the API', async t => {
  const app = appFor(t);
  const created = await request(app).post('/api/tickets').send({name: 'Ruth'}).expect(201);
  assert.equal(created.body.ticket, 'Q001');
  const listed = await request(app).get('/api/tickets').expect(200);
  assert.equal(listed.body[0].name, 'Ruth');
  const served = await request(app).patch('/api/tickets/' + created.body.id).send({status: 'serving'}).expect(200);
  assert.equal(served.body.status, 'serving');
});
test('returns validation, missing record, and transition errors', async t => {
  const app = appFor(t);
  await request(app).post('/api/tickets').send({name: ''}).expect(400);
  await request(app).patch('/api/tickets/missing').send({status: 'serving'}).expect(404);
  const {body} = await request(app).post('/api/tickets').send({name: 'Alex'}).expect(201);
  await request(app).patch('/api/tickets/' + body.id).send({status: 'completed'}).expect(409);
  await request(app).patch('/api/tickets/' + body.id).send({status: '__proto__'}).expect(400);
});
test('rejects malformed JSON without exposing stack traces', async t => {
  const response = await request(appFor(t)).post('/api/tickets').set('Content-Type', 'application/json').send('{broken').expect(400);
  assert.deepEqual(Object.keys(response.body), ['error']);
  assert.match(response.body.error, /JSON/i);
});
