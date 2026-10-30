# Narrative Rehearsal — MVP

**Run the story before you make the story.** A collaborative narrative rehearsal app: a crew plays an unfinished
story through an AI Director, chance resolves what they attempt, consequences propagate through the character web,
and the discoveries compile into screenplay pages. Product spec: [docs/PRD.md](docs/PRD.md).

- **Mobile app** — Expo SDK 57 / React Native, one codebase for **iOS and Android** (native tab bars,
  sheets, haptics, safe areas) that also runs on the web.
- **Server** — Node 24, runs the TypeScript directly. It holds the story state, resolves dice and runs the
  **AI Director** (Claude when a key is configured, a deterministic offline Director otherwise).

## Run it

```bash
cd server && npm install && npm start
```

```bash
npm install && npx expo start
```

Then press `w` for web, scan the QR code with **Expo Go** on an iPhone or Android phone, or press `a`/`i` for an
emulator/simulator. On a phone the app finds the server at the Metro machine's LAN address automatically;
override it in **Settings** if needed (the server prints its LAN address at startup). See
[server/README.md](server/README.md) for firewall notes.

**Claude Director:** copy `server/.env.example` to `server/.env` and set `ANTHROPIC_API_KEY`. The Director uses
`claude-opus-5` with structured outputs and server-side refusal fallbacks. Any failed call falls back to the
offline Director for that step. The Welcome screen shows which Director is active.

## Try the loop (≈5 minutes)

1. **New project → Undertow sample.** You're the Project Owner.
2. **Rehearse** — type what Ines does ("I accuse Mara of lying"). The Director reads your intent and offers
   approaches with difficulty, dice odds and what's at risk. Pick one, roll, and read the **consequence**:
   story effects, ripples through the character web, fresh news that changes the goal.
3. **Crew** — others join from their phones (same server) as Performer/Writer/Observer. Cast them, turn on a
   **blind session**, collect before/after interpretations and generate the **Interpretation Matrix**.
4. **Discover → Analyze this run** — declared-vs-observed divergence, empathy observations (never scores),
   theme signals, payoff opportunities. Only the Owner **promotes to canon**.
5. **Discover → Screenplay** — compile the sequence; every line is tagged PERFORMED / RECONSTRUCTED / GENERATED
   (dialogue) or OBSERVED / DIRECTED / CONNECTIVE (action). Export as Fountain.
6. **Discover → Branches** — replay, vary, escalate or reinterpret; compare branches; promote one to canon.
7. **Write** — the screenwriting room. Start a blank script or type up a compiled draft, then write in industry
   format on any screen size: Enter starts the element that usually follows (character → dialogue), Tab or the
   type strip changes it. Every edit is tracked by author until the next revision is saved; revisions follow the
   industry page colours (White, Blue, Pink, Yellow…), revised lines carry an asterisk, and anyone can pin notes
   to lines. Saves merge per line, so writers on different lines never overwrite each other.
8. **Story → Structure** (Owner/Director/Producer) — Save the Cat beat board with dramatic requirements, Hero Goal
   Sequences, and Beat Guidance opportunity cards the Director offers for you to choose from.

## Layout

| Path | What |
| --- | --- |
| `shared/` | The contract: domain types, Save the Cat beats + requirements, resolution tables, permissions, RPC ops |
| `server/src/engine.ts` | Dramatic Resolution Engine (d20 + capability vs DC, four tiers), effects, narrative state graph |
| `server/src/director.ts` | AI Director on Claude (structured outputs) · `director-offline.ts` deterministic fallback |
| `server/src/ops.ts` · `view.ts` | Every operation with authority checks · per-viewer redaction (meta layer, blind sessions) |
| `src/app/` | Expo Router screens: Welcome, Settings, and per project **Home · Story · Write · Rehearse · Crew · Discover** |
| `shared/script.ts` | Write Room save merge and change tracking (tested in `server/test/script.test.ts`) |
| `src/components/ui/` | Cross-platform design system (light + dark) |

## Deploy the web app (Vercel)

`vercel.json` builds the web app with `expo export -p web` and serves it as a single-page app from `dist`.
Import the GitHub repo in Vercel (framework preset: Other; the file sets the build). The rehearsal server is a
long-running Node process with WebSockets and a file database, so it is not a Vercel function: host it on any
Node host with HTTPS (Render, Railway, Fly.io, a VPS) using `npm --prefix server start` (it honours `PORT`),
then set **`EXPO_PUBLIC_SERVER_URL`** = `https://your-server.example` in the Vercel project's environment
variables and redeploy. Anyone can still point the app elsewhere in **Settings**.

## Checks

```bash
npx tsc --noEmit && npx expo lint
```

```bash
cd server && npm run typecheck && npm test
```

Native builds and store submission go through EAS (`npx eas-cli@latest build`). Release Android builds block
plain-HTTP traffic, so put the server behind HTTPS before shipping beyond development.
