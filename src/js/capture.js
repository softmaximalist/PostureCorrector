/*
This file is mainly used to obtain the webcam stream, capture and send webcam video frames 
to sandbox.js for processing. It also receives data for each frame sent. Using these data sent
by sandbox.js, this file tracks and collects statistics such as bad posture percentage per day, 
highest bad posture percentage, lowest bad posture percentage, averge bad posture percentage
per each 3-hour time windows, and average bad posture percentage per each activity. It also sends
messages to background.js so that background.js can blur user's browser tabs or send desktop 
notifications to warn their bad posture. 
*/
let imageCapture;
let videoTrack;
let webcamRunning = false;
let sandboxIsReady = false;
const videoElement = document.getElementById('webcam');
const pitchElement = document.getElementById('pitch');
const distanceElement = document.getElementById('distance');
const timeElement = document.getElementById('time');
const webglErrorElement = document.getElementById('webgl-error');
const sandboxElement = document.getElementById('sandboxFrame');
let canvas, ctx;
let consecBadPosDur = 0;
let prevActivityUpdateConsecBadPosDur = 0; 
let prevTimeWindowUpdateConsecBadPosDur = 0; 
let currentTimeWindow;
let lastTimeWindowDate;
let cumulativeTimeWindowBadPosDur = 0;
const minutesUntilNextUpdate = 10;
let timewindowTimeoutId;
let longestGoodDurationStart;
let currentProcessingSpeed = 1000;
let currentActivity;
let cumulativeActivityBadPostDur = 0;
let currentActivityTimestamp;
let startTimestamp;
let data;
let currentSelectedWebcam;
let buffer, array;
let domContentLoaded = false;
let sandboxLoaded = false;
let goodPostureSaved = false;
let width, height;
let sandboxSharedBufferReady = false;
let firstStatsUpdate = true;
let captureInterval;

document.addEventListener('DOMContentLoaded', function() {
    domContentLoaded = true;
    
    // Load processing speed if there is saved data
    chrome.storage.local.get(['processingSpeed'], result => {
        if (result.processingSpeed) {
            currentProcessingSpeed = computeProcessingSpeedInMilliseconds(result.processingSpeed);
        }
    });
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'webcam' && message.selectedWebcam !== currentSelectedWebcam) {
            setSelectedWebcamAndStartWebcam(message.selectedWebcam);
        } else if (message.type === 'saveGoodPosture') {
            if (sandboxIsReady) {
                sandboxElement.contentWindow.postMessage({ type: 'saveGoodPosture'}, '*');
            }
            if (!goodPostureSaved) { 
                startTimestamp = Date.now();
                currentActivityTimestamp = startTimestamp;
                updateDailyStatistics();
                data.lastUsedDateStr = new Date(startTimestamp).toDateString();
                updateTimewindowStatistics();
                goodPostureSaved = true;
            }
        } else if (message.type === 'processingSpeed' && message.processingSpeed !== currentProcessingSpeed) {
            setProcessingSpeedAndStartWebcam(message.processingSpeed);
        } else if (message.type === 'activity' && message.activity !== currentActivity) {
            if (currentActivity === undefined) {
                currentActivity = message.activity;
            } else {
                updateActivityStatistics(message.activity);
            }
        } else if (message.type === 'prepareCaptureTabClosing') {
            webcamRunning = false;
            prepareForTabClosing();
            chrome.storage.local.set({ statistics: data });
            chrome.runtime.sendMessage({ type: 'captureIsReadyToClose' });
        }
    });
    chrome.runtime.sendMessage({ type: 'captureIsReady' });
});

function computeProcessingSpeedInMilliseconds(processingSpeed) {
    if (processingSpeed === "fast") {
        return 1000;
    } else if (processingSpeed === "medium") {
        return 2500;
    } else if (processingSpeed === "slow") {
        return 5000;
    }
    return null;
}

function saveDataPeriodically() {
    const endTimestamp = Date.now();
    data.dailyDuration += Math.floor((endTimestamp - startTimestamp) / 1000);
    startTimestamp = endTimestamp;

    updateActivityStatistics(currentActivity);

    chrome.storage.local.set({ statistics: data });
    const delayTime = 10 * 60 * 1000;
    setTimeout(saveDataPeriodically, delayTime);
}

