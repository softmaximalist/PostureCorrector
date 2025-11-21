const speedRadioButtons = document.querySelectorAll('input[name="frameProcessingSpeed"]');
// Advanced Configuration
const pitchThresholdSlider = document.getElementById('pitchAngleThreshold');
const distanceThresholdSlider = document.getElementById('distanceThreshold');
const pitchThresholdValue = document.getElementById('pitchAngleThresholdValue');
const distanceThresholdValue = document.getElementById('distanceThresholdValue');
const resetButton = document.getElementById('resetButton');
let processingSpeedSelected = false;
const DEFAULT_PROCESSING_SPEED = 1000;
const DEFAULT_PITCH_THRESHOLD = -10;
const DEFAULT_DISTANCE_THRESHOLD = 10;

// Load saved processing speed
chrome.storage.local.get(['processingSpeed'], result => {
    speedRadioButtons.forEach(radio => {
        if (parseInt(radio.value) === result.processingSpeed) {
            radio.checked = true;
            processingSpeedSelected = true;
        }
    });
    
    // There is no saved/selected value
    if (!processingSpeedSelected) {
        speedRadioButtons.forEach(radio => {
            if (parseInt(radio.value) === DEFAULT_PROCESSING_SPEED) {
                radio.checked = true;
                processingSpeedSelected = true;
                chrome.storage.local.set({ processingSpeed: DEFAULT_PROCESSING_SPEED });
            }
        }); 
    }
});

// Save processing speed on change
speedRadioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.checked) {
            const processingSpeedInt = parseInt(radio.value);
            chrome.storage.local.set({ processingSpeed: processingSpeedInt });
            chrome.runtime.sendMessage({ type: 'processingSpeed', processingSpeed: processingSpeedInt });
        }
    });
});

// Load saved thresholds
chrome.storage.local.get(['pitchAngleThreshold', 'distanceThreshold'], result => {
    if (result.pitchAngleThreshold) {
        pitchThresholdSlider.value = result.pitchAngleThreshold;
        pitchThresholdValue.textContent = result.pitchAngleThreshold;
    }
    if (result.distanceThreshold) {
        distanceThresholdSlider.value = result.distanceThreshold;
        distanceThresholdValue.textContent = result.distanceThreshold;
    }
});

// Update value display and save on slider change
pitchThresholdSlider.addEventListener('input', () => {
    pitchThresholdValue.textContent = pitchThresholdSlider.value;
    chrome.storage.local.set({ pitchAngleThreshold: parseInt(pitchThresholdSlider.value) });
    chrome.runtime.sendMessage({ type: 'pitchAngleThreshold', value: parseInt(pitchThresholdSlider.value) });
});

distanceThresholdSlider.addEventListener('input', () => {
    distanceThresholdValue.textContent = distanceThresholdSlider.value;
    chrome.storage.local.set({ distanceThreshold: parseInt(distanceThresholdSlider.value) });
    chrome.runtime.sendMessage({ type: 'distanceThreshold', value: parseInt(distanceThresholdSlider.value) });
});

// Reset to default
resetButton.addEventListener('click', () => {
    pitchThresholdSlider.value = DEFAULT_PITCH_THRESHOLD;
    distanceThresholdSlider.value = DEFAULT_DISTANCE_THRESHOLD;
    pitchThresholdValue.textContent = DEFAULT_PITCH_THRESHOLD;
    distanceThresholdValue.textContent = DEFAULT_DISTANCE_THRESHOLD;
    
    chrome.storage.local.set({ 
        pitchAngleThreshold: DEFAULT_PITCH_THRESHOLD, 
        distanceThreshold: DEFAULT_DISTANCE_THRESHOLD 
    });
    
    chrome.runtime.sendMessage({ type: 'thresholdsReset' });
});