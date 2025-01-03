/*
This file opens a browser tab using capture.html which has capture.js as the src of a script tag.
It also forwards messages from popup.js to capture.js such as the webcam selected, the activity type selected, 
and the warning method selected. Lastly, this file sends a desktop notification or blur and unblur browser tabs
after receiving messages from capture.js to warn the user about their bad posture.
*/
let captureIsReady, captureTabId, currentSelectedWebcam, currentProcessingSpeed, currentWarningMethod, currentActivity, 
    firstWebcamNotSentToCapture, firstProcessingSpeedNotSentToCapture, firstWarningMethodNotSentToCapture, 
    firstActivityNotSentToCapture, isBlurred;
const readyTabs = new Set();


function initializeGlobalVariables() {
    const variablesToInit = {
        captureIsReady: false,
        captureTabId: null,
        currentSelectedWebcam: undefined,
        currentProcessingSpeed: undefined,
        currentWarningMethod: undefined,
        currentActivity: undefined,
        firstWebcamNotSentToCapture: undefined,
        firstProcessingSpeedNotSentToCapture: undefined,
        firstWarningMethodNotSentToSandbox: undefined,
        firstActivityNotSentToCapture: undefined,
        isBlurred: false
    };

    chrome.storage.local.get(Object.keys(variablesToInit), (result) => {
        captureIsReady = result.hasOwnProperty('captureIsReady') ? result.captureIsReady : variablesToInit.captureIsReady;
        captureTabId = result.hasOwnProperty('captureTabId') ? result.captureTabId : variablesToInit.captureTabId;
        currentSelectedWebcam = result.hasOwnProperty('currentSelectedWebcam') ? result.currentSelectedWebcam : variablesToInit.currentSelectedWebcam;
        currentProcessingSpeed = result.hasOwnProperty('currentProcessingSpeed') ? result.currentProcessingSpeed : variablesToInit.currentProcessingSpeed;
        currentWarningMethod = result.hasOwnProperty('currentWarningMethod') ? result.currentWarningMethod : variablesToInit.currentWarningMethod;
        currentActivity = result.hasOwnProperty('currentActivity') ? result.currentActivity : variablesToInit.currentActivity;
        if (result.hasOwnProperty('firstWebcamNotSentToCapture')) {
            firstWebcamNotSentToCapture = result.firstWebcamNotSentToCapture;
        } else {
            firstWebcamNotSentToCapture = variablesToInit.firstWebcamNotSentToCapture;
        }
        if (result.hasOwnProperty('firstProcessingSpeedNotSentToCapture')) {
            firstProcessingSpeedNotSentToCapture = result.firstProcessingSpeedNotSentToCapture;
        } else {
            firstProcessingSpeedNotSentToCapture = variablesToInit.firstProcessingSpeedNotSentToCapture;
        }
        if (result.hasOwnProperty('firstWarningMethodNotSentToCapture')) {
            firstWarningMethodNotSentToCapture = result.firstWarningMethodNotSentToCapture;
        } else {
            firstWarningMethodNotSentToCapture = variablesToInit.firstWarningMethodNotSentToCapture;
        }
        if (result.hasOwnProperty('firstActivityNotSentToCapture')) {
            firstActivityNotSentToCapture = result.firstActivityNotSentToCapture;
        } else {
            firstActivityNotSentToCapture = variablesToInit.firstActivityNotSentToCapture;
        }
        isBlurred = result.hasOwnProperty('isBlurred') ? result.isBlurred : variablesToInit.isBlurred;

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
    if (message.type === 'webcamSelected' && message.selectedWebcam !== currentSelectedWebcam) {
        sendWebcamInfoToCapture(message.selectedWebcam);
    } else if (message.type === 'powerButton') {
        if (message.powerState === false) {
            chrome.runtime.sendMessage({ type: 'closeCaptureTab' });
        } else {
            openCaptureTab();
        }
    } else if (message.type === 'sendNotification') {
        sendWarningNotification();
    } else if (message.type === "blurScreen") {
        setBlurState(true);
    } else if (message.type === 'unblurScreen') {
        setBlurState(false);
    } else if (message.type === 'processingSpeed' && message.processingSpeed !== currentProcessingSpeed) {
        sendSpeedInfoToCapture(message.processingSpeed);
    } else if (message.type === 'warningMethod' && message.warningMethod !== currentWarningMethod) {
        sendWarningInfoToCapture(message.warningMethod);
    } else if (message.type === 'activity' && message.activity !== currentActivity) {
        sendActivityInfoToCapture(message.activity);
    } else if (message.type === 'captureIsReady') {
        setCaptureToReady();
    } else if (message.type === 'captureIsReadyToClose') {
        if (isBlurred) {
            setBlurState(false);
        }
        closeCaptureTab();
    } else if (message.action === 'contentScriptReady') {
        // readyTabs.add(sender.tab.id);
        if (isBlurred) {
            applyBlurToTab(sender.tab.id, true)
        }
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


function sendSpeedInfoToCapture(processingSpeed) {
    currentProcessingSpeed = processingSpeed;
    chrome.storage.local.set({ currentProcessingSpeed: currentProcessingSpeed });
    if (captureIsReady) {
        chrome.runtime.sendMessage({ type: 'processingSpeed', processingSpeed: currentProcessingSpeed });
    } else {
        firstProcessingSpeedNotSentToCapture = true;
        chrome.storage.local.set({ firstProcessingSpeedNotSentToCapture: firstProcessingSpeedNotSentToCapture });
    }
}


function sendWarningInfoToCapture(warningMethod) {
    currentWarningMethod = warningMethod;
    chrome.storage.local.set({ currentWarningMethod: currentWarningMethod });
    if (captureIsReady) {
        chrome.runtime.sendMessage({ type: 'warningMethod', warningMethod: currentWarningMethod });
    } else {
        firstWarningMethodNotSentToCapture = true;
        chrome.storage.local.set({ firstWarningMethodNotSentToCapture: firstWarningMethodNotSentToCapture });
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
    if (firstProcessingSpeedNotSentToCapture === true) {
        chrome.runtime.sendMessage({ type: 'processingSpeed', processingSpeed: currentProcessingSpeed });
    }
    if (firstWarningMethodNotSentToCapture === true) {
        chrome.runtime.sendMessage({ type: 'warningMethod', warningMethod: currentWarningMethod });
    }
    if (firstActivityNotSentToCapture === true) {
        chrome.runtime.sendMessage({ type: 'activity', activity: currentActivity });
    }
}


chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (tabId === captureTabId) {
        if (isBlurred) {
            setBlurState(false);
        }
        resetVariables();
        chrome.storage.local.set({ extensionIsOn: false });
    }
});


function openCaptureTab() {
    chrome.windows.getCurrent((window) => {
        chrome.tabs.create({ url: 'capture.html', active: false }, (tab) => {
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
        'currentProcessingSpeed',
        'currentWarningMethod',
        'currentActivity',
        'firstWebcamNotSentToCapture',
        'firstProcessingSpeedNotSentToCapture',
        'firstWarningMethodNotSentToSandbox',
        'firstActivityNotSentToCapture',
        'isBlurred'
    ];

    chrome.storage.local.remove(keysToRemove, () => {
        if (chrome.runtime.lastError) {
            console.error('Error clearing storage:', chrome.runtime.lastError);
        } else {
            console.log('All specified variables removed from storage');
            captureIsReady = false;
            captureTabId = null;
            currentSelectedWebcam = null;
            currentProcessingSpeed = null;
            currentWarningMethod = null;
            currentActivity = null;
            firstWebcamNotSentToCapture = null;
            firstProcessingSpeedNotSentToCapture = null;
            firstWarningMethodNotSentToCapture = null;
            firstActivityNotSentToCapture = null;
            isBlurred = false;
        }
    });
}


function sendWarningNotification() {
    chrome.notifications.create('warningNotification', {
        type: 'basic',
        title: 'Bad Posture Warning',
        message: 'Bad posture has been detected for more than 5 seconds. Please correct your posture.',
        priority: 2,
        iconUrl: 'icons/bird128.png'
    });
}


function sendErrorOccuredNotification() {
    chrome.notifications.create('warningNotification', {
        type: 'basic',
        title: 'PostureCorrector: Error occured',
        message: "An error has occured while processing the video frames. \
         Please wait for the extension to fix the problem or restart the PostureCorrector extension.",
        priority: 2,
        iconUrl: 'icons/bird128.png'
    });
}


function sendErrorResolvedNotification() {
    chrome.notifications.create('warningNotification', {
        type: 'basic',
        title: 'PostureCorrector: Error resolved',
        message: "PostureCorrector has resolved the error that occured earlier. You can continue using the extensin as usual.",
        priority: 2,
        iconUrl: 'icons/bird128.png'
    });
}


function setBlurState(blur) {
    isBlurred = blur;
    chrome.storage.local.set({ isBlurred: isBlurred });
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            applyBlurToTab(tab.id, tab.title, blur);
            // ensureContentScriptAndApplyBlur(tab.id, tab.title, blur);
        });
    });
}


function applyBlurToTab(tabId, tabTitle, blur) {
    chrome.tabs.sendMessage(tabId, { action: blur ? 'blur' : 'unblur' })
        .catch(() => {
            // If there's an error, inject the content script and try again
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }).then(() => {
                // After injection, wait a bit and try to send the message again
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: blur ? 'blur' : 'unblur' })
                        .catch(error => console.log(`Error sending message to tab ${tabTitle} after injection:`, error));
                }, 100);
            }).catch(error => console.log(`Error injecting script into tab ${tabTitle}:`, error));
        });
}


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && isBlurred) {
        applyBlurToTab(tabId, true);
    }
});


chrome.runtime.onStartup.addListener(() => {
    if (isBlurred) {
        setBlurState(true);
    }
});
