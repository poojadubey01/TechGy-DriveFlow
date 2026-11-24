# TechGy DriveFlow

Real-estate deck builder: pick photos from Google Drive, build branded slide decks in a chat, export a PDF and share a link with the client.

## Folders

| Folder | What's in it |
| --- | --- |
| [`frontend/`](frontend) | The mobile and web app (Expo, React Native, Expo Router, NativeWind). See [frontend/README.md](frontend/README.md). |
| [`backend/`](backend) | The API (Node, TypeScript, Fastify, PostgreSQL): accounts, Google Drive sync, decks, share links and client activity. See [backend/README.md](backend/README.md). |

## Run the app

```powershell
cd frontend
npm install
npx expo start
```

## Run the API

```powershell
cd backend
npm install
npm run seed
npm run dev
```

The API runs at http://localhost:4000. The app doesn't use it yet; connecting the screens to the API is the next step.
