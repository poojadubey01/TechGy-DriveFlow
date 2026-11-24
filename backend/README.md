# DriveFlow backend

The API behind the DriveFlow app. It handles accounts, Google Drive sync, clients and photos, deck building, share links, client-view tracking, notifications, settings and the brand kit.

**Node 22 · TypeScript · Fastify 5 · Drizzle ORM · PostgreSQL · zod**

Locally it uses an **embedded Postgres** (PGlite), so you don't need to install a database. In production, set `DATABASE_URL` to any Postgres.

---

## Run it

You need Node.js 22.12 or newer. In this folder:

```powershell
npm install
```

```powershell
npm run seed
```

```powershell
npm run dev
```

The API runs at **http://localhost:4000**. Check it with `GET /health`.

`npm run seed` creates a demo account with the app's sample workspace: 4 clients, the 5 sample decks with their original share codes, client visits and notifications. Sign in with **demo@driveflow.local** / **driveflow-demo-1**. Run it again at any time to reset the demo account.

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the API and restarts it on every change |
| `npm run build` then `npm start` | Production build (`dist/`) and start |
| `npm test` | 75 tests, each file on its own throwaway database |
| `npm run typecheck` | TypeScript check |
| `npm run seed` | Creates or resets the demo account (development only) |
| `npm run db:generate` | Turns changes in `src/db/schema.ts` into a new SQL migration in `drizzle/` |
| `npm run db:migrate` | Applies migrations (the server also does this when it starts) |

Settings are environment variables; [.env.example](.env.example) lists them all. Copy it to `.env` to change any. Nothing is required for local development.

---

## Development stand-ins vs. the real services

`DEV_MOCKS` is on by default outside production. The server refuses to start in production with it on.

