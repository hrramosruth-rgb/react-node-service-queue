import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

export class QueueError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const transitions = {waiting: ['serving', 'cancelled'], serving: ['completed', 'cancelled'], completed: [], cancelled: []};

export class QueueStore {
  #file;
  #state;
  constructor(file) {
    this.#file = file;
    this.#state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {next: 1, entries: [], requests: {}};
    if (!this.#state || !Number.isSafeInteger(this.#state.next) || this.#state.next < 1 || !Array.isArray(this.#state.entries)
      || this.#state.next !== this.#state.entries.length + 1
      || this.#state.entries.some(item => !item || typeof item.id !== 'string' || typeof item.name !== 'string'
        || !item.name.trim() || !Object.hasOwn(transitions, item.status) || !Number.isFinite(Date.parse(item.createdAt)))
      || new Set(this.#state.entries.map(item => item.id)).size !== this.#state.entries.length) {
      throw new Error('Invalid queue data file. Restore a valid backup before starting.');
    }
    this.#state.requests ??= {};
  }
  list() { return structuredClone(this.#state.entries); }
  #save(state) {
    mkdirSync(dirname(this.#file), {recursive: true});
    const temp = this.#file + '.tmp';
    writeFileSync(temp, JSON.stringify(state, null, 2), {mode: 0o600});
    renameSync(temp, this.#file);
    this.#state = state;
  }
  enqueue(name, key) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) {
      throw new QueueError(400, 'Name must contain 1–60 characters.');
    }
    if (key !== undefined) {
      if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(key)) throw new QueueError(400, 'Invalid idempotency key.');
      if (Object.hasOwn(this.#state.requests, key)) {
        const previous = this.#state.entries.find(item => item.id === this.#state.requests[key]);
        if (!previous || previous.name !== name.trim()) throw new QueueError(409, 'This request key was used for a different name.');
        return structuredClone(previous);
      }
    }
    if (this.#state.entries.length >= 1000) throw new QueueError(409, 'Demo queue is full. Archive the data file to start a new session.');
    const state = structuredClone(this.#state);
    const entry = {id: randomUUID(), ticket: 'Q' + String(state.next++).padStart(3, '0'), name: name.trim(), status: 'waiting', createdAt: new Date().toISOString()};
    state.entries.push(entry);
    if (key !== undefined) state.requests[key] = entry.id;
    this.#save(state);
    return structuredClone(entry);
  }
  transition(id, status) {
    const state = structuredClone(this.#state);
    const entry = state.entries.find(item => item.id === id);
    if (!entry) throw new QueueError(404, 'Ticket not found.');
    if (typeof status !== 'string' || !Object.hasOwn(transitions, status)) throw new QueueError(400, 'Unknown queue status.');
    if (status === entry.status) return structuredClone(entry);
    if (!transitions[entry.status].includes(status)) throw new QueueError(409, 'This transition is not allowed.');
    if (status === 'serving' && state.entries.some(item => item.status === 'serving')) {
      throw new QueueError(409, 'The service desk is already busy.');
    }
    entry.status = status;
    entry.updatedAt = new Date().toISOString();
    this.#save(state);
    return structuredClone(entry);
  }
}
