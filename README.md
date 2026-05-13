# Eurovision Draft

A web app for running a Eurovision song draft — users anonymously submit songs to a shared pool, vote on them with Eurovision-style jury points, and watch results revealed one voter at a time.

## Tech Stack

| | |
|---|---|
| **Frontend** | React 19 + Vite |
| **Backend** | Node.js + Express |
| **Database** | sql.js (SQLite-in-memory, persisted to `server/eurovision.db`) |

## Setup

### Prerequisites
- Node.js 18+

### First-time setup

```bash
# Install server dependencies
cd server
npm install

# Seed the database with all Eurovision songs (1956–2025, ~1800 songs)
node seed.js

# Install client dependencies and build
cd ../client
npm install
npm run build
```

### Running

```bash
cd server
node index.js
# → http://localhost:3001/eurovision/
```

To use a different port: `PORT=8080 node index.js`