| Service | Development (no keys needed) | Real (add keys in `.env`) |
| --- | --- | --- |
| Email codes | Printed in the server log and listed at `GET /dev/outbox` | [Resend](https://resend.com): `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` |
| Google sign-in | `POST /auth/google` with `idToken: "dev:<email>:<Name>"` | Google ID tokens checked against `GOOGLE_CLIENT_IDS` |
| Google Drive | `POST /drive/connect` with `{ "mock": true }`: a "Projects" folder with the 4 sample clients and the app's own photos | Drive v3, read-only scope, with `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` |
| Chat assistant | A built-in rule-based reader (client names, deck type, slide count, photo kind, template) | Claude (`claude-opus-5-5`) with `ANTHROPIC_API_KEY` |
| Push notifications | Sent through Expo's push service as soon as a phone registers; no key needed | Same; optional `EXPO_ACCESS_TOKEN` if push security is on for your Expo project |

The real Google and Resend code is written but **hasn't been tested against live Google or Resend yet**, because there are no keys. Test it once you add keys.

### Setting up Google (when you're ready)

1. In [Google Cloud Console](https://console.cloud.google.com), create a project and enable the **Google Drive API**.
2. Set up the **OAuth consent screen** with the scopes `openid`, `email`, `profile` and `https://www.googleapis.com/auth/drive.readonly`.
3. Create OAuth clients:
   - **Android** and **iOS** clients for the app's sign-in.
   - A **Web application** client. Its client ID and secret go in `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.
4. Put every client ID in `GOOGLE_CLIENT_IDS`.
5. In the app, use `expo-auth-session` to request the scopes above with offline access. Then:
   - Send the **ID token** to `POST /auth/google`.
   - Send the **authorization code** to `POST /drive/connect`.

---

## How it works

- **Accounts:** email and password with a 6-digit email code, or Google.
  - Passwords are hashed with scrypt.
  - Codes are keyed hashes. They last 15 minutes, allow 5 tries, and can be resent once every 30 seconds.
  - Each signed-in device gets a random bearer token. The server stores only its hash, and it expires after `SESSION_DAYS`.
  - Resetting a password signs out every device. Changing it signs out the other devices.
- **Drive → clients:** you pick one Drive folder, and each sub-folder becomes a client.
  - The sub-folder's Drive description becomes the client's short description, e.g. "Luxury villas".
  - The images in a sub-folder become its photos. Each photo is labelled exterior, interior or night from its file name or Drive description, and you can fix a label by hand.
  - Re-syncing picks up new and deleted photos. If notifications for new photos are turned on, you get one.
  - Google refresh tokens are stored encrypted with AES-256-GCM.
- **Decks:** built with the same rules as the app.
  - Slides cycle through the chosen photos (or all of them). The cover carries the deck's name, and the other slides get a title that matches the photo.
  - A repeated deck name gets a number ("… portfolio 2").
  - Edit deck saves the whole slide list. Reset goes back to the slides as built.
- **Share links:** `https://driveflow.app/p/<12-character code>`.
  - The client's page (`/public/...`) needs no sign-in and can only load that deck's photos.
  - Each visit records the device, seconds per slide (capped, so it can't be inflated) and PDF downloads.
  - The owner gets a "Client opened your deck" notification. Repeat visits within 30 minutes update the same notification.
  - "Stop sharing" makes the link answer `410`. "New link" makes the old code stop working.
- **Background Drive sync:** every `SYNC_INTERVAL_MINUTES` (default 30), each connected folder is synced again, so new photos and "new photos" notifications arrive without anyone opening the app. The app also has **Sync now** in Profile.
- **Push notifications:** each phone registers an Expo push token (`POST /me/push-tokens`), tied to its sign-in.
  - Every in-app notification (deck ready, client opened a deck, new Drive photos) is also pushed to that person's phones, unless they turned that kind off.
  - Signing out, or resetting the password, stops pushes to that phone. Uninstalled phones are removed automatically.
- **Chat assistant** (`POST /assistant/understand`): reads a typed request like "a 10-slide proposal for Highrize with night shots in the bold template" into client, deck type, slide count, photos and template, so the chat can skip those questions.
  - With `ANTHROPIC_API_KEY` set, it uses Claude (`claude-opus-5-5`, low effort, structured JSON output).
  - Server-side fallbacks are on: if the model declines, the API retries on a fallback model in the same call.
  - The answer is checked before use: only the account's own client ids and slide counts from 4 to 40 are accepted.
  - Without a key, or if Claude can't be reached, the built-in rule-based reader answers instead.
- **Errors** always look like `{ "error": { "code": "...", "message": "..." } }`. The message is written to be shown in the app as is. Validation errors also list `fields`.

## API

Send `Authorization: Bearer <token>` on every route except the ones marked *public*.

Photo URLs in responses are paths like `/photos/<id>/image`. The app adds the API base URL and loads them with the same `Authorization` header (`expo-image` supports `headers`).

| Method & path | What it does |
| --- | --- |
| **Auth** (public) | |
| `POST /auth/sign-up` | `{ name, email, company?, password }` → emails a code |
| `POST /auth/verify-email` | `{ email, code }` → `{ token, user }` |
| `POST /auth/resend-code` | `{ email, purpose: "verify" \| "reset" }` |
| `POST /auth/sign-in` | `{ email, password }` → `{ token, user }` |
| `POST /auth/google` | `{ idToken }` → `{ token, user, isNew }` |
| `POST /auth/forgot-password` | `{ email }` → emails a reset code |
| `POST /auth/reset-password` | `{ email, code, password }` |
| `POST /auth/change-password` | `{ current, next }` (signed in) |
| `POST /auth/sign-out` | Signs out this device |
| **Account** | |
| `GET /me` | User, Drive state, settings, brand kit, unread count |
| `PATCH /me` | `{ name?, company? }` |
| `DELETE /me` | `{ email }` (typed to confirm). Deletes everything |
| `GET`, `PATCH /me/settings` | `defaultSlides` (8/12/15), `defaultTemplate`, `notifyReady`, `notifyViews`, `notifyPhotos` |
| `GET`, `PATCH /me/brand` | `{ on, name, accent }` → also `displayName` |
| `POST /me/push-tokens` | `{ token, platform }` registers this phone for push notifications |
| `DELETE /me/push-tokens` | `{ token }` stops pushes to a phone |
| `GET /notifications` | `{ items, unread }` |
| `POST /notifications/:id/read`, `POST /notifications/read-all` | Mark notifications as read |
| **Google Drive** | |
| `GET /drive` | `{ connected, account, folder, lastSync }` |
| `POST /drive/connect` | `{ code, redirectUri, codeVerifier? }` or `{ mock: true }` |
| `GET /drive/folders` | Top-level folders with how many client folders each has |
| `POST /drive/folder` | `{ folderId }` picks the projects folder |
| `POST /drive/sync` | Reads clients and photos → `{ result: { clients, photos, newPhotos } }` |
| `DELETE /drive` | Disconnects (and revokes Google's grant) |
| **Clients & photos** | |
| `GET /clients`, `GET /clients/:id` | Clients with photo and deck counts, cover, photos |
| `PATCH /clients/:id` | `{ meta }` short description |
| `POST /clients/:id/pick-photos` | `{ choice }` ("Interiors", "the pool"…) → `{ photos, note }` |
| `PATCH /photos/:id` | `{ kind: "exterior" \| "interior" \| "night" \| null }` |
| `GET /photos/:id/image` | The photo's bytes |
| **Decks** | |
| `GET /decks?clientId=` | Your decks, newest first |
| `POST /decks` | `{ clientId, type, slides?, title?, photoIds?, template? }` → the built deck |
| `GET /decks/:id` | Deck with `slideList` and `sender` |
| `PATCH /decks/:id` | `{ title?, template? }` |
| `PUT /decks/:id/slides` | `{ slides: [{ photoId, title }] }` (Edit deck) |
| `POST /decks/:id/reset` | Back to the slides as built |
| `DELETE /decks/:id` | Deletes the deck |
| `GET`, `PATCH /decks/:id/share` | `{ active, allowPdf }` |
| `POST /decks/:id/share/new-link` | New share code; the old one stops working |
| `GET /decks/:id/activity` | `{ opens, totalSeconds, downloads, perSlide, visits }` |
| **Chat** | |
| `POST /assistant/understand` | `{ text, clientId? }` → `{ source, clientId, deckType, slides, photoChoice, template, reply }` |
| **Client view** (public) | |
| `GET /public/decks/:shareId` | Deck for the share link (title, sender, brand, slides) |
| `GET /public/decks/:shareId/photos/:photoId` | A photo on that deck |
| `POST /public/decks/:shareId/visits` | Starts a visit → `{ visitId, token }` |
| `POST /public/visits/:visitId/progress` | `{ token, entries: [{ slide, seconds }] }` (every few seconds) |
| `POST /public/visits/:visitId/download` | `{ token }` when the PDF is downloaded |
| **Other** (public) | |
| `POST /support/feedback` | `{ message, email?, device? }` |
| `GET /meta` | Deck types, templates, accents, slide limits |
| `GET /health` | `{ ok, database }` |
| `GET /dev/outbox` | Development only: emails the server "sent" |

## Deploying

1. Create a Postgres database and set `DATABASE_URL`.
2. Set:
   - `NODE_ENV=production` and `DEV_MOCKS=false`
   - `TOKEN_ENCRYPTION_KEY`
   - `EMAIL_PROVIDER=resend` and `RESEND_API_KEY`
   - `CORS_ORIGINS`
   - the Google keys
   - `TRUST_PROXY=true` if it runs behind a load balancer

   The server checks these when it starts and refuses unsafe settings.
3. Run `npm ci && npm run build && npm start`. It applies migrations when it starts.

It runs anywhere that runs Node, such as Render, Railway, Fly.io or a VM.

`npm audit` reports 4 moderate advisories, all inside `drizzle-kit`'s development-only build tools. None of them ship with the server.

## Not built yet

- Team workspaces.
- Server-side PDF rendering. The app builds the PDF itself.
