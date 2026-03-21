/**
 * Performance Optimizer - Utilities for canvas rendering, debouncing, and lazy loading
 */

class PerformanceOptimizer {
    constructor() {
        this.animationFrameId = null;
        this.pendingCallbacks = new Map();
        this.throttledFunctions = new Map();
        this.lazyLoadObserver = null;
    }

    /**
     * Debounce function - delay execution until after wait ms of inactivity
     */
    static debounce(func, wait = 250, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const context = this;
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    /**
     * Throttle function - ensure function runs at most once per wait ms
     */
    static throttle(func, wait = 250) {
        let previous = 0;
        return function executedFunction(...args) {
            const now = Date.now();
            const remaining = wait - (now - previous);
            if (remaining <= 0 || remaining > wait) {
                previous = now;
                func.apply(this, args);
            }
        };
    }

    /**
     * Create a debounced animation frame request
     * Optimizes cursor movement rendering
     */
    createAnimatedCallback(callback) {
        let frameId = null;
        let lastArgs = null;

        return (...args) => {
            lastArgs = args;

            if (frameId === null) {
                frameId = requestAnimationFrame(() => {
                    callback(...lastArgs);
                    frameId = null;
                });
            }
        };
    }

    /**
     * Batch DOM updates to minimize reflows
     */
    batchDOMUpdates(updates) {
        requestAnimationFrame(() => {
            updates.forEach(update => update());
        });
    }

    /**
     * Lazy load images using Intersection Observer
     */
    initLazyLoading(containerSelector = '.library-grid') {
        if (!('IntersectionObserver' in window)) {
            // Fallback for older browsers
            document.querySelectorAll('img[data-src]').forEach(img => {
                img.src = img.dataset.src;
            });
            return;
        }

        const options = {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        };

        this.lazyLoadObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        img.classList.add('lazy-loaded');
                    }
                    observer.unobserve(img);
                }
            });
        }, options);

        // Observe all images with data-src
        document.querySelectorAll('img[data-src]').forEach(img => {
            this.lazyLoadObserver?.observe(img);
        });
    }

    /**
     * Lazy load library thumbnails
     */
    observeLibraryThumbnails() {
        const cards = document.querySelectorAll('.library-card-thumbnail');

        cards.forEach(card => {
            if (card.dataset.scoreId) {
                // Mark as lazy-loadable
                card.classList.add('lazy-thumbnail');
            }
        });
    }

    /**
     * Optimize canvas rendering for cursor movement
     * Uses requestAnimationFrame for smooth 60fps
     */
    optimizeCanvasCursor(canvas, updateFn) {
        let isRunning = false;
        let lastPosition = 0;

        const render = () => {
            if (!isRunning) return;

            updateFn(lastPosition);
            requestAnimationFrame(render);
        };

        return {
            start: () => {
                isRunning = true;
                render();
            },
            stop: () => {
                isRunning = false;
            },
            update: (position) => {
                lastPosition = position;
            }
        };
    }

    /**
     * Debounced rhythm analysis calculation
     * Prevents excessive calculations during fast playing
     */
    createDebouncedRhythmAnalyzer(originalFn, delay = 50) {
        let debounceTimer = null;

        return (...args) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                originalFn(...args);
            }, delay);
        };
    }

    /**
     * Virtual list for large libraries
     * Only renders visible items
     */
    createVirtualList(container, itemHeight, renderFn) {
        let scrollTop = 0;
        let containerHeight = 0;
        let items = [];
        let visibleStart = 0;
        let visibleEnd = 0;

        const BUFFER = 5; // Extra items to render above/below

        const measure = () => {
            const rect = container.getBoundingClientRect();
            scrollTop = container.scrollTop;
            containerHeight = rect.height;

            visibleStart = Math.max(0, Math.floor(scrollTop / itemHeight) - BUFFER);
            visibleEnd = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + BUFFER);
        };

        const render = () => {
            measure();
            container.innerHTML = '';

            for (let i = visibleStart; i < visibleEnd; i++) {
                const item = document.createElement('div');
                item.style.position = 'absolute';
                item.style.top = `${i * itemHeight}px`;
                item.style.height = `${itemHeight}px`;
                item.style.width = '100%';
                item.appendChild(renderFn(items[i], i));
                container.appendChild(item);
            }

            container.style.height = `${items.length * itemHeight}px`;
        };

        container.addEventListener('scroll', PerformanceOptimizer.throttle(render, 16));

        return {
            setItems: (newItems) => {
                items = newItems;
                render();
            },
            refresh: render
        };
    }

    /**
     * Memory-efficient event listener cleanup
     */
    createCleanup() {
        const cleanups = [];

        return {
            add: (cleanupFn) => {
                cleanups.push(cleanupFn);
            },
            execute: () => {
                cleanups.forEach(fn => fn());
                cleanups.length = 0;
            }
        };
    }

    /**
     * Preload images for smoother UX
     */
    preloadImages(urls) {
        urls.forEach(url => {
            const img = new Image();
            img.src = url;
        });
    }

    /**
     * Optimize CSS transitions
     */
    optimizeTransitions(element, property, enable = true) {
        if (enable) {
            element.style.willChange = property;
        } else {
            element.style.willChange = 'auto';
        }
    }
}

window.PerformanceOptimizer = PerformanceOptimizer;
