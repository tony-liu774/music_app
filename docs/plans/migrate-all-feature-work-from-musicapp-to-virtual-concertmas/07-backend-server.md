# Milestone 7: Backend Server

## Goal

Migrate the Express backend into a `server/` directory within virtual-concertmaster, with its own package.json and independent dependency management. In a Tauri app, this server can be spawned as a sidecar process or run separately during development.

**Target repo:** `tony-liu774/virtual-concertmaster` — see 00-overview.md "Cross-Repo Execution Model" for setup.

## Tasks

### Task 7.1: Migrate Express Server Core

**Description:** Set up the `server/` directory with its own package.json (based on music_app's root package.json) and copy the Express server entry point (`src/index.js`), configuration (`src/config/`), and middleware (`src/middleware/`). The backend uses CommonJS (`require`) so keep that module format.

**Agent type:** coder

**Subtasks:**
1. Create `server/` directory in virtual-concertmaster
2. Create `server/package.json` based on music_app's root package.json -- keep Express, helmet, cors, dotenv, jsonwebtoken, bcryptjs, express-rate-limit, multer, openai, uuid, node-cron, jspdf, aws-sdk deps; keep jest as dev dep. **Note:** `aws-sdk` is v2; migrating to `@aws-sdk/client-*` v3 is out of scope for this migration but should be tracked as future tech debt.
3. Copy `src/index.js` to `server/src/index.js`
4. Copy `src/config/index.js` to `server/src/config/index.js`
5. Copy `src/middleware/*.js` to `server/src/middleware/`
6. Update any path references in copied files (e.g., static file serving paths)
7. Create `server/.env.example` with required environment variables
8. Run `cd server && npm install`
9. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- `server/package.json` has all required dependencies
- `cd server && npm install` succeeds
- Server entry point loads without runtime errors (env vars may be missing but no import failures)

**Dependencies:** None (backend is independent of frontend)

---

### Task 7.2: Migrate Routes and Server Services

**Description:** Copy all Express route handlers from `src/routes/` and server services from `src/services/` into the server directory. Routes include: health, IMSLP proxy, OMR, teacher, auth, OAuth, sync, assignments, notifications, license, and AI. Services include: scheduler, video-storage, video-trimmer.

**Agent type:** coder

**Subtasks:**
1. Copy `src/routes/*.js` (11 route files) to `server/src/routes/`
2. Copy `src/services/*.js` (3 service files) to `server/src/services/`
3. Update all require paths in route and service files
4. Copy `tests/setup.js` to `server/tests/setup.js`
5. Copy all server test files from `tests/` that test routes/middleware/services to `server/tests/`: auth-routes.test.js, middleware.test.js, license-routes.test.js, oauth-routes.test.js, role-routes.test.js, sync-routes.test.js, teacher-routes.test.js, video-snippet-routes.test.js, static-files.test.js
6. Update test file require paths
7. Add test script to `server/package.json`
8. Verify server tests run (some may need env stubs)
9. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All 11 route files exist in `server/src/routes/`
- All 3 service files exist in `server/src/services/`
- Server test files are present with updated paths
- `cd server && npm test` runs without import errors

**Dependencies:** Task 7.1

---

### Task 7.3: Configure Vite Dev Proxy for Backend

**Description:** Update virtual-concertmaster's `vite.config.js` to proxy `/api` requests to the Express server during development (matching music_app's client vite config). Also add a convenience npm script to run both the Vite dev server and the Express server concurrently.

**Agent type:** coder

**Subtasks:**
1. Add proxy configuration to `vite.config.js`: `/api` -> `http://localhost:3000`
2. Add `concurrently` as a dev dependency (or use a simple script)
3. Add npm script `"dev:full": "npx concurrently \"npm run dev\" \"cd server && npm run dev\""` to run both servers
4. Update `server/package.json` scripts to include `"dev": "node --watch src/index.js"`
5. Test that `npm run dev:full` starts both Vite and Express servers
6. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- Vite dev server proxies `/api/*` requests to Express
- `npm run dev:full` starts both servers
- API requests from the frontend reach the Express backend

**Dependencies:** Task 7.1
