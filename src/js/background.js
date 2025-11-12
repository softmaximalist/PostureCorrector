/*
This file opens a browser tab using capture.html which has capture.js as the src of a script tag.
It also forwards messages from popup.js to capture.js such as the webcam selected, the activity type selected, 
and the warning method selected. Lastly, this file sends a desktop notification or blur and unblur browser tabs
after receiving messages from capture.js to warn the user about their bad posture.
*/
let captureIsReady, captureTabId, currentSelectedWebcam, currentActivity, 
    firstWebcamNotSentToCapture, firstActivityNotSentToCapture;
let iconPath = chrome.runtime.getURL("src/assets/icons/bird128.png");

function initializeGlobalVariables() {
    const variablesToInit = {
        captureIsReady: false,
        captureTabId: null,
        currentSelectedWebcam: undefined,
        currentActivity: undefined,
        firstWebcamNotSentToCapture: undefined,
        firstActivityNotSentToCapture: undefined
    };

    chrome.storage.local.get(Object.keys(variablesToInit), (result) => {
        captureIsReady = result.hasOwnProperty('captureIsReady') ? result.captureIsReady : variablesToInit.captureIsReady;
        captureTabId = result.hasOwnProperty('captureTabId') ? result.captureTabId : variablesToInit.captureTabId;
        currentSelectedWebcam = result.hasOwnProperty('currentSelectedWebcam') ? result.currentSelectedWebcam : variablesToInit.currentSelectedWebcam;
        currentActivity = result.hasOwnProperty('currentActivity') ? result.currentActivity : variablesToInit.currentActivity;
        if (result.hasOwnProperty('firstWebcamNotSentToCapture')) {
            firstWebcamNotSentToCapture = result.firstWebcamNotSentToCapture;
        } else {
            firstWebcamNotSentToCapture = variablesToInit.firstWebcamNotSentToCapture;
        }
        if (result.hasOwnProperty('firstActivityNotSentToCapture')) {
            firstActivityNotSentToCapture = result.firstActivityNotSentToCapture;
        } else {
            firstActivityNotSentToCapture = variablesToInit.firstActivityNotSentToCapture;
        }

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
    } else {
        firstWebcamNotSentToCapture = true;
        chrome.storage.local.set({ firstWebcamNotSentToCapture: firstWebcamNotSentToCapture });
    }
}

function sendActivityInfoToCapture(activity) {
    currentActivity = activity;
    chrome.storage.local.set({ currentActivity: currentActivity });
    if (captureIsReady) {
        chrome.runtime.sendMessage({ type: 'activity', activity: currentActivity });
    } else {
        firstActivityNotSentToCapture = true;
        chrome.storage.local.set({ firstActivityNotSentToCapture: firstActivityNotSentToCapture });
    }
}

function setCaptureToReady() {
    captureIsReady = true;
    chrome.storage.local.set({ captureIsReady: captureIsReady });
    if (firstWebcamNotSentToCapture === true) {
        chrome.runtime.sendMessage({ type: 'webcam', selectedWebcam: currentSelectedWebcam });  
    }
    if (firstActivityNotSentToCapture === true) {
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
    const captureUrl = chrome.runtime.getURL('src/html/capture.html');
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
        'currentSelectedWebcam',
        'currentActivity',
        'firstWebcamNotSentToCapture',
        'firstActivityNotSentToCapture'
    ];

    chrome.storage.local.remove(keysToRemove, () => {
        if (chrome.runtime.lastError) {
            console.error('Error clearing storage:', chrome.runtime.lastError);
        } else {
            console.log('All specified variables removed from storage');
            captureIsReady = false;
            captureTabId = null;
            currentSelectedWebcam = null;
            currentActivity = null;
            firstWebcamNotSentToCapture = null;
            firstActivityNotSentToCapture = null;
        }
    });
}

function sendWarningNotification() {
    chrome.notifications.create('warningNotification', {
        type: 'basic',
        title: 'Bad Posture Warning',
        message: 'Bad posture has been detected for more than 5 seconds. Please correct your posture.',
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
