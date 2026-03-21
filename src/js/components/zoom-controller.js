/**
 * Zoom Controller - Handles high-resolution zoom for sheet music viewing
 * Supports zoom in/out, pan, mouse wheel, and pinch-to-zoom
 */

class ZoomController {
    constructor(container) {
        this.container = container;
        this.zoomLevel = 100;
        this.minZoom = 50;
        this.maxZoom = 200;
        this.zoomStep = 10;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.offsetX = 0;
        this.offsetY = 0;

        this.onZoomChange = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // Zoom buttons
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomResetBtn = document.getElementById('zoom-reset-btn');

        zoomInBtn?.addEventListener('click', () => this.zoomIn());
        zoomOutBtn?.addEventListener('click', () => this.zoomOut());
        zoomResetBtn?.addEventListener('click', () => this.resetZoom());

        // Mouse wheel zoom
        this.container?.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
                this.setZoom(this.zoomLevel + delta);
            }
        }, { passive: false });

        // Mouse drag panning
        this.container?.addEventListener('mousedown', (e) => {
            if (e.button === 0 && e.target === this.container) {
                this.isPanning = true;
                this.startX = e.clientX - this.offsetX;
                this.startY = e.clientY - this.offsetY;
                this.container.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.offsetX = e.clientX - this.startX;
                this.offsetY = e.clientY - this.startY;
                this.applyTransform();
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.container.style.cursor = 'grab';
            }
        });

        // Touch events for pinch-to-zoom
        this.initTouchEvents();
    }

    initTouchEvents() {
        let initialDistance = 0;
        let initialZoom = 0;

        this.container?.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = this.getTouchDistance(e.touches);
                initialZoom = this.zoomLevel;
            }
        }, { passive: true });

        this.container?.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const currentDistance = this.getTouchDistance(e.touches);
                const scale = currentDistance / initialDistance;
                const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, initialZoom * scale));
                this.setZoom(newZoom);
            }
        }, { passive: true });
    }

    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    zoomIn() {
        this.setZoom(this.zoomLevel + this.zoomStep);
    }

    zoomOut() {
        this.setZoom(this.zoomLevel - this.zoomStep);
    }

    setZoom(level) {
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, level));
        this.updateZoomDisplay();
        this.applyTransform();

        if (this.onZoomChange) {
            this.onZoomChange(this.zoomLevel);
        }
    }

    resetZoom() {
        this.zoomLevel = 100;
        this.offsetX = 0;
        this.offsetY = 0;
        this.updateZoomDisplay();
        this.applyTransform();

        if (this.onZoomChange) {
            this.onZoomChange(this.zoomLevel);
        }
    }

    updateZoomDisplay() {
        const zoomLevelEl = document.getElementById('zoom-level');
        if (zoomLevelEl) {
            zoomLevelEl.textContent = `${this.zoomLevel}%`;
        }
    }

    applyTransform() {
        if (this.container) {
            this.container.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoomLevel / 100})`;
            this.container.style.transformOrigin = 'center center';
        }
    }

    getZoomLevel() {
        return this.zoomLevel;
    }
}

window.ZoomController = ZoomController;