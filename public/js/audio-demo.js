/**
 * Audio Demo - Demonstration of the AudioEngine
 * Shows waveform visualization and controls
 */

// DOM Elements
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const audioDeviceSelect = document.getElementById('audio-device');
const gainSlider = document.getElementById('gain-slider');
const gainValue = document.getElementById('gain-value');
const levelIndicator = document.getElementById('level-indicator');
const levelValue = document.getElementById('level-value');
const waveformCanvas = document.getElementById('waveform-canvas');
const statusMessage = document.getElementById('status-message');
const errorMessage = document.getElementById('error-message');

// Canvas context
const canvasCtx = waveformCanvas.getContext('2d');

// AudioEngine instance
let audioEngine = null;

// Initialize
async function init() {
    try {
        // Create AudioEngine
        audioEngine = new AudioEngine({
            fftSize: 2048,
            smoothingTimeConstant: 0.8,
            onLevelUpdate: handleLevelUpdate,
            onWaveformData: handleWaveformData,
            onError: handleError,
            onStatusChange: handleStatusChange
        });

        // Initialize audio context
        await audioEngine.initialize();

        // Populate device list
        await populateDeviceList();

        // Request permission
        await audioEngine.requestPermission();

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize: ' + error.message);
    }
}

// Populate audio device dropdown
async function populateDeviceList() {
    const devices = await audioEngine.getAudioDevices();

    audioDeviceSelect.innerHTML = '<option value="">Select a device...</option>';

    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${device.deviceId.slice(0, 8)}`;
        audioDeviceSelect.appendChild(option);
    });
}

// Handle level update
function handleLevelUpdate(level, peak) {
    // Update level meter (0-100%)
    const levelPercent = ((level + 60) / 60) * 100;
    levelIndicator.style.width = `${Math.max(0, Math.min(100, levelPercent))}%`;

    // Update level text
    levelValue.textContent = `${level.toFixed(1)} dB`;

    // Color based on level
    if (level > -6) {
        levelIndicator.style.background = 'linear-gradient(90deg, #ff4444 0%, #ff6666 100%)';
    } else if (level > -12) {
        levelIndicator.style.background = 'linear-gradient(90deg, #ffaa00 0%, #ffcc00 100%)';
    } else {
        levelIndicator.style.background = 'linear-gradient(90deg, #00ff88 0%, #00d4ff 100%)';
    }
}

// Handle waveform data for visualization
function handleWaveformData(waveformData, frequencyData) {
    drawWaveform(waveformData);
}

// Draw waveform on canvas
function drawWaveform(waveformData) {
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;

    // Clear canvas
    canvasCtx.fillStyle = '#0a0a15';
    canvasCtx.fillRect(0, 0, width, height);

    // Draw center line
    canvasCtx.strokeStyle = '#1a1a2e';
    canvasCtx.lineWidth = 1;
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, height / 2);
    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();

    // Draw waveform
    canvasCtx.strokeStyle = '#00d4ff';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();

    const sliceWidth = width / waveformData.length;
    let x = 0;

    for (let i = 0; i < waveformData.length; i++) {
        const v = waveformData[i];
        const y = (v * height / 2) + (height / 2);

        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    canvasCtx.stroke();

    // Add glow effect
    canvasCtx.shadowBlur = 10;
    canvasCtx.shadowColor = '#00d4ff';
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0;
}

// Handle errors
function handleError(message, error) {
    showError(message + ': ' + (error.message || error));
}

// Handle status changes
function handleStatusChange(message) {
    statusMessage.textContent = message;
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('visible');
}

// Event Listeners
startBtn.addEventListener('click', async () => {
    try {
        const deviceId = audioDeviceSelect.value || null;
        await audioEngine.start(deviceId);

        startBtn.disabled = true;
        stopBtn.disabled = false;
        audioDeviceSelect.disabled = true;
    } catch (error) {
        showError('Failed to start: ' + error.message);
    }
});

stopBtn.addEventListener('click', () => {
    audioEngine.stop();

    startBtn.disabled = false;
    stopBtn.disabled = true;
    audioDeviceSelect.disabled = false;
});

gainSlider.addEventListener('input', (e) => {
    const gain = parseFloat(e.target.value);
    audioEngine.setGain(gain);
    gainValue.textContent = gain.toFixed(1);
});

audioDeviceSelect.addEventListener('change', async (e) => {
    if (audioEngine.isActive()) {
        await audioEngine.switchDevice(e.target.value);
    }
});

// Initialize on load
init();
