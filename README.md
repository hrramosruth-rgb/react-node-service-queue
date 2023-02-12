# react-node-service-queue

Independent portfolio demonstration.

## Simulated history

This code was created in October 2026. Commit dates are a **simulated development timeline**, not evidence of work performed or employment in those years. Current libraries may postdate the assigned dates. This is not an implementation for an actual client or employer. See [TIMELINE.md](TIMELINE.md).

## Desk — a calmer welcome

A touch-friendly reception dashboard: check in a guest, issue a sequential ticket, call the next person, complete or cancel service, and view history. One service desk can serve one ticket at a time.

## Run locally

Node.js 22.12 or later is required. No account, API key, or external service is needed.

```sh
npm ci
npm run server
```

In another terminal:

```sh
npm run dev
```

Open the Vite URL (normally http://127.0.0.1:5173). The API listens on http://127.0.0.1:3101 and the UI proxies `/api` to it. Both processes bind to loopback. Tickets persist in ignored `data/queue.json`. Set `PORT` and `QUEUE_FILE` to override the API port or data path; update `vite.config.js` if changing the port.

## Verify

```sh
npm test
npm run build
npm audit
```

Tests cover sequential ticket issuance, persistence/restart, legal transitions, exclusive desk use, malformed inputs/JSON, missing records, disk-write failure rollback, and durable retry keys. GitHub Actions repeats tests and the production build. CI uses current libraries despite the simulated dates.

## API

| Endpoint | Behavior |
| --- | --- |
| `GET /api/tickets` | List all tickets |
| `POST /api/tickets` | Create a ticket from `{ "name": "Alex" }` |
| `PATCH /api/tickets/:id` | Transition using `{ "status": "serving" }` |
| `GET /api/health` | Liveness check |

Waiting tickets can become `serving` or `cancelled`; serving tickets can become `completed` or `cancelled`. Terminal states cannot be reopened. Repeating the current status is harmless. Invalid inputs return 400, missing tickets 404, and illegal transitions or a busy desk 409.

For POST retries send an `Idempotency-Key` header (1–80 letters, digits, or hyphens). Repeating a key and name returns the original ticket, including after restart; using the key for a different name returns 409. The UI retains the key when a check-in fails so retrying does not allocate a second ticket.

## Architecture and limits

- `server/store.js`: validates and applies queue rules, then atomically replaces the JSON data file before updating memory.
- `server/app.js`: Express routes and bounded JSON error handling.
- `src/App.jsx`: reception dashboard, guarded mutations, polling, and accessible loading/error states.
- `src/styles.css`: responsive touch targets, focus outlines, and system-font fallbacks; no remote font dependency.

This is a local, single-process demonstration with no authentication or multi-process locking. It holds at most 1,000 tickets per data file and does not process payments or contact guests. Do not expose its unauthenticated API to a public network. To start fresh, stop the server and move the data file to a backup location. Invalid persisted data stops startup instead of overwriting the file. `dist/` is the production frontend build; deploying it together with an API is a separate step.

## Modern reconstruction

The 2021–2023 commit dates are simulated. This code was written in October 2026 with contemporary React, Express, Vite, and Node APIs. It demonstrates a development progression rather than past employment or actual historical work.
