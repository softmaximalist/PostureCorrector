const speedRadioButtons = document.querySelectorAll('input[name="frameProcessingSpeed"]');

// Load saved processing speed
chrome.storage.local.get(['processingSpeed'], result => {
    speedRadioButtons.forEach(radio => {
        if (radio.value === result.processingSpeed) {
            radio.checked = true;
        }
    });
});

// Save processing speed on change
speedRadioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.checked) {
            chrome.storage.local.set({ processingSpeed: radio.value });
            chrome.runtime.sendMessage({ type: 'processingSpeed', processingSpeed: radio.value });
        }
    });
});