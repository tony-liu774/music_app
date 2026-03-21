/**
 * FollowTheBall Cursor Component
 * Visual cursor that tracks progress across sheet music during practice
 */

class FollowTheBall {
    constructor(container) {
        this.container = container;
        this.cursorElement = null;
        this.glowElement = null;
        this.enabled = false;
        this.speed = 1; // 0.5x to 2x
        this.isPaused = false;
        this.practiceMode = false; // Auto-advance without audio
        this.currentPosition = 0; // 0-1 progress
        this.targetPosition = 0;
        this.animationFrame = null;
        this.sheetMusicRenderer = null;

        // Settings from localStorage
        this.loadSettings();
    }

    loadSettings() {
        const savedEnabled = localStorage.getItem('followTheBallEnabled');
        const savedSpeed = localStorage.getItem('followTheBallSpeed');
        const savedPracticeMode = localStorage.getItem('practiceMode');

        if (savedEnabled !== null) {
            this.enabled = savedEnabled === 'true';
        }
        if (savedSpeed !== null) {
            this.speed = parseFloat(savedSpeed);
        }
        if (savedPracticeMode !== null) {
            this.practiceMode = savedPracticeMode === 'true';
        }
    }

    saveSettings() {
        localStorage.setItem('followTheBallEnabled', this.enabled);
        localStorage.setItem('followTheBallSpeed', this.speed);
        localStorage.setItem('practiceMode', this.practiceMode);
    }

    init() {
        this.createCursorElement();
        this.setupEventListeners();
        this.updateUI();
    }

    createCursorElement() {
        // Create container for cursor
        const cursorContainer = document.createElement('div');
        cursorContainer.className = 'follow-the-ball-container';
        cursorContainer.id = 'follow-the-ball-container';

        // Create glow effect
        this.glowElement = document.createElement('div');
        this.glowElement.className = 'follow-the-ball-glow';

        // Create the ball cursor
        this.cursorElement = document.createElement('div');
        this.cursorElement.className = 'follow-the-ball';

        // Inner ball with gradient
        this.cursorElement.innerHTML = `
            <div class="follow-the-ball-inner">
                <div class="follow-the-ball-highlight"></div>
            </div>
        `;

        // Append to container
        cursorContainer.appendChild(this.glowElement);
        cursorContainer.appendChild(this.cursorElement);

        // Add to sheet music container
        if (this.container) {
            this.container.appendChild(cursorContainer);
        }

        // Initially hidden
        cursorContainer.style.opacity = '0';
        cursorContainer.style.pointerEvents = 'none';
    }

