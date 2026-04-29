# Virtual Concertmaster

**Practice bowed string instruments with real-time audio feedback**

## Architecture Overview

This project uses a **micro-frontend architecture** with two frontend stacks:

### Frontend Stacks

| Stack | Location | Tech | Purpose |
|-------|----------|------|---------|
| Vanilla JS | `/` (root) | ES6 Modules | Production app - Audio engine, DSP, performance-critical code |
| React SPA | `/client/` | React 19 + Vite | Modern UI - Components, routing, state management |

### Architecture Decision

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed analysis.

**Chosen Strategy:** Micro-frontend Split (Option B)
- **Keep in Vanilla JS:** DSP engine, pitch detection, audio analysis (performance-critical)
- **Migrate to React:** UI components, routing, state management, auth

### Quick Start

```bash
# Install server dependencies
npm install

# Start Express server (serves vanilla JS app)
npm start

# For React development (in separate terminal)
cd client && npm install && npm run dev
```

### Key Technologies

- **Audio Processing:** Web Audio API, pYIN pitch detection algorithm
- **Sheet Music:** VexFlow for rendering MusicXML
- **Auth:** Supabase (React) / Custom JWT (legacy)
- **Backend:** Express.js API
- **Styling:** Tailwind CSS v4

### Project Structure

```
├── src/                    # Express server + Vanilla JS app
│   ├── index.js            # Server entry
│   ├── js/
│   │   ├── app.js          # Main vanilla JS app
│   │   ├── audio/          # Audio engine, pitch detection, DSP
│   │   ├── components/     # Vanilla JS UI components
│   │   ├── services/        # Business logic
│   │   └── analysis/        # Performance analysis
│   ├── routes/             # Express API routes
│   └── middleware/         # Express middleware
├── client/                 # React SPA
│   ├── src/
│   │   ├── App.jsx         # Main React app
│   │   ├── pages/          # Route pages
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── stores/         # Zustand stores
│   │   └── workers/        # Web Workers (DSP)
│   └── vite.config.js
├── docs/
│   └── ARCHITECTURE.md     # Detailed architecture documentation
└── public/                 # Static assets
```

### Documentation

- [Architecture Analysis](docs/ARCHITECTURE.md) - Detailed technical analysis
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Backend configuration
- [STYLE_GUIDE.md](STYLE_GUIDE.md) - Code style guidelines
