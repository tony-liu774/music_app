/**
 * Dashboard UI — Tonic/Edulastic-style landing page
 * Renders progress rings, hero card, stats, and recent pieces.
 */

class DashboardUI {
    constructor(app) {
        this.app = app;

        // DOM references
        this.heroTitle = null;
        this.heroLastPracticed = null;
        this.heroInstrumentLabel = null;
        this.heroOverallScore = null;
        this.heroPracticeTime = null;
        this.heroStreak = null;
        this.assignmentList = null;
        this.assignmentCount = null;
        this.assignmentEmptyState = null;

        // Progress ring elements
        this.ringIntonation = null;
        this.ringRhythm = null;
        this.ringPitch = null;

        // Ring circumference (2 * PI * 24)
        this.circumference = 2 * Math.PI * 24;
    }

    init() {
        this.cacheDOM();
        this.loadStats();
        this.loadRecentPieces();
    }

    cacheDOM() {
        this.heroTitle = document.getElementById('hero-piece-title');
        this.heroLastPracticed = document.getElementById('hero-last-practiced');
        this.heroInstrumentLabel = document.getElementById('hero-instrument-label');
        this.heroOverallScore = document.getElementById('hero-overall-score');
        this.heroPracticeTime = document.getElementById('hero-practice-time');
        this.heroStreak = document.getElementById('hero-streak');
        this.assignmentList = document.getElementById('assignment-list');
        this.assignmentCount = document.getElementById('assignment-count');
        this.assignmentEmptyState = document.getElementById('assignment-empty-state');

        // Progress rings
        this.ringIntonation = document.getElementById('ring-intonation');
        this.ringRhythm = document.getElementById('ring-rhythm');
        this.ringPitch = document.getElementById('ring-pitch');
        this.ringIntonationLabel = document.getElementById('ring-intonation-label');
        this.ringRhythmLabel = document.getElementById('ring-rhythm-label');
        this.ringPitchLabel = document.getElementById('ring-pitch-label');

        // Stat values
        this.statIntonation = document.getElementById('stat-intonation');
        this.statRhythm = document.getElementById('stat-rhythm');
        this.statPitch = document.getElementById('stat-pitch');
    }

    /**
     * Load practice stats from localStorage and update dashboard
     */
    loadStats() {
        const stats = this.getStoredStats();

        // Update hero card
        this.updateHeroCard(stats);

        // Update progress rings
        this.setProgressRing(this.ringIntonation, this.ringIntonationLabel, stats.intonation);
        this.setProgressRing(this.ringRhythm, this.ringRhythmLabel, stats.rhythm);
        this.setProgressRing(this.ringPitch, this.ringPitchLabel, stats.pitch);

        // Update stat card values
        if (this.statIntonation) {
            this.statIntonation.textContent = stats.intonation >= 0 ? stats.intonation + '%' : '--';
        }
        if (this.statRhythm) {
            this.statRhythm.textContent = stats.rhythm >= 0 ? stats.rhythm + '%' : '--';
        }
        if (this.statPitch) {
            this.statPitch.textContent = stats.pitch >= 0 ? stats.pitch + '%' : '--';
        }

        // Update instrument badge
        if (this.heroInstrumentLabel) {
            const instrument = this.app?.selectedInstrument || 'Violin';
            this.heroInstrumentLabel.textContent = instrument.charAt(0).toUpperCase() + instrument.slice(1);
        }
    }

    /**
     * Update the hero practice session card
     */
    updateHeroCard(stats) {
        if (this.heroTitle) {
            this.heroTitle.textContent = stats.lastPiece || 'No recent piece';
        }
        if (this.heroLastPracticed) {
            this.heroLastPracticed.textContent = stats.lastDate
                ? 'Last practiced: ' + this.formatDate(stats.lastDate)
                : 'Start a practice session';
        }
        if (this.heroOverallScore) {
            this.heroOverallScore.textContent = stats.overallScore >= 0 ? stats.overallScore + '%' : '--';
        }
        if (this.heroPracticeTime) {
            this.heroPracticeTime.textContent = this.formatDuration(stats.todayMinutes || 0);
        }
        if (this.heroStreak) {
            this.heroStreak.textContent = String(stats.streak || 0);
        }
    }

    /**
     * Animate a progress ring to a target percentage (0-100)
     */
    setProgressRing(ringEl, labelEl, pct) {
        if (!ringEl) return;
        const clamped = Math.max(0, Math.min(100, pct));
        const offset = this.circumference - (clamped / 100) * this.circumference;
        ringEl.style.strokeDashoffset = String(offset);

        if (labelEl) {
            labelEl.textContent = pct >= 0 ? pct + '%' : '--%';
        }
    }

    /**
     * Load recent pieces from the library and render as assignment-style items
     */
    loadRecentPieces() {
        let pieces = [];
        try {
            const stored = localStorage.getItem('concertmaster_library');
            if (stored) {
                pieces = JSON.parse(stored);
            }
        } catch (_e) {
            // Ignore
        }

        // Also check ScoreLibrary if available
        if (!pieces.length && this.app?.scoreLibrary?.scores) {
            pieces = this.app.scoreLibrary.scores;
        }

        this.renderAssignmentList(pieces);
    }

