# Milestone 4: AI Coach and Analytics

## Goal

Build the post-practice AI coaching system that analyzes session data, generates encouraging two-sentence feedback in the style of a masterclass professor, renders a crimson heat map over the sheet music highlighting error-heavy measures, and implements Smart Loop to extract and drill weak passages.

## Scope

- Post-session AI debrief via LLM backend
- Crimson heat map overlay on VexFlow-rendered sheet music
- Smart Loop: automatic extraction of red measures with 15% tempo reduction
- Practice history dashboard with session analytics

---

### Task 1: Post-Session AI Coaching Debrief

**Description:** When the player stops practice, aggregate the session error log and send it to the LLM backend for analysis. Display the AI coach response as an encouraging two-sentence debrief in a styled modal.

**Agent type:** coder

**Depends on:** Milestone 2 / Task 4 (Session Logger Integration), Milestone 1 / Task 3 (Base UI Component Library)

**Subtasks:**
1. Port `src/js/analysis/ai-summary-generator.js` into `client/src/services/AISummaryService.js` -- adapt to use Zustand session store data and fetch API for backend calls
2. Create the aggregation payload: extract `getWorstMeasures(5)`, overall accuracy percentage, total practice duration, intonation trend (improving vs. deteriorating), vibrato usage stats
3. Create `client/src/components/practice/CoachDebrief.jsx` -- modal that appears after practice stop, shows a loading state while AI generates, then displays the response
4. Style the debrief: Playfair Display header ("Session Debrief"), AI text in Source Sans 3, amber accent line, overall session score as a large number with emerald/crimson coloring
5. Wire to the existing `/api/ai` Express route which already handles LLM calls via OpenAI
6. Include a "Practice Again" button and a "View Details" button that navigates to the heat map view
7. Handle offline case: if API is unreachable, show a local summary based on `getSessionSummary()` without AI text

**Acceptance criteria:**
- After stopping practice, the AI debrief modal appears within 3 seconds
- AI response is max 2 sentences, encouraging and specific to the session data
- Loading state shows a subtle amber spinner
- Offline fallback displays a useful local summary
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 2: Crimson Heat Map Overlay

**Description:** Render a semi-transparent crimson overlay on the VexFlow sheet music highlighting measures with high error density. Error intensity maps to opacity -- more errors produce a deeper red.

**Agent type:** coder

**Depends on:** Milestone 3 / Task 2 (VexFlow Sheet Music Renderer), Milestone 2 / Task 4 (Session Logger Integration)

**Subtasks:**
1. Create `client/src/components/practice/HeatMapOverlay.jsx` -- SVG overlay that sits on top of the VexFlow-rendered score, with one semi-transparent rectangle per measure
2. Port heat map logic from `src/js/components/heat-map-renderer.js` -- calculate error density per measure from session log data
3. Map error density to opacity: 0 errors = fully transparent, max errors = `bg-crimson/40` (40% opacity crimson). Use a logarithmic scale so a few errors still show light pink
4. Add measure labels on hover showing: measure number, error count, average deviation in cents, worst note
5. Animate the heat map appearance: measures fade in sequentially from left to right over 1 second after the debrief modal is dismissed
6. Ensure overlay aligns precisely with VexFlow measure boundaries by reading measure bounding boxes from the VexFlow renderer

**Acceptance criteria:**
- Error-heavy measures show clearly visible crimson overlay
- Low-error measures are nearly transparent
- Hovering a measure shows detailed error statistics
- Overlay aligns precisely with measure boundaries in the sheet music
- Heat map fades in with a smooth sequential animation
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 3: Smart Loop Practice Mode

**Description:** Implement Smart Loop -- automatically extract the worst measures (red zones from the heat map), reduce tempo by 15%, and loop the player through those measures until accuracy improves. This is the core "deliberate practice" feature.

**Agent type:** coder

**Depends on:** Milestone 4 / Task 2 (Crimson Heat Map Overlay), Milestone 3 / Task 3 (Predictive Cursor)

**Subtasks:**
1. Create `client/src/components/practice/SmartLoop.jsx` -- UI component that displays the loop region on the sheet music (amber brackets around the looped measures) and loop count
2. Port and enhance logic from `src/js/components/practice-loop.js` -- extract measures where error density exceeds a threshold (e.g., top 20% worst measures or measures with >25 cents average deviation)
3. Calculate reduced tempo: current tempo minus 15%, with a floor of 40 BPM
4. Implement loop playback: cursor loops back to the start of the extracted region when it reaches the end, incrementing a loop counter
5. Track accuracy improvement across loops: compare each loop's average deviation to the first loop. Display an emerald "Improving" badge when accuracy improves by >10%
6. Auto-exit loop when accuracy reaches an acceptable threshold (average deviation <15 cents for 3 consecutive loops) with an encouraging toast notification
7. Allow manual exit via "Exit Loop" button or Escape key

**Acceptance criteria:**
- Smart Loop automatically identifies and selects the worst measures
- Tempo is reduced by 15% during loop practice
- Cursor loops seamlessly at the boundaries of the selected region
- Improvement tracking works and shows emerald badge on progress
- Auto-exit triggers when the player demonstrates consistent accuracy
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 4: Practice History Dashboard

**Description:** Build the dashboard home page showing practice history, session analytics, and progress over time. This replaces the existing vanilla JS dashboard.

**Agent type:** coder

**Depends on:** Milestone 1 / Task 3 (Base UI Component Library), Milestone 1 / Task 5 (Zustand Store Architecture), Milestone 2 / Task 4 (Session Logger Integration)

**Subtasks:**
1. Create `client/src/pages/DashboardPage.jsx` -- replace the placeholder with a full analytics dashboard
2. Build `client/src/components/dashboard/PracticeStreakWidget.jsx` -- shows current practice streak (days), total practice time this week, sessions count
3. Build `client/src/components/dashboard/RecentSessionsList.jsx` -- list of recent sessions with date, piece name, duration, accuracy score, and a "Review" link to see the heat map
4. Build `client/src/components/dashboard/ProgressChart.jsx` -- simple chart showing accuracy trend over the last 30 days (use CSS/SVG, no heavy charting library). Amber line on oxford-blue background
5. Build `client/src/components/dashboard/UpNextWidget.jsx` -- port from existing `up-next-widget.js`, shows suggested next practice piece based on weak areas
6. All widgets use Card component with Midnight Conservatory styling
7. Responsive layout: single column on mobile, 2-column grid on desktop

**Acceptance criteria:**
- Dashboard shows meaningful practice analytics on load
- Practice streak and session history are accurate from stored data
- Progress chart renders a clean trend line without external charting dependencies
- "Review" link on sessions navigates to the heat map for that session
- Responsive layout works on mobile and desktop
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`