    setupEventListeners() {
        // Settings toggle
        const cursorToggle = document.getElementById('show-cursor-toggle');
        if (cursorToggle) {
            cursorToggle.addEventListener('click', () => {
                this.toggle();
            });
        }

        // Speed slider
        const speedSlider = document.getElementById('cursor-speed-slider');
        const speedValue = document.getElementById('cursor-speed-value');
        if (speedSlider && speedValue) {
            speedSlider.addEventListener('input', (e) => {
                this.speed = parseFloat(e.target.value);
                speedValue.textContent = this.speed.toFixed(1) + 'x';
                this.saveSettings();
            });
        }

        // Jump to measure
        const jumpBtn = document.getElementById('cursor-jump-btn');
        const jumpInput = document.getElementById('cursor-jump-input');
        if (jumpBtn && jumpInput) {
            jumpBtn.addEventListener('click', () => {
                const measure = parseInt(jumpInput.value);
                if (measure > 0) {
                    this.jumpToMeasure(measure);
                }
            });
        }

        // Practice mode toggle
        const practiceModeToggle = document.getElementById('practice-mode-toggle');
        if (practiceModeToggle) {
            practiceModeToggle.addEventListener('click', () => {
                this.practiceMode = !this.practiceMode;
                practiceModeToggle.classList.toggle('active', this.practiceMode);
                practiceModeToggle.setAttribute('aria-checked', this.practiceMode);
                this.saveSettings();
            });
        }

        // Pause/Play cursor
        const pauseBtn = document.getElementById('cursor-pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.togglePause();
            });
        }

        // Listen for cursor position updates from sheet music renderer
        document.addEventListener('setCursorPosition', (e) => {
            if (e.detail && e.detail.position !== undefined) {
                this.setTargetPosition(e.detail.position);
            }
        });
    }

    updateUI() {
        const cursorToggle = document.getElementById('show-cursor-toggle');
        const cursorControls = document.getElementById('cursor-controls-group');
        const speedSlider = document.getElementById('cursor-speed-slider');
        const speedValue = document.getElementById('cursor-speed-value');
        const practiceModeToggle = document.getElementById('practice-mode-toggle');

        if (cursorToggle) {
            cursorToggle.classList.toggle('active', this.enabled);
            cursorToggle.setAttribute('aria-checked', this.enabled);
        }

        if (cursorControls) {
            cursorControls.style.display = this.enabled ? 'block' : 'none';
        }

        if (speedSlider) {
            speedSlider.value = this.speed;
        }
        if (speedValue) {
            speedValue.textContent = this.speed.toFixed(1) + 'x';
        }

        if (practiceModeToggle) {
            practiceModeToggle.classList.toggle('active', this.practiceMode);
            practiceModeToggle.setAttribute('aria-checked', this.practiceMode);
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        this.updateUI();
        this.saveSettings();

        if (this.enabled) {
            this.show();
        } else {
            this.hide();
        }
    }

    show() {
        const container = document.getElementById('follow-the-ball-container');
        if (container) {
            container.style.opacity = '1';
            container.style.pointerEvents = 'auto';
        }
    }

    hide() {
        const container = document.getElementById('follow-the-ball-container');
        if (container) {
            container.style.opacity = '0';
            container.style.pointerEvents = 'none';
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('cursor-pause-btn');
        if (pauseBtn) {
            if (this.isPaused) {
                pauseBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Resume Cursor
                `;
            } else {
                pauseBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <rect x="6" y="4" width="4" height="16"/>
                        <rect x="14" y="4" width="4" height="16"/>
                    </svg>
                    Pause Cursor
                `;
            }
        }
    }

    setTargetPosition(position) {
        if (this.isPaused) return;

        this.targetPosition = Math.max(0, Math.min(1, position));
        this.animateToTarget();
    }

    animateToTarget() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        const animate = () => {
            // Smooth interpolation based on speed
            const diff = this.targetPosition - this.currentPosition;
            const step = diff * 0.15 * this.speed;

            if (Math.abs(diff) > 0.001) {
                this.currentPosition += step;
                this.updatePosition();

                // Bounce animation when getting close to target
                if (Math.abs(diff) < 0.05) {
                    this.triggerBounce();
                }

                this.animationFrame = requestAnimationFrame(animate);
            } else {
                this.currentPosition = this.targetPosition;
                this.updatePosition();
            }
        };

        this.animationFrame = requestAnimationFrame(animate);
    }

    updatePosition() {
        if (!this.container) return;

        const rect = this.container.getBoundingClientRect();
        const containerScrollLeft = this.container.scrollLeft || 0;
        const containerScrollTop = this.container.scrollTop || 0;

        // Calculate position based on progress (0-1)
        // Use horizontal position primarily, but also handle vertical
        const x = containerScrollLeft + (rect.width * this.currentPosition);
        const y = containerScrollTop + (rect.height / 2);

        // Update cursor position
        if (this.cursorElement) {
            this.cursorElement.style.left = `${x}px`;
            this.cursorElement.style.top = `${y}px`;
        }

        // Update glow position
        if (this.glowElement) {
            this.glowElement.style.left = `${x}px`;
            this.glowElement.style.top = `${y}px`;
        }
    }

    triggerBounce() {
        if (this.cursorElement) {
            this.cursorElement.classList.add('bouncing');
            setTimeout(() => {
                this.cursorElement.classList.remove('bouncing');
            }, 300);
        }
    }

    // Called when a note is detected - cursor bounces on beat
    onNoteDetected() {
        this.triggerBounce();

        // In practice mode, auto-advance
        if (this.practiceMode && !this.isPaused) {
            this.currentPosition = Math.min(1, this.currentPosition + 0.02);
            this.updatePosition();
        }
    }

    jumpToMeasure(measureNumber) {
        if (!this.sheetMusicRenderer || !this.sheetMusicRenderer.score) return;

        const score = this.sheetMusicRenderer.score;
        const totalMeasures = score.parts[0]?.measures?.length || 1;
        const measureProgress = measureNumber / totalMeasures;

        this.setTargetPosition(measureProgress);
    }

    // Connect to sheet music renderer to receive position updates
    connectToRenderer(renderer) {
        this.sheetMusicRenderer = renderer;

        // Override setCursorPosition to also update our cursor
        const originalSetCursorPosition = renderer.setCursorPosition.bind(renderer);
        renderer.setCursorPosition = (position) => {
            originalSetCursorPosition(position);
            this.setTargetPosition(position);
        };
    }

    // Highlight upcoming notes in the score
    highlightUpcomingNotes(progress) {
        // This would be called to highlight the next few notes
        // Implementation depends on the sheet music renderer structure
    }

    reset() {
        this.currentPosition = 0;
        this.targetPosition = 0;
        this.isPaused = false;
        this.updatePosition();
        this.togglePause(); // Reset pause state
    }
}

window.FollowTheBall = FollowTheBall;
