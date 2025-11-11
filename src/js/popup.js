const dropdown = document.getElementById('webcamDropdown');
const saveGoodPostureButton = document.getElementById("goodPosture");
const activityRadioButtons = document.querySelectorAll('input[name="activity"]');
const saveButtonMsgElement = document.getElementById('saveButtonMessage');
let webcamRunning = false;
let currentProcessingSpeed;
let currentActivity;

async function getAllWebcams() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    return videoDevices;
}

async function createWebcamDropdown() {
    const webcams = await getAllWebcams();
    dropdown.innerHTML = ''; // Clear existing options
    
    webcams.forEach((webcam, index) => {
        const option = document.createElement('option');
        option.value = webcam.deviceId;
        option.text = webcam.label || `Camera ${index + 1}`;
        dropdown.appendChild(option);
    });

    // If webcams are detected, select the first one by default
    if (webcams.length > 0) {
        chrome.storage.local.get(['webcamId'], (result) => {
            if (result.webcamId) {
                dropdown.value = result.webcamId;
            } else {
                dropdown.value = webcams[0].deviceId;
            }
            handleWebcamSelection({ target: dropdown });
        });

    }
}

function handleWebcamSelection(event) {
    // selectedDeviceId = dropdown.value;
    const selectedDeviceId = event.target.value;
    chrome.storage.local.set({ webcamId: selectedDeviceId });
    chrome.runtime.sendMessage({ type: 'webcamSelected', selectedWebcam: selectedDeviceId });
}

dropdown.addEventListener('change', handleWebcamSelection);

document.getElementById('powerSwitch').addEventListener('change', function() {
    const isOn = this.checked;
    webcamRunning = isOn;
    this.nextElementSibling.querySelector('.toggle-text').textContent = isOn ? 'ON' : 'OFF';
    chrome.storage.local.set({ extensionIsOn: isOn });
    chrome.runtime.sendMessage({ type: 'powerButton', powerState: isOn });
});

activityRadioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.checked) {
            chrome.storage.local.set({ activity: radio.value });
            currentActivity = radio.value;
            chrome.runtime.sendMessage({ type: 'activity', activity: radio.value });
        }
    });
});

saveGoodPostureButton.addEventListener('click', () => {
    if (webcamRunning && currentProcessingSpeed && currentActivity) {
        chrome.runtime.sendMessage({ type: 'saveGoodPosture' });
        if (currentProcessingSpeed === 'fast') {
            saveButtonMsgElement.textContent = '*Please maintain your best posture for 1 second to save it.';
        } else if (currentProcessingSpeed === 'medium') {
            saveButtonMsgElement.textContent = '*Please maintain your best posture for 2.5 seconds to save it.';
        } else if (currentProcessingSpeed === 'slow') {
            saveButtonMsgElement.textContent = '*Please maintain your best posture for 5 seconds to save it.';
        }
        saveButtonMsgElement.scrollIntoView({ behavior: 'smooth' });
    } else {
        saveButtonMsgElement.textContent = "*Please turn on the extension and select your frame processing " + 
        "speed and activity before you save your best posture.";
        saveButtonMsgElement.scrollIntoView({ behavior: 'smooth' });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    createWebcamDropdown();

    chrome.storage.local.get(['extensionIsOn'], (result) => {
        if (result.extensionIsOn) {
            if (result.extensionIsOn === true) {
                document.getElementById('powerSwitch').checked = true;
                document.getElementById('powerText').textContent = 'ON';
                webcamRunning = true;
            } else if (result.extensionIsOn === false) {
                document.getElementById('powerSwitch').checked = false;
                document.getElementById('powerText').textContent = 'OFF';
                webcamRunning = false;
            }
        }
    });

    chrome.storage.local.get(['activity'], result => {
        activityRadioButtons.forEach(radio => {
            if (radio.value === result.activity) {
                radio.checked = true;
                currentActivity = radio.value;
                chrome.runtime.sendMessage({ type: 'activity', activity: radio.value });
            }
        });
    });
});