function setSelectedWebcamAndStartWebcam(selectedWebcam) {
    currentSelectedWebcam = selectedWebcam;

    if (currentSelectedWebcam && currentProcessingSpeed) {
        startWebcam(currentSelectedWebcam, currentProcessingSpeed);
    }
}

function setProcessingSpeedAndStartWebcam(processingSpeed) {
    currentProcessingSpeed = computeProcessingSpeedInMilliseconds(result.processingSpeed);

    if (currentSelectedWebcam && currentProcessingSpeed) {
        startWebcam(currentSelectedWebcam, currentProcessingSpeed);
    }
}

function startWebcam(deviceId, processingSpeed) {
    stopCapture();
    const constraints = {
        video: {
            deviceId: deviceId ? { exact: deviceId } : undefined
        },
        audio: false
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            videoElement.srcObject = stream;

            // Wait for the video to be properly initialized
            videoElement.onloadedmetadata = () => {
                webcamRunning = true;
                width = videoElement.videoWidth;
                height = videoElement.videoHeight;
                sandboxElement.contentWindow.postMessage({ type: 'frameSize', width: width, height: height }, '*');
                buffer = new ArrayBuffer(width * height * 4);  // RGBA

                canvas = new OffscreenCanvas(width, height);
                canvas.width = width;
                canvas.height = height;
                ctx = canvas.getContext('2d', { willReadFrequently: true });
                captureInterval = setInterval(captureAndSendFrame, processingSpeed);
            };
        })
        .catch(err => {
            console.error("[Error accessing webcam] " + err);
        });
}

function captureAndSendFrame() {
    if (sandboxIsReady && webcamRunning) {
        ctx.drawImage(videoElement, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        new Uint8Array(buffer).set(imageData.data);

        sandboxElement.contentWindow.postMessage({ 
            type: 'processFrame',
            buffer: buffer
        }, '*', [buffer]);
        buffer = new ArrayBuffer(width * height * 4);
    }
}

function stopCapture() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
}

// Messages from sandbox.js
window.addEventListener('message', (event) => {
    if (event.data.type === 'sandboxListenerReady') {
        const urls = {
          mediapipeVisionBundle: chrome.runtime.getURL('src/assets/mediapipe/vision_bundle.mjs'),
          mediapipeWasmDir: chrome.runtime.getURL('src/assets/mediapipe/'),
          mediapipeModel: chrome.runtime.getURL('src/assets/mediapipe/face_landmarker.task'),
          opencvJs: chrome.runtime.getURL('src/assets/opencv/opencv.js'),
          opencvWasm: chrome.runtime.getURL('src/assets/opencv/opencv_js.wasm')
        };
        sandboxElement.contentWindow.postMessage({ type: 'initUrls', urls: urls }, '*');
    } else if (event.data.type === 'sandboxIsReady') { 
        sandboxIsReady = true;
    } else if (event.data.type === 'warnUser') {
        chrome.runtime.sendMessage({ type: 'warnUser' });
    } else if (event.data.type === 'result') {
        updateBadPostureDuration(event.data.duration);
        if (event.data.pitch !== null) {
            pitchElement.textContent = `${event.data.pitch} degrees`;
        }
        if (event.data.distance !== null) {
            distanceElement.textContent = `${event.data.distance} cm`;
        }
        timeElement.textContent = `${event.data.duration} seconds`;
    } else if (event.data.type === 'webglContextLost') {
        webglErrorElement.textContent = "An error occured while processing the video frames. " + 
        "Please wait for the extension to fix the problem or restart the extension " + 
        "(turn off the extension in the popup page and then turn it on again). " + 
        "If this error occurs frequently, please use the popup page to change the speed of frame processing to a slower option.";
        chrome.runtime.sendMessage({ type: 'webglContextLost' });
    } else if (event.data.type === 'webglContextRestored') {
        chrome.runtime.sendMessage({ type: 'webglContextRestored' });
    }
});

