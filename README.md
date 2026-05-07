# Eurovision Draft

A web app for submitting Eurovision songs to a shared pool and voting on them.

## Setup

### Prerequisites
- Node.js 18+

### Server
```bash
cd server
npm install
npm run seed    # populate the database with Eurovision songs (1956-2025)
npm run dev     # start the API on http://localhost:3001
```

### Client
```bash
cd client
npm install
npm run dev     # start Vite on http://localhost:5173
```

## Features
- **Browse** all Eurovision songs (1956-2025) with search, country, and year filters
- **Submit** up to 2 songs per user to the shared pool
- **Vote** on submitted songs (1-10 scale)
- **Rankings** — pool sorted by average score
- Duplicate submission prevention (each song can only be submitted once)
