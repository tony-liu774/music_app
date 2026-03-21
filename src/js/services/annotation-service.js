/**
 * Annotation Service - Firebase real-time sync for score annotations
 * Falls back to localStorage for local-only mode when Firebase is not configured
 */

class AnnotationService {
    constructor() {
        // Check Firebase availability
        this.firebaseEnabled = !!(
            window.FIREBASE_CONFIG &&
            window.FIREBASE_CONFIG.databaseURL &&
            typeof firebase !== 'undefined'
        );

        this.canvas = null;
        this.scoreId = null;
        this.db = null;
        this.dbRef = null;
        this.listener = null;
        this._remoteUpdate = false; // Flag to prevent echo loops

        // Event system
        this.listeners = {};

        // Local storage mode
        this.localAnnotations = {};

        if (this.firebaseEnabled) {
            try {
                this.db = firebase.database();
            } catch (e) {
                console.warn('Firebase initialization failed, using local-only mode:', e);
                this.firebaseEnabled = false;
            }
        }

        console.log('AnnotationService initialized', {
            firebaseEnabled: this.firebaseEnabled,
            localMode: !this.firebaseEnabled
        });
    }

    sanitizeScoreId(id) {
        if (!id || typeof id !== 'string') {
            console.warn('Invalid scoreId provided');
            return 'default-score';
        }
        // Remove special characters and path traversal attempts
        return id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 100);
    }

    init(canvas, scoreId) {
        this.canvas = canvas;
        if (scoreId) {
            this.setScoreId(scoreId);
        }

        // Listen for canvas changes
        if (this.canvas && this.canvas.on) {
            this.canvas.on('change', data => {
                if (this._remoteUpdate) return;
                this.onCanvasChange(data);
            });
        }
    }

    setScoreId(id) {
        // Unsubscribe from old score
        if (this.listener) {
            this.listener();
            this.listener = null;
        }

        // Sanitize the score ID to prevent path injection
        this.scoreId = this.sanitizeScoreId(id);

        if (this.firebaseEnabled) {
            this.dbRef = this.db.ref(`annotations/${id}`);

            // Subscribe to remote changes
            this.listener = this.dbRef.on('value', snapshot => {
                if (!snapshot.exists()) return;

                const data = snapshot.val();
                const annotations = [];

                // Convert Firebase object to array
                Object.keys(data).forEach(key => {
                    const ann = data[key];
                    ann.id = key;
                    annotations.push(ann);
                });

                // Load into canvas without triggering save
                this._remoteUpdate = true;
                this.canvas.loadAnnotations(annotations);
                this._remoteUpdate = false;

                this.emit('loaded', { annotations });
            });
        } else {
            // Load from localStorage
            this.loadFromLocal();
        }
    }

    onCanvasChange(data) {
        if (!data.annotations) return;

        if (this.firebaseEnabled) {
            // Sync to Firebase
            this.saveAllToFirebase(data.annotations);
        } else {
            // Save to localStorage
            this.saveAllToLocal(data.annotations);
        }

        this.emit('syncStatus', 'synced');
    }

    saveAllToFirebase(annotations) {
        if (!this.dbRef) return;

        // Build update object for batch write
        const updates = {};

        annotations.forEach(ann => {
            const id = ann.id || Date.now() + Math.random().toString().slice(2);
            const cleanAnn = { ...ann };
            delete cleanAnn.id;
            updates[id] = cleanAnn;
        });

        this.emit('syncStatus', 'syncing');

        this.dbRef.set(updates)
            .then(() => {
                this.emit('syncStatus', 'synced');
            })
            .catch(err => {
                console.error('Firebase sync error:', err);
                this.emit('syncStatus', 'error');
            });
    }

    saveAnnotation(annotation) {
        if (this.firebaseEnabled && this.dbRef) {
            const id = annotation.id || Date.now() + Math.random().toString().slice(2);
            const cleanAnn = { ...annotation };
            delete cleanAnn.id;

            this.emit('syncStatus', 'syncing');

            this.dbRef.child(id).set(cleanAnn)
                .then(() => {
                    this.emit('syncStatus', 'synced');
                })
                .catch(err => {
                    console.error('Save annotation error:', err);
                    this.emit('syncStatus', 'error');
                });
        } else {
            this.saveAllToLocal(this.canvas.exportAnnotations());
        }
    }

    deleteAnnotation(id) {
        if (this.firebaseEnabled && this.dbRef) {
            this.emit('syncStatus', 'syncing');

            this.dbRef.child(id).remove()
                .then(() => {
                    this.emit('syncStatus', 'synced');
                })
                .catch(err => {
                    console.error('Delete annotation error:', err);
                    this.emit('syncStatus', 'error');
                });
        } else {
            delete this.localAnnotations[id];
            this.saveToLocal();
        }
    }

    clearAll() {
        if (this.firebaseEnabled && this.dbRef) {
            this.emit('syncStatus', 'syncing');

            this.dbRef.remove()
                .then(() => {
                    this.emit('syncStatus', 'synced');
                })
                .catch(err => {
                    console.error('Clear all error:', err);
                    this.emit('syncStatus', 'error');
                });
        } else {
            this.localAnnotations = {};
            localStorage.removeItem(`annotations_${this.scoreId}`);
            this.emit('syncStatus', 'synced');
        }
    }

    // Local storage mode helpers
    saveAllToLocal(annotations) {
        if (!this.scoreId) return;

        this.localAnnotations = {};
        annotations.forEach(ann => {
            this.localAnnotations[ann.id] = ann;
        });

        try {
            localStorage.setItem(
                `annotations_${this.scoreId}`,
                JSON.stringify(annotations)
            );
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded - annotations not saved');
                this.emit('syncStatus', 'error');
                this.emit('quotaExceeded', { message: 'Storage quota exceeded. Please clear some annotations.' });
            } else {
                console.error('localStorage error:', e);
                this.emit('syncStatus', 'error');
            }
        }
    }

    saveToLocal() {
        if (!this.scoreId) return;

        const annotations = Object.values(this.localAnnotations);
        try {
            localStorage.setItem(
                `annotations_${this.scoreId}`,
                JSON.stringify(annotations)
            );
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded - annotations not saved');
                this.emit('syncStatus', 'error');
                this.emit('quotaExceeded', { message: 'Storage quota exceeded. Please clear some annotations.' });
            } else {
                console.error('localStorage error:', e);
                this.emit('syncStatus', 'error');
            }
        }
    }

    loadFromLocal() {
        if (!this.scoreId) return;

        const stored = localStorage.getItem(`annotations_${this.scoreId}`);
        if (!stored) return;

        try {
            const annotations = JSON.parse(stored);
            this._remoteUpdate = true;
            this.canvas.loadAnnotations(annotations);
            this._remoteUpdate = false;

            this.localAnnotations = {};
            annotations.forEach(ann => {
                this.localAnnotations[ann.id] = ann;
            });

            this.emit('loaded', { annotations });
        } catch (e) {
            console.error('Failed to load local annotations:', e);
        }
    }

    destroy() {
        if (this.listener) {
            this.listener();
            this.listener = null;
        }
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

window.AnnotationService = AnnotationService;
