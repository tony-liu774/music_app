/**
 * Tests for PracticeLoopController - Smart Looping
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock PracticeLoopController for testing
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

    init({ measures, suggestedTempo, maxLoops = 5 }) {
        if (!measures || measures.length === 0) {
            return;
        }

        this.loopMeasures = measures.slice(0, 3);
        this.suggestedTempo = suggestedTempo || 80;
        this.maxLoops = maxLoops;
        this.currentLoopIndex = 0;
        this.loopCount = 0;
        this.isActive = false;
    }

    start() {
        if (!this.loopMeasures.length) {
            return;
        }

        this.isActive = true;
        this.loopCount = 0;
        this.currentLoopIndex = 0;

        this.notifyLoopChange();
    }

    stop() {
        this.isActive = false;
    }

    next() {
        if (!this.isActive) return null;

        this.currentLoopIndex++;
        this.loopCount++;

        if (this.loopCount >= this.maxLoops) {
            this.complete();
            return this.getState();
        }

        if (this.currentLoopIndex >= this.loopMeasures.length) {
            this.currentLoopIndex = 0;
        }

        this.notifyLoopChange();
        return this.getState();
    }

    completeIteration() {
        return this.next();
    }

    complete() {
        this.isActive = false;

        if (this.onComplete) {
            this.onComplete({
                totalLoops: this.loopCount,
                measures: this.loopMeasures,
                suggestedTempo: this.suggestedTempo
            });
        }
    }

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

    notifyLoopChange() {
        if (this.onLoopChange) {
            this.onLoopChange(this.getState());
        }
    }

    setOnLoopChange(callback) {
        this.onLoopChange = callback;
    }

    setOnComplete(callback) {
        this.onComplete = callback;
    }

    getLoopMeasures() {
        return [...this.loopMeasures];
    }

    getRecommendedTempo() {
        return this.suggestedTempo;
    }

    reset() {
        this.isActive = false;
        this.currentLoopIndex = 0;
        this.loopCount = 0;
        this.loopMeasures = [];
    }

    shouldLoopMeasure(measure) {
        return this.isActive && this.loopMeasures.includes(measure);
    }

    getInstructions() {
        if (!this.loopMeasures.length) {
            return 'No practice loop configured';
        }

        const measures = this.loopMeasures.join(', ');
        return `Practice measures ${measures} at ${this.suggestedTempo} BPM. ` +
            `Loop ${this.maxLoops} times, focusing on smooth transitions between notes.`;
    }
}

describe('PracticeLoopController', () => {
    let controller;

    beforeEach(() => {
        controller = new PracticeLoopController();
    });

    afterEach(() => {
        controller = null;
    });

    it('should initialize with default values', () => {
        assert.strictEqual(controller.isActive, false);
        assert.strictEqual(controller.loopMeasures.length, 0);
        assert.strictEqual(controller.currentLoopIndex, 0);
        assert.strictEqual(controller.loopCount, 0);
        assert.strictEqual(controller.maxLoops, 5);
        assert.strictEqual(controller.suggestedTempo, 80);
    });

    it('should initialize with provided values', () => {
        controller.init({
            measures: [5, 10, 15],
            suggestedTempo: 60,
            maxLoops: 10
        });

        assert.deepStrictEqual(controller.loopMeasures, [5, 10, 15]);
        assert.strictEqual(controller.suggestedTempo, 60);
        assert.strictEqual(controller.maxLoops, 10);
    });

    it('should limit measures to 3 maximum', () => {
        controller.init({
            measures: [1, 2, 3, 4, 5, 6, 7],
            suggestedTempo: 60
        });

        assert.strictEqual(controller.loopMeasures.length, 3);
    });

    it('should not initialize with empty measures', () => {
        controller.init({ measures: [] });

        assert.strictEqual(controller.loopMeasures.length, 0);
    });

    it('should start the practice loop', () => {
        controller.init({ measures: [5, 10], suggestedTempo: 70 });
        controller.start();

        assert.strictEqual(controller.isActive, true);
        assert.strictEqual(controller.loopCount, 0);
        assert.strictEqual(controller.currentLoopIndex, 0);
    });

    it('should stop the practice loop', () => {
        controller.init({ measures: [5, 10] });
        controller.start();
        controller.stop();

        assert.strictEqual(controller.isActive, false);
    });

    it('should advance to next iteration', () => {
        controller.init({ measures: [5, 10], suggestedTempo: 70, maxLoops: 3 });
        controller.start();

        const state = controller.next();

        assert.strictEqual(controller.loopCount, 1);
        assert.strictEqual(state.loopCount, 1);
    });

    it('should cycle through measures', () => {
        controller.init({ measures: [5, 10, 15], suggestedTempo: 70, maxLoops: 10 });
        controller.start();

        assert.strictEqual(controller.getState().currentMeasure, 5);

        controller.next();
        assert.strictEqual(controller.getState().currentMeasure, 10);

        controller.next();
        assert.strictEqual(controller.getState().currentMeasure, 15);

        controller.next();
        assert.strictEqual(controller.getState().currentMeasure, 5); // Wraps around
    });

    it('should complete after max loops', () => {
        let completed = false;
        let completionData = null;

        controller.setOnComplete((data) => {
            completed = true;
            completionData = data;
        });

        controller.init({ measures: [5, 10], suggestedTempo: 70, maxLoops: 2 });
        controller.start();

        controller.next(); // loopCount = 1
        controller.next(); // loopCount = 2, should complete

        assert.strictEqual(completed, true);
        assert.strictEqual(controller.isActive, false);
        assert.strictEqual(completionData.totalLoops, 2);
    });

    it('should return current state correctly', () => {
        controller.init({ measures: [5, 10], suggestedTempo: 60, maxLoops: 3 });
        controller.start();

        const state = controller.getState();

        assert.strictEqual(state.isActive, true);
        assert.strictEqual(state.currentMeasure, 5);
        assert.strictEqual(state.totalMeasures, 2);
        assert.strictEqual(state.maxLoops, 3);
        assert.strictEqual(state.suggestedTempo, 60);
        assert.strictEqual(state.progress, 0);
    });

    it('should get loop measures', () => {
        controller.init({ measures: [5, 10, 15] });

        const measures = controller.getLoopMeasures();

        assert.deepStrictEqual(measures, [5, 10, 15]);
    });

    it('should get recommended tempo', () => {
        controller.init({ measures: [5], suggestedTempo: 55 });

        assert.strictEqual(controller.getRecommendedTempo(), 55);
    });

    it('should reset correctly', () => {
        controller.init({ measures: [5, 10] });
        controller.start();
        controller.next();
        controller.next();

        controller.reset();

        assert.strictEqual(controller.isActive, false);
        assert.strictEqual(controller.currentLoopIndex, 0);
        assert.strictEqual(controller.loopCount, 0);
        assert.strictEqual(controller.loopMeasures.length, 0);
    });

    it('should check if measure should loop', () => {
        controller.init({ measures: [5, 10, 15] });

        assert.strictEqual(controller.shouldLoopMeasure(5), false); // Not active yet
        assert.strictEqual(controller.shouldLoopMeasure(10), false);

        controller.start();

        assert.strictEqual(controller.shouldLoopMeasure(5), true);
        assert.strictEqual(controller.shouldLoopMeasure(10), true);
        assert.strictEqual(controller.shouldLoopMeasure(99), false);
    });

    it('should generate instructions', () => {
        controller.init({ measures: [5, 10, 15], suggestedTempo: 70, maxLoops: 3 });

        const instructions = controller.getInstructions();

        assert.ok(instructions.includes('5, 10, 15'));
        assert.ok(instructions.includes('70'));
        assert.ok(instructions.includes('3'));
    });

    it('should call onLoopChange callback', () => {
        let callbackCalled = false;
        let receivedState = null;

        controller.setOnLoopChange((state) => {
            callbackCalled = true;
            receivedState = state;
        });

        controller.init({ measures: [5, 10] });
        controller.start();

        assert.strictEqual(callbackCalled, true);
        assert.notStrictEqual(receivedState, null);
    });
});

console.log('Running PracticeLoopController tests...');
