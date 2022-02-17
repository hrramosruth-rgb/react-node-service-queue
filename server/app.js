import express from 'express';
import {QueueError} from './store.js';

export function createApp(store) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit: '16kb'}));
  app.use('/api', (_req, res, next) => {res.set('Cache-Control', 'no-store'); next();});
  app.get('/api/health', (_req, res) => res.json({status: 'ok'}));
  app.get('/api/tickets', (_req, res) => res.json(store.list()));
  app.post('/api/tickets', (req, res) => res.status(201).json(store.enqueue(req.body?.name)));
  app.patch('/api/tickets/:id', (req, res) => res.json(store.transition(req.params.id, req.body?.status)));
  app.use((_req, res) => res.status(404).json({error: 'Route not found.'}));
  app.use((error, _req, res, _next) => {
    if (error instanceof QueueError) return res.status(error.status).json({error: error.message});
    if (error.type === 'entity.parse.failed') return res.status(400).json({error: 'Request must contain valid JSON.'});
    if (error.type === 'entity.too.large') return res.status(413).json({error: 'Request is too large.'});
    console.error('Queue API error:', error.message);
    res.status(500).json({error: 'Could not save the queue. Please try again.'});
  });
  return app;
}
