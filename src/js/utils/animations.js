/**
 * Animations - Animation utilities for UI elements
 */

const Animations = {
    /**
     * Fade in an element
     */
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';

        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const opacity = Math.min(progress / duration, 1);

            element.style.opacity = opacity;

            if (progress < duration) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    },

    /**
     * Fade out an element
     */
    fadeOut(element, duration = 300) {
        const startOpacity = parseFloat(getComputedStyle(element).opacity);

        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const opacity = startOpacity * (1 - progress / duration);

            element.style.opacity = Math.max(0, opacity);

            if (progress < duration) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        };

        requestAnimationFrame(animate);
    },

    /**
     * Slide in from direction
     */
    slideIn(element, direction = 'up', duration = 300) {
        const transforms = {
            up: 'translateY(20px)',
            down: 'translateY(-20px)',
            left: 'translateX(20px)',
            right: 'translateX(-20px)'
        };

        element.style.opacity = '0';
        element.style.transform = transforms[direction];
        element.style.display = 'block';
        element.style.transition = `opacity ${duration}ms, transform ${duration}ms`;

        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translate(0)';
        });
    },

    /**
     * Animate number counting
     */
    countNumber(element, start, end, duration = 1000, suffix = '') {
        let startTime = null;
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            const current = Math.round(start + (end - start) * this.easeOutCubic(progress));
            element.textContent = current + suffix;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    },

    /**
     * Easing function
     */
    easeOutCubic(x) {
        return 1 - Math.pow(1 - x, 3);
    },

    /**
     * Check if user prefers reduced motion
     */
    shouldReduceMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
};

// Export
window.Animations = Animations;