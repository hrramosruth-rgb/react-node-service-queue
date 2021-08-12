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
    this.#state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {next: 1, entries: []};
    if (!Number.isSafeInteger(this.#state.next) || this.#state.next < 1 || !Array.isArray(this.#state.entries)) {
      throw new Error('Invalid queue data file. Restore a valid backup before starting.');
    }
  }
  list() { return structuredClone(this.#state.entries); }
  #save(state) {
    mkdirSync(dirname(this.#file), {recursive: true});
    const temp = this.#file + '.tmp';
    writeFileSync(temp, JSON.stringify(state, null, 2), {mode: 0o600});
    renameSync(temp, this.#file);
    this.#state = state;
  }
  enqueue(name) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) {
      throw new QueueError(400, 'Name must contain 1–60 characters.');
    }
    if (this.#state.entries.length >= 1000) throw new QueueError(409, 'Demo queue is full. Archive the data file to start a new session.');
    const state = structuredClone(this.#state);
    const entry = {id: randomUUID(), ticket: 'Q' + String(state.next++).padStart(3, '0'), name: name.trim(), status: 'waiting', createdAt: new Date().toISOString()};
    state.entries.push(entry);
    this.#save(state);
    return structuredClone(entry);
  }
  transition(id, status) {
    const state = structuredClone(this.#state);
    const entry = state.entries.find(item => item.id === id);
    if (!entry) throw new QueueError(404, 'Ticket not found.');
    if (!Object.hasOwn(transitions, status)) throw new QueueError(400, 'Unknown queue status.');
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
