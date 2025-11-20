const dropdown = document.getElementById('webcamDropdown');
const activityRadioButtons = document.querySelectorAll('input[name="activity"]');
const toggleSwitchElement = document.getElementById('toggle-switch');
const powerSwitchElement = document.getElementById('powerSwitch');
const powerOnErrorMsgElement = document.getElementById('power-on-error-message');
let selectedDeviceId
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
                const webcamExists = webcams.some(webcam => webcam.deviceId === result.webcamId);
                if (webcamExists) {
                    dropdown.value = result.webcamId;
                } else {
                    dropdown.value = webcams[0].deviceId;
                }
            } else {
                dropdown.value = webcams[0].deviceId;
            }
            handleWebcamSelection({ target: dropdown });
        });
    }
}

function handleWebcamSelection(event) {
    selectedDeviceId = event.target.value;
    chrome.storage.local.set({ webcamId: selectedDeviceId });
    chrome.runtime.sendMessage({ type: 'webcamSelected', selectedWebcam: selectedDeviceId });
    updatePowerToggleState();
}

dropdown.addEventListener('change', handleWebcamSelection);

function updatePowerToggleState() {
    if (selectedDeviceId && currentActivity) {
        powerSwitchElement.disabled = false;
    } else {
        powerSwitchElement.disabled = true;
    }
}

toggleSwitchElement.addEventListener('click', function() {
    if (powerSwitchElement.disabled) {
        powerOnErrorMsgElement.textContent = "*Please select your webcam and activity first";
        powerOnErrorMsgElement.scrollIntoView({ behavior: 'smooth' });
    }
});

document.getElementById('powerSwitch').addEventListener('change', function() {
    if (selectedDeviceId && currentActivity) {
        const isOn = this.checked;
        this.nextElementSibling.querySelector('.toggle-text').textContent = isOn ? 'ON' : 'OFF';
        chrome.storage.local.set({ extensionIsOn: isOn });
        chrome.runtime.sendMessage({ type: 'powerButton', powerState: isOn });
    }
});

activityRadioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.checked) {
            chrome.storage.local.set({ activity: radio.value });
            currentActivity = radio.value;
            chrome.runtime.sendMessage({ type: 'activity', activity: radio.value });
            updatePowerToggleState();
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    createWebcamDropdown();

    chrome.storage.local.get(['extensionIsOn'], (result) => {
        if (result.extensionIsOn) {
            if (result.extensionIsOn === true) {
                document.getElementById('powerSwitch').checked = true;
                document.getElementById('powerText').textContent = 'ON';
            } else if (result.extensionIsOn === false) {
                document.getElementById('powerSwitch').checked = false;
                document.getElementById('powerText').textContent = 'OFF';
            }
        }
    });

    chrome.storage.local.get(['activity'], result => {
        activityRadioButtons.forEach(radio => {
            if (radio.value === result.activity) {
                radio.checked = true;
                currentActivity = radio.value;
                chrome.runtime.sendMessage({ type: 'activity', activity: radio.value });
                updatePowerToggleState();
            }
        });
    });
});
