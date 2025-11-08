/*
This file blurs the browser tabs when bad posture is detected. It also unblurs 
the browser tabs when the user corrects their bad posture.
*/
function createBlurOverlay() {
    let overlay = document.getElementById('extension-blur-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'extension-blur-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            backdrop-filter: blur(10px);
            z-index: 2147483647;
            pointer-events: none;
        `;
        document.body.appendChild(overlay);
    }
}


function removeBlurOverlay() {
    const overlay = document.getElementById('extension-blur-overlay');
    if (overlay) overlay.remove();
}

chrome.runtime.sendMessage({action: 'contentScriptReady'});

// Also send it after a short delay to ensure it's received
setTimeout(() => {
    chrome.runtime.sendMessage({action: 'contentScriptReady'});
}, 100);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'blur') {
        createBlurOverlay();
        sendResponse({success: true});
    } else if (message.action === 'unblur') {
        removeBlurOverlay();
        sendResponse({success: true});
    } 

    return true; // Indicates that the response is sent asynchronously
});