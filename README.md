# The Virtual Concertmaster

Practice bowed string instruments with real-time feedback on pitch, timing, and intonation.

## Quick Start

### Production (Vanilla JS)

```bash
npm install
npm run build:css
npm start
```

Visit http://localhost:3000

### Development (React)

```bash
# Terminal 1: Start Express API
npm start

# Terminal 2: Start React dev server
cd client
npm install
npm run dev
```

Visit http://localhost:5173

## Architecture

This codebase contains **two frontend implementations**:

1. **Vanilla JS App** (`src/` + root `index.html`) - Current production app
2. **React App** (`client/`) - New frontend being actively developed

The React app is being developed as a **progressive migration** from vanilla JS. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.

### Key Points

- Both apps share the same Express backend (`src/index.js`)
- The React app ports features incrementally from vanilla JS
- Some code is shared via imports (e.g., `SessionLogger`)
- When complete, React will become the primary frontend

## Project Structure

```
├── index.html           # Vanilla JS entry (production)
├── src/
│   ├── index.js        # Express server
│   ├── js/             # Vanilla JS app
│   │   ├── app.js      # Main orchestrator
│   │   ├── audio/      # Pitch detection, DSP
│   │   ├── components/ # UI components
│   │   └── services/   # API clients
│   ├── routes/         # API routes
│   └── middleware/     # Express middleware
├── client/             # React app (in development)
│   ├── src/
│   │   ├── components/ # React UI components
│   │   ├── pages/      # Route pages
│   │   ├── stores/     # Zustand state
│   │   └── hooks/      # React hooks
│   └── vite.config.js
└── docs/
    └── ARCHITECTURE.md # Architecture documentation
```

## Technology Stack

- **Backend:** Express.js, Node.js
- **Vanilla Frontend:** Vanilla JS, Tailwind CSS
- **React Frontend:** React 19, Vite, Zustand, React Router
- **Database:** Supabase (auth, storage, realtime)
- **Audio:** Web Audio API, custom DSP (YIN pitch detection)

## Features

- Real-time pitch detection and feedback
- Sheet music display with MusicXML support
- Practice session logging with heat maps
- Smart practice loops for problem areas
- Teacher/student studio dashboard
- IMSLP score library integration
- Offline practice support
- AI-generated practice summaries

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Supabase Setup](SUPABASE_SETUP.md)
- [Style Guide](STYLE_GUIDE.md)

## License

MIT
