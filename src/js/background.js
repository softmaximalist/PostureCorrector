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

let captureIsReady, captureTabId, currentSelectedWebcam, currentActivity;
let iconPath = chrome.runtime.getURL("assets/icons/icon128.png");

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({
            url: "https://poscorrector.netlify.app/#instructions",
            active: true
        })
    } else if (details.reason === 'update') {
        chrome.tabs.create({
            url: "https://poscorrector.netlify.app/release-notes/",
            active: true
        })
    }
});

function initializeGlobalVariables() {
    const variablesToInit = {
        captureIsReady: false,
        captureTabId: null,
        currentSelectedWebcam: undefined,
        currentActivity: undefined,
    };

    chrome.storage.local.get(Object.keys(variablesToInit), (result) => {
        captureIsReady = result.hasOwnProperty('captureIsReady') ? result.captureIsReady : variablesToInit.captureIsReady;
        captureTabId = result.hasOwnProperty('captureTabId') ? result.captureTabId : variablesToInit.captureTabId;
        currentSelectedWebcam = result.hasOwnProperty('currentSelectedWebcam') ? result.currentSelectedWebcam : variablesToInit.currentSelectedWebcam;
        currentActivity = result.hasOwnProperty('currentActivity') ? result.currentActivity : variablesToInit.currentActivity;

        // Special handling for captureTabId
        if (captureTabId !== null) {
            chrome.tabs.get(captureTabId, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error(`Tab ${captureTabId} no longer exists. Resetting.`);
                    captureTabId = null;
                    chrome.storage.local.remove('captureTabId');
                } else {
                    console.log(`[${new Date()}] Verified tab ${captureTabId} still exists.`);
                }
            });
        }
    });
}

initializeGlobalVariables();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'powerButton') {
        if (message.powerState === false) {
            chrome.runtime.sendMessage({ type: 'prepareCaptureTabClosing' });
        } else {
            openCaptureTab();
        }
    } else if (message.type === 'warnUser') {
        sendWarningNotification();
    } else if (message.type === 'webcamSelected' && message.selectedWebcam !== currentSelectedWebcam) {
        sendWebcamInfoToCapture(message.selectedWebcam); 
    } else if (message.type === 'activity' && message.activity !== currentActivity) {
        sendActivityInfoToCapture(message.activity);
    } else if (message.type === 'captureIsReady') {
        setCaptureToReady();
    } else if (message.type === 'captureIsReadyToClose') {
        closeCaptureTab();
    } else if (message.type === 'webglContextLost') {
        sendErrorOccuredNotification();
    } else if (message.type === 'webglContextRestored') {
        sendErrorResolvedNotification();
    }
});

function sendWebcamInfoToCapture(webcamId) {
    currentSelectedWebcam = webcamId;
    chrome.storage.local.set({ currentSelectedWebcam: currentSelectedWebcam });
    if (captureIsReady) {
        chrome.runtime.sendMessage({ type: 'webcam', selectedWebcam: currentSelectedWebcam });
    }
}

function sendActivityInfoToCapture(activity) {
    currentActivity = activity;
    chrome.storage.local.set({ currentActivity: currentActivity });
    if (captureIsReady) {
        chrome.runtime.sendMessage({ type: 'activity', activity: currentActivity });
    }
}

function setCaptureToReady() {
    captureIsReady = true;
    chrome.storage.local.set({ captureIsReady: captureIsReady });
    if (currentSelectedWebcam) {
        chrome.runtime.sendMessage({ type: 'webcam', selectedWebcam: currentSelectedWebcam });  
    }
    if (currentActivity) {
        chrome.runtime.sendMessage({ type: 'activity', activity: currentActivity });
    }
}

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (tabId === captureTabId) {
        resetVariables();
        chrome.storage.local.set({ extensionIsOn: false });
    }
});

function openCaptureTab() {
    // Use chrome.runtime.getURL to get the full extension URL from the root
    const captureUrl = chrome.runtime.getURL('html/capture.html');
    chrome.windows.getCurrent((window) => {
        chrome.tabs.create({ url: captureUrl, active: true }, (tab) => {
            try {
                captureTabId = tab.id;
                chrome.storage.local.set({ captureTabId: captureTabId });
            } catch (error) {
                console.error(error);
            }
        });
    });
}

function closeCaptureTab() {
    if (captureTabId) {
        chrome.tabs.remove(captureTabId);
        resetVariables();
    }
}

function resetVariables() {
    const keysToRemove = [
        'captureIsReady',
        'captureTabId',
    ];

    chrome.storage.local.remove(keysToRemove, () => {
        if (chrome.runtime.lastError) {
            console.error('Error clearing storage:', chrome.runtime.lastError);
        } else {
            console.log('All specified variables removed from storage');
            captureIsReady = false;
            captureTabId = null;
        }
    });
}

function sendWarningNotification() {
    chrome.notifications.create('warningNotification', {
        type: 'basic',
        title: 'PostureCorrector: Warning',
        message: 'Please correct your posture.',
        priority: 2,
        iconUrl: iconPath
    });
}

function sendErrorOccuredNotification() {
    chrome.notifications.create('warningNotification', {
        type: 'basic',
        title: 'PostureCorrector: Error occured',
        message: "An error has occured while processing the video frames. \
         Please wait for the extension to fix the problem or restart the PostureCorrector extension.",
        priority: 2,
        iconUrl: iconPath
    });
}

function sendErrorResolvedNotification() {
    chrome.notifications.create('warningNotification', {
        type: 'basic',
        title: 'PostureCorrector: Error resolved',
        message: "PostureCorrector has resolved the error that occured earlier. You can continue using the extensin as usual.",
        priority: 2,
        iconUrl: iconPath
    });
}
