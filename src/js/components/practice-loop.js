/**
 * Practice Loop Controller - Smart looping for problematic measures
 * Creates practice loops based on AI analysis
 */

class PracticeLoopController {
    constructor() {
        this.isActive = false;
        this.loopMeasures = [];
        this.currentLoopIndex = 0;
        this.loopCount = 0;
        this.maxLoops = 5;
        this.originalTempo = 120;
        this.suggestedTempo = 80;
        this.onLoopChange = null;
        this.onComplete = null;
    }

    /**
     * Initialize practice loop with AI recommendations
     * @param {Object} params - Configuration parameters
     * @param {Array} params.measures - Array of measure numbers to loop
     * @param {number} params.suggestedTempo - Suggested tempo for practice
     * @param {number} params.maxLoops - Maximum number of loops (default 5)
     */
    init({ measures, suggestedTempo, maxLoops = 5 }) {
        if (!measures || measures.length === 0) {
            console.warn('PracticeLoop: No measures provided for looping');
            return;
        }

        this.loopMeasures = measures.slice(0, 3); // Limit to 3 measures max
        this.suggestedTempo = suggestedTempo || 80;
        this.maxLoops = maxLoops;
        this.currentLoopIndex = 0;
        this.loopCount = 0;
        this.isActive = false;

        console.log(`PracticeLoop: Initialized with measures ${this.loopMeasures.join(', ')} at ${this.suggestedTempo} BPM`);
    }

    /**
     * Start the practice loop
     */
    start() {
        if (!this.loopMeasures.length) {
            console.warn('PracticeLoop: No loop measures configured');
            return;
        }

        this.isActive = true;
        this.loopCount = 0;
        this.currentLoopIndex = 0;

        this.notifyLoopChange();
        console.log('PracticeLoop: Started');
    }

    /**
     * Stop the practice loop
     */
    stop() {
        this.isActive = false;
        console.log('PracticeLoop: Stopped');
    }

    /**
     * Advance to the next loop iteration
     * @returns {Object} Current loop state
     */
    next() {
        if (!this.isActive) return null;

        this.currentLoopIndex++;
        this.loopCount++;

        // Check if we've completed all loops
        if (this.loopCount >= this.maxLoops) {
            this.complete();
            return this.getState();
        }

        // Cycle through measures
        if (this.currentLoopIndex >= this.loopMeasures.length) {
            this.currentLoopIndex = 0;
        }

        this.notifyLoopChange();
        return this.getState();
    }

    /**
     * Mark current iteration as complete and advance
     */
    completeIteration() {
        return this.next();
    }

    /**
     * Complete the practice session
     */
    complete() {
        this.isActive = false;

        if (this.onComplete) {
            this.onComplete({
                totalLoops: this.loopCount,
                measures: this.loopMeasures,
                suggestedTempo: this.suggestedTempo
            });
        }

        console.log(`PracticeLoop: Completed ${this.loopCount} iterations`);
    }

    /**
     * Get current loop state
     * @returns {Object} Current state
     */
    getState() {
        return {
            isActive: this.isActive,
            currentMeasure: this.loopMeasures[this.currentLoopIndex] || null,
            currentIndex: this.currentLoopIndex,
            totalMeasures: this.loopMeasures.length,
            loopCount: this.loopCount,
            maxLoops: this.maxLoops,
            suggestedTempo: this.suggestedTempo,
            progress: this.loopCount / this.maxLoops
        };
    }

    /**
     * Notify listener of loop change
     */
    notifyLoopChange() {
        if (this.onLoopChange) {
            this.onLoopChange(this.getState());
        }
    }

    /**
     * Set callback for loop changes
     * @param {Function} callback - Callback function
     */
    setOnLoopChange(callback) {
        this.onLoopChange = callback;
    }

    /**
     * Set callback for completion
     * @param {Function} callback - Callback function
     */
    setOnComplete(callback) {
        this.onComplete = callback;
    }

    /**
     * Get the measures included in the loop
     * @returns {Array} Array of measure numbers
     */
    getLoopMeasures() {
        return [...this.loopMeasures];
    }

    /**
     * Get recommended tempo for the practice loop
     * @returns {number} Recommended BPM
     */
    getRecommendedTempo() {
        return this.suggestedTempo;
    }

    /**
     * Reset the practice loop
     */
    reset() {
        this.isActive = false;
        this.currentLoopIndex = 0;
        this.loopCount = 0;
        this.loopMeasures = [];
    }

    /**
     * Check if a measure should be included in practice
     * @param {number} measure - Measure number
     * @returns {boolean} Whether measure is in loop
     */
    shouldLoopMeasure(measure) {
        return this.isActive && this.loopMeasures.includes(measure);
    }

    /**
     * Generate practice instructions
     * @returns {string} Human-readable instructions
     */
    getInstructions() {
        if (!this.loopMeasures.length) {
            return 'No practice loop configured';
        }

        const measures = this.loopMeasures.join(', ');
        return `Practice measures ${measures} at ${this.suggestedTempo} BPM. ` +
            `Loop ${this.maxLoops} times, focusing on smooth transitions between notes.`;
    }
}

window.PracticeLoopController = PracticeLoopController;
