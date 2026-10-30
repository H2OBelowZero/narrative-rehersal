# Narrative Rehearsal server

Node 24 runs the TypeScript directly (type stripping) — no build step.

```sh
cd server
npm install
npm start          # node src/index.ts
npm run dev        # restart on change
npm run typecheck
npm test
```

## Configuration

Copy `.env.example` to `.env`; it is loaded at startup (real environment variables win).

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Enables the Claude Director. Without it the offline Director runs, so the app always works. |
| `DIRECTOR_MODEL` | set in `director.ts` | Claude model id for the Director. |
| `DIRECTOR_ENGINE` | `claude` when a key is set | `offline` forces the deterministic Director. |
| `PORT` | `8787` | HTTP + WebSocket port. |

`GET /health` reports which Director is active.

## Phones on the LAN

The server listens on `0.0.0.0` and prints its LAN addresses at startup (`LAN: http://192.168.x.x:8787`).
Point the app at that address — `localhost` on a phone is the phone itself. Phone and computer must be on
the same network, and the firewall must allow inbound connections on the port (Windows asks the first time
Node listens; allow it on private networks).

## Transport

- `POST /api/<op>` with a JSON body → `{ ok: true, result }` or `{ ok: false, error }`. Ops and their
  arguments are defined in `shared/api.ts`.
- `WS /ws?projectId=<id>` pushes `{ type: 'changed', projectId, version }` after every change; clients
  refetch `getProject` with their own `participantId` (views differ per role and in blind mode).

Projects are kept in memory and saved to `data/db.json` (atomic writes, flushed on Ctrl+C).
Delete that file to start over.
