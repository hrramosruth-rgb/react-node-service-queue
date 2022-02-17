import {QueueStore} from './store.js';
import {createApp} from './app.js';
import {resolve} from 'node:path';
const port = Number(process.env.PORT || 3101);
const store = new QueueStore(resolve(process.env.QUEUE_FILE || 'data/queue.json'));
const server = createApp(store).listen(port, '127.0.0.1', () => console.log(`Queue API: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
