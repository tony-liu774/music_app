/**
 * Tuner Gauge Component
 * Glowing needle-style display for intonation feedback
 */

class TunerGauge {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            minCents: -50,
            maxCents: 50,
            size: options.size || 300,
            needleColor: '#c9a227',
            ...options
        };

        this.currentCents = 0;
        this.isInTune = false;
        this.targetNote = null;
    }

    init() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        if (!this.container) return;

        const size = this.options.size;
        const centerX = size / 2;
        const centerY = size * 0.85;
        const radius = size * 0.4;

        this.container.innerHTML = `
            <div class="tuner-gauge" style="width: ${size}px; height: ${size}px;">
                <svg viewBox="0 0 ${size} ${size}" class="gauge-svg">
                    <!-- Background arc -->
                    <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color: var(--error-light)"/>
                            <stop offset="35%" style="stop-color: var(--warning-light)"/>
                            <stop offset="50%" style="stop-color: var(--success-light)"/>
                            <stop offset="65%" style="stop-color: var(--warning-light)"/>
                            <stop offset="100%" style="stop-color: var(--error-light)"/>
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                        <filter id="needleGlow">
                            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>

                    <!-- Tick marks -->
                    <g class="tick-marks">
                        ${this.renderTickMarks(centerX, centerY, radius)}
                    </g>

                    <!-- Scale labels -->
                    <g class="scale-labels" font-family="var(--font-mono)" font-size="14" fill="var(--text-secondary)">
                        <text x="${centerX - radius - 10}" y="${centerY - radius * 0.7}" text-anchor="end">-50</text>
                        <text x="${centerX + radius + 10}" y="${centerY - radius * 0.7}" text-anchor="start">+50</text>
                        <text x="${centerX}" y="${centerY - radius + 20}" text-anchor="middle">0</text>
                    </g>

                    <!-- Center indicator line -->
                    <line x1="${centerX}" y1="${centerY - radius * 0.2}"
                          x2="${centerX}" y2="${centerY - radius * 0.9}"
                          stroke="var(--success)" stroke-width="3"
                          filter="url(#glow)" opacity="0.8"/>

                    <!-- Needle -->
                    <g class="needle" filter="url(#needleGlow)">
                        <polygon
                            points="${centerX},${centerY - radius * 0.15} ${centerX - 8},${centerY} ${centerX + 8},${centerY}"
                            fill="${this.options.needleColor}"
                            class="needle-shape"/>
                        <circle cx="${centerX}" cy="${centerY}" r="12" fill="var(--bg-elevated)" stroke="${this.options.needleColor}" stroke-width="2"/>
                        <circle cx="${centerX}" cy="${centerY}" r="6" fill="${this.options.needleColor}"/>
                    </g>

                    <!-- Current note display -->
                    <g class="note-display" transform="translate(${centerX}, ${centerY * 0.4})">
                        <text class="note-name" text-anchor="middle" fill="var(--text-primary)" font-size="48" font-family="var(--font-heading)">--</text>
                        <text class="note-octave" text-anchor="middle" fill="var(--text-secondary)" font-size="20" font-family="var(--font-mono)" dy="30">--</text>
                    </g>

                    <!-- Frequency display -->
                    <text class="frequency-display" x="${centerX}" y="${centerY * 0.7}" text-anchor="middle"
                          fill="var(--text-muted)" font-size="16" font-family="var(--font-mono)">-- Hz</text>

                    <!-- Cents display -->
                    <text class="cents-display" x="${centerX}" y="${centerY * 0.82}" text-anchor="middle"
                          fill="var(--text-primary)" font-size="24" font-family="var(--font-mono)">0¢</text>

                    <!-- Status indicator -->
                    <g class="status-indicator" transform="translate(${centerX}, ${size * 0.15})">
                        <circle cx="0" cy="0" r="25" fill="var(--bg-elevated)" stroke="var(--border)" stroke-width="2"/>
                        <text class="status-text" text-anchor="middle" dy="5" fill="var(--text-secondary)" font-size="12" font-family="var(--font-body)">FLAT</text>
                    </g>
                </svg>

                <!-- Glow overlay -->
                <div class="gauge-glow"></div>
            </div>
        `;

        this.needle = this.container.querySelector('.needle');
        this.noteName = this.container.querySelector('.note-name');
        this.noteOctave = this.container.querySelector('.note-octave');
        this.frequencyDisplay = this.container.querySelector('.frequency-display');
        this.centsDisplay = this.container.querySelector('.cents-display');
        this.statusText = this.container.querySelector('.status-text');
    }

    renderTickMarks(centerX, centerY, radius) {
        let marks = '';
        const startAngle = Math.PI; // 180 degrees
        const endAngle = 0; // 0 degrees

        // Main tick marks every 10 cents
        for (let i = 0; i <= 10; i++) {
            const angle = startAngle + (i / 10) * (endAngle - startAngle);
            const isMajor = i % 5 === 0;
            const innerRadius = isMajor ? radius * 0.85 : radius * 0.9;
            const outerRadius = radius;

            const x1 = centerX + Math.cos(angle) * innerRadius;
            const y1 = centerY + Math.sin(angle) * innerRadius;
            const x2 = centerX + Math.cos(angle) * outerRadius;
            const y2 = centerY + Math.sin(angle) * outerRadius;

            const strokeWidth = isMajor ? 2 : 1;
            const color = isMajor ? 'var(--border-light)' : 'var(--border)';

            marks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${strokeWidth}"/>`;
        }

        return marks;
    }

    setupEventListeners() {
        // Could add touch/drag interactions here
    }

    /**
     * Update the gauge with new note data
     */
    update(data) {
        if (!data) return;

        const { note, centsDeviation, frequency, closestNote } = data;

        // Clamp cents to display range
        this.currentCents = Math.max(this.options.minCents, Math.min(this.options.maxCents, centsDeviation));

        // Rotate needle
        this.rotateNeedle(this.currentCents);

        // Update note display
        if (this.noteName && note) {
            this.noteName.textContent = note.name || '--';
        }
        if (this.noteOctave && note) {
            this.noteOctave.textContent = note.octave !== undefined ? note.octave : '';
        }

        // Update frequency display
        if (this.frequencyDisplay) {
            this.frequencyDisplay.textContent = frequency ? `${frequency.toFixed(1)} Hz` : '-- Hz';
        }

        // Update cents display
        if (this.centsDisplay) {
            const centsText = centsDeviation > 0 ? `+${centsDeviation}` : `${centsDeviation}`;
            this.centsDisplay.textContent = `${centsText}¢`;
        }

        // Update status and colors
        this.updateStatus(centsDeviation);
    }

    /**
     * Rotate needle to show cents deviation
     */
    rotateNeedle(cents) {
        if (!this.needle) return;

        // Map -50 to +50 cents to -90 to +90 degrees
        const angle = (cents / 50) * 90;
        this.needle.setAttribute('transform', `rotate(${angle}, ${this.options.size / 2}, ${this.options.size * 0.85})`);
    }

    /**
     * Update status indicator based on cents deviation
     */
    updateStatus(cents) {
        const absCents = Math.abs(cents);
        const needleShape = this.container?.querySelector('.needle-shape');
        const statusText = this.container?.querySelector('.status-text');

        if (absCents <= 10) {
            // In tune - Emerald
            this.isInTune = true;
            this.setColors('var(--success)', 'IN TUNE');
            if (statusText) statusText.textContent = 'IN TUNE';
        } else if (cents < 0) {
            // Flat - Crimson
            this.isInTune = false;
            this.setColors('var(--error)', 'FLAT');
            if (statusText) statusText.textContent = 'FLAT';
        } else {
            // Sharp - Crimson
            this.isInTune = false;
            this.setColors('var(--error)', 'SHARP');
            if (statusText) statusText.textContent = 'SHARP';
        }
    }

    setColors(color, status) {
        const needleShape = this.container?.querySelector('.needle-shape');
        const needleCenter = this.container?.querySelector('.needle circle:nth-child(2)');
        const needleCenterInner = this.container?.querySelector('.needle circle:nth-child(3)');

        if (needleShape) {
            needleShape.setAttribute('fill', color);
            needleShape.style.filter = 'url(#needleGlow)';
        }
        if (needleCenter) {
            needleCenter.setAttribute('stroke', color);
        }
        if (needleCenterInner) {
            needleCenterInner.setAttribute('fill', color);
        }

        // Update cents display color
        if (this.centsDisplay) {
            this.centsDisplay.setAttribute('fill', color);
        }
    }

    /**
     * Reset the gauge to initial state
     */
    reset() {
        this.currentCents = 0;
        this.rotateNeedle(0);

        if (this.noteName) this.noteName.textContent = '--';
        if (this.noteOctave) this.noteOctave.textContent = '';
        if (this.frequencyDisplay) this.frequencyDisplay.textContent = '-- Hz';
        if (this.centsDisplay) this.centsDisplay.textContent = '0¢';

        this.setColors('var(--primary)', 'FLAT');
    }

    /**
     * Set target note for visual reference
     */
    setTargetNote(note) {
        this.targetNote = note;
    }

    /**
     * Get current state
     */
    getState() {
        return {
            cents: this.currentCents,
            isInTune: this.isInTune,
            targetNote: this.targetNote
        };
    }
}

// Export for use
window.TunerGauge = TunerGauge;