async function initializeData() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['statistics'], (result) => {
            if (result.statistics !== undefined) {
                data = result.statistics;
            } else {
                data = {
                    dailyBadPostureDuration: 0,
                    dailyDuration: 0,
                    lastUsedDateStr: '',
                    cumulativeTimeWindowDuration: [
                        { name: '12am - 3am', bad: 0, total: 0 },
                        { name: '3am - 6am', bad: 0, total: 0 },
                        { name: '6am - 9am', bad: 0, total: 0 },
                        { name: '9am - 12pm', bad: 0, total: 0 },
                        { name: '12pm - 3pm', bad: 0, total: 0 },
                        { name: '3pm - 6pm', bad: 0, total: 0 },
                        { name: '6pm - 9pm', bad: 0, total: 0 },
                        { name: '9pm - 12am', bad: 0, total: 0 }
                    ],
                    cumulativeWorkDuration: { bad: 0, total: 0 },
                    cumulativeStudyDuration: { bad: 0, total: 0 },
                    cumulativeEntertainmentDuration: { bad: 0, total: 0 },
                    longestGoodPostureDuration: 0,
                    badPosturePercentageLast120Days: [],
                    lowestBadPosturePercentage: undefined,
                    highestBadPosturePercentage: undefined,
                };
            }
            resolve();
        });
    });
}

async function waitForData() {
    await initializeData();
}

waitForData();

function updateDailyStatistics() {
    const currentDateStr = new Date().toDateString();
    if (currentDateStr !== data.lastUsedDateStr && data.lastUsedDateStr !== '') {
        let lastDayPercentage = (data.dailyDuration === 0) ? 0 : (data.dailyBadPostureDuration / data.dailyDuration) * 100;
        if (data.dailyBadPostureDuration > data.dailyDuration) {
            data.dailyDuration = data.dailyBadPostureDuration;
        }
        const lastDayData = { 
            date: data.lastUsedDateStr, 
            badPostureDuration: data.dailyBadPostureDuration, 
            totalDuration: data.dailyDuration, 
            badPosturePercentage: lastDayPercentage 
        };

        if (data.badPosturePercentageLast120Days.length === 120) {
            data.badPosturePercentageLast120Days.shift();
        }
        data.badPosturePercentageLast120Days.push(lastDayData);
        
        const maxPercentage = data.highestBadPosturePercentage;
        const minPercentage = data.lowestBadPosturePercentage;

        if (maxPercentage === undefined || lastDayPercentage > maxPercentage) {
            data.highestBadPosturePercentage = lastDayPercentage;
        }
        if (minPercentage === undefined || lastDayPercentage < minPercentage) {
            data.lowestBadPosturePercentage = lastDayPercentage;
        }

        data.dailyBadPostureDuration = 0;
        data.dailyDuration = 0;
    }
}

function updateBadPostureDuration(badPostureDuration) {
    if (firstStatsUpdate === true) {
        const delayTime = 10 * 60 * 1000;
        setTimeout(saveDataPeriodically, delayTime);
        longestGoodDurationStart = Date.now();
        firstStatsUpdate = false;
    }
    
    if (badPostureDuration > 0) {
        if (consecBadPosDur > 0) {  // Bad Posture Ongoing
            consecBadPosDur = badPostureDuration;
        } else {  // Bad Posture Just Started
            const goodPostureDuration = Math.floor((Date.now() - longestGoodDurationStart) / 1000);
            if (goodPostureDuration > data.longestGoodPostureDuration) {
                data.longestGoodPostureDuration = goodPostureDuration;
            }
            consecBadPosDur = badPostureDuration;
        }
    } else if (badPostureDuration === 0) {
        if (consecBadPosDur > 0) {  // Good Posture Just Started
            cumulativeTimeWindowBadPosDur += (consecBadPosDur - prevTimeWindowUpdateConsecBadPosDur);
            cumulativeActivityBadPostDur += (consecBadPosDur - prevActivityUpdateConsecBadPosDur);
            data.dailyBadPostureDuration += consecBadPosDur;
            consecBadPosDur = 0;
            prevTimeWindowUpdateConsecBadPosDur = 0;
            prevActivityUpdateConsecBadPosDur = 0;
            longestGoodDurationStart = Date.now();
        } else {  // Good Posture Ongoing
            const currentGoodPostureDuration = Math.floor((Date.now() - longestGoodDurationStart) / 1000);
            if (currentGoodPostureDuration > data.longestGoodPostureDuration) {
                data.longestGoodPostureDuration = currentGoodPostureDuration;
            }
        }
    }
}