    /**
     * Render pieces as Edulastic-style assignment list items
     */
    renderAssignmentList(pieces) {
        if (!this.assignmentList) return;

        if (!pieces || pieces.length === 0) {
            if (this.assignmentCount) this.assignmentCount.textContent = '0';
            if (this.assignmentEmptyState) this.assignmentEmptyState.style.display = '';
            return;
        }

        // Hide empty state
        if (this.assignmentEmptyState) this.assignmentEmptyState.style.display = 'none';
        if (this.assignmentCount) this.assignmentCount.textContent = String(pieces.length);

        // Clear existing items (except empty state)
        const existingItems = this.assignmentList.querySelectorAll('.assignment-item:not(#assignment-empty-state)');
        existingItems.forEach(item => item.remove());

        // Sort by last practiced (most recent first)
        const sorted = [...pieces].sort((a, b) => {
            const dateA = a.lastPracticed ? new Date(a.lastPracticed).getTime() : 0;
            const dateB = b.lastPracticed ? new Date(b.lastPracticed).getTime() : 0;
            return dateB - dateA;
        });

        // Render up to 8 items
        const toRender = sorted.slice(0, 8);
        toRender.forEach(piece => {
            const item = this.createAssignmentItem(piece);
            this.assignmentList.appendChild(item);
        });
    }

    /**
     * Create a single assignment list item DOM element
     */
    createAssignmentItem(piece) {
        const item = document.createElement('div');
        item.className = 'assignment-item';
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');

        // Determine status
        const score = piece.lastScore || piece.score || 0;
        let statusClass = 'pending';
        let progressClass = 'low';
        if (score >= 80) {
            statusClass = 'complete';
            progressClass = 'good';
        } else if (score >= 50) {
            statusClass = 'in-progress';
            progressClass = 'medium';
        }

        // Score color
        let scoreColor = 'var(--text-muted)';
        if (score >= 80) scoreColor = 'var(--success)';
        else if (score >= 50) scoreColor = 'var(--primary)';
        else if (score > 0) scoreColor = 'var(--error)';

        // Build meta info
        const metaParts = [];
        if (piece.composer) {
            metaParts.push(this.escapeHTML(piece.composer));
        }
        if (piece.instrument) {
            metaParts.push(this.escapeHTML(piece.instrument));
        }
        if (piece.lastPracticed) {
            metaParts.push(this.formatDate(piece.lastPracticed));
        }

        item.innerHTML = `
            <div class="assignment-status-dot ${statusClass}"></div>
            <div class="assignment-info">
                <div class="assignment-title">${this.escapeHTML(piece.title || 'Untitled')}</div>
                <div class="assignment-meta">${metaParts.join(' · ')}</div>
            </div>
            <div class="assignment-progress-bar">
                <div class="assignment-progress-fill ${progressClass}" style="width: ${Math.min(100, score)}%"></div>
            </div>
            <span class="assignment-score" style="color: ${scoreColor}">${score > 0 ? score + '%' : '--'}</span>
        `;

        // Click handler to navigate to practice view
        item.addEventListener('click', () => {
            if (this.app) {
                this.app.showView('practice-view');
            }
        });

        // Keyboard accessibility
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.click();
            }
        });

        return item;
    }

    /**
     * Retrieve stored stats from localStorage
     */
    getStoredStats() {
        const defaults = {
            intonation: -1,
            rhythm: -1,
            pitch: -1,
            overallScore: -1,
            todayMinutes: 0,
            streak: 0,
            lastPiece: null,
            lastDate: null
        };

        try {
            const raw = localStorage.getItem('concertmaster_dashboard_stats');
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...defaults, ...parsed };
            }
        } catch (_e) {
            // Ignore
        }

        // Fallback: try to read from session data
        try {
            const sessionRaw = localStorage.getItem('concertmaster_last_session');
            if (sessionRaw) {
                const session = JSON.parse(sessionRaw);
                return {
                    ...defaults,
                    intonation: session.intonation ?? defaults.intonation,
                    rhythm: session.rhythm ?? defaults.rhythm,
                    pitch: session.pitch ?? defaults.pitch,
                    overallScore: session.overallScore ?? defaults.overallScore,
                    lastPiece: session.piece ?? defaults.lastPiece,
                    lastDate: session.date ?? defaults.lastDate
                };
            }
        } catch (_e) {
            // Ignore
        }

        return defaults;
    }

    /**
     * Save stats to localStorage (called after practice sessions)
     */
    saveStats(stats) {
        try {
            localStorage.setItem('concertmaster_dashboard_stats', JSON.stringify(stats));
        } catch (_e) {
            // Ignore quota errors
        }
    }

    /**
     * Refresh the dashboard (called when navigating back to dashboard)
     */
    refresh() {
        this.loadStats();
        this.loadRecentPieces();
    }

    /**
     * Format a date string for display
     */
    formatDate(dateStr) {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));

            if (days === 0) return 'Today';
            if (days === 1) return 'Yesterday';
            if (days < 7) return days + ' days ago';

            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (_e) {
            return dateStr;
        }
    }

    /**
     * Format duration in minutes for display
     */
    formatDuration(minutes) {
        if (minutes < 1) return '0m';
        if (minutes < 60) return minutes + 'm';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? hours + 'h ' + mins + 'm' : hours + 'h';
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// CommonJS export guard
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardUI };
}
