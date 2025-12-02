/*
    PostureCorrector - A lightweight browser extension that detects slouching in real-time.
    Copyright (C) 2025 Softmaximalist
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const dropdown = document.getElementById('webcamDropdown');
const activityRadioButtons = document.querySelectorAll('input[name="activity"]');
const toggleSwitchElement = document.getElementById('toggle-switch');
const powerSwitchElement = document.getElementById('powerSwitch');
const powerOnErrorMsgElement = document.getElementById('power-on-error-message');
let selectedDeviceId
let currentActivity;

async function createWebcamDropdown() {
    // Get devices. If camera permission is not granted, labels will be empty strings "".
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    dropdown.innerHTML = ''; // Clear existing options
    
    // Check if the extension have camera permission
    const hasPermission = videoDevices.length > 0 && videoDevices[0].label !== '';

    if (!hasPermission) {
        // Camera permission not granted yet
        // Create a dummy option so the user can still proceed
        const option = document.createElement('option');
        option.value = 'default'; 
        option.text = "Default Camera (Permission required)";
        dropdown.appendChild(option);
        
        // Treat 'default' as a valid selection to enable the UI
        dropdown.value = 'default';
        handleWebcamSelection({ target: dropdown });
        return; 
    }

    // If camera permission has been granted, proceed as usual
    if (videoDevices.length > 0) {
        videoDevices.forEach((webcam, index) => {
            const option = document.createElement('option');
            option.value = webcam.deviceId;
            option.text = webcam.label || `Camera ${index + 1}`;
            dropdown.appendChild(option);
        });

        // Load saved selection or default to first
        chrome.storage.local.get(['webcamId'], (result) => {
            if (result.webcamId) {
                const webcamExists = videoDevices.some(webcam => webcam.deviceId === result.webcamId);
                dropdown.value = webcamExists ? result.webcamId : videoDevices[0].deviceId;
            } else {
                dropdown.value = videoDevices[0].deviceId;
            }
            handleWebcamSelection({ target: dropdown });
        });
    } else {
        // Edge case: Permission granted, but NO cameras connected
        const option = document.createElement('option');
        option.text = "No cameras found";
        dropdown.appendChild(option);
        // Disable start if no hardware
        selectedDeviceId = null;
        updatePowerToggleState();
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