function updateTimewindowStatistics() {
    const currentDate = new Date();
    const hour = currentDate.getHours();
    const newWindow = Math.floor(hour / 3);

    
    if (currentTimeWindow === undefined) {
        currentTimeWindow = newWindow;
        lastTimeWindowDate = currentDate;
    } else {
        const currentTimeWindowBadPostureDuration = (cumulativeTimeWindowBadPosDur + 
            (consecBadPosDur - prevTimeWindowUpdateConsecBadPosDur));
        const currentTimeWindowDuration = Math.floor((currentDate - lastTimeWindowDate) / 1000);
        if (currentTimeWindowBadPostureDuration > currentTimeWindowDuration) {
            currentTimeWindowDuration = currentTimeWindowBadPostureDuration;
        }
        prevTimeWindowUpdateConsecBadPosDur = consecBadPosDur;
        let timeWindowData = data.cumulativeTimeWindowDuration[currentTimeWindow];
        timeWindowData.bad += currentTimeWindowBadPostureDuration;
        timeWindowData.total += currentTimeWindowDuration;
        cumulativeTimeWindowBadPosDur = 0;
        lastTimeWindowDate = currentDate;
    }

    if (newWindow !== currentTimeWindow) {
        currentTimeWindow = newWindow;
    }

    const minutesUntilNextWindow = 180 - (hour % 3) * 60 - currentDate.getMinutes();
    if (minutesUntilNextWindow < minutesUntilNextUpdate) {
        const millisecondsUntilNextWindow = minutesUntilNextWindow * 60 * 1000;
        setTimeout(updateTimewindowStatistics, millisecondsUntilNextWindow);    
    } else {
        const millisecondsUntilNextUpdate = minutesUntilNextUpdate * 60 * 1000
        setTimeout(updateTimewindowStatistics, millisecondsUntilNextUpdate);
    }
}

function updateActivityStatistics(newActivity) {
    const nextTimestamp = Date.now();
    const currentActivityDuration = Math.floor((nextTimestamp - currentActivityTimestamp) / 1000);
    const currentActivityBadPostureDuration = (cumulativeActivityBadPostDur + (consecBadPosDur - prevActivityUpdateConsecBadPosDur));
    if (currentActivityBadPostureDuration > currentActivityDuration) {
        currentActivityDuration = currentActivityBadPostureDuration;
    }
    prevActivityUpdateConsecBadPosDur = consecBadPosDur;
    cumulativeActivityBadPostDur = 0;
    currentActivityTimestamp = nextTimestamp;
    
    if (currentActivity === 'work') {
        data.cumulativeWorkDuration.bad += currentActivityBadPostureDuration;
        data.cumulativeWorkDuration.total += currentActivityDuration;
    } else if (currentActivity === 'study') {
        data.cumulativeStudyDuration.bad += currentActivityBadPostureDuration;
        data.cumulativeStudyDuration.total += currentActivityDuration;
    } else if (currentActivity === 'entertainment') {
        data.cumulativeEntertainmentDuration.bad += currentActivityBadPostureDuration;
        data.cumulativeEntertainmentDuration.total += currentActivityDuration;
    }

    currentActivity = newActivity;
}

function prepareForTabClosing() {
    stopCapture();
    webcamRunning = false;
    const endTimestamp = Date.now();
    data.dailyDuration += Math.floor((endTimestamp - startTimestamp) / 1000);
    data.dailyBadPostureDuration += consecBadPosDur;

    updateTimewindowStatistics();
    updateActivityStatistics(currentActivity);
    
    // Clear all setTimeout/setInterval
    clearTimeout(updateTimewindowStatistics);
    clearTimeout(updateDailyStatistics);
    clearInterval(captureAndSendFrame);
}