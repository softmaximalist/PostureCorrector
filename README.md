# PostureCorrector

Copyright (c) 2025 880babur710. All rights reserved.

## Notice
This repository is for code review purposes only. 
- No permission is granted for any use, modification, or distribution of this code
- All rights are reserved by the author
- The code is shared publicly solely for portfolio/review purposes

## Website Link
- https://posturecorrector.vercel.app/

## Chrome extension files
### manifest.json
- specifies basic metadata and functionality of the extension

### icons/
- Contains all the icon images for the extension

### opencv/
- Contains the custom OpenCV.js built from source

### styles/
- Contains all the css files

### src/
- Contains the main code files (html and javascript files) for the extension
- Does not include the css files (these are contained the styles/ folder)

### popup.html, styles.css, popup.js
- Files for the popup page of the browser extension
- Allows the user to select the webcam they would like to use
- Allows the user to select one of two different warning methods
- Users can get warned by either receiving desktop notifications or getting all their browser tabs blurred
- Allows the user to select their activity which will be used for the statistics that get displayed on the capture tab consisting of capture.html, capture-styles.css, and capture.js
- popup.js saves the users' choice and loads them whenever the user reopens the popup page

### content.js
- Content script that is injected into the user's browser tabs
- Contains code to blur and unblur the main content of the user's browser tabs
- Receives messages from background.js and follows them to blur and unblur the tabs

### background.js
- Service worker who keeps running the background
- Receives messages from popup.js and creates a new browser tab using capture.html

### capture.html, capture-styles.css, capture.js
- Files for the browser tab that get created when the user turns on the extension
- Displays the webcam footage using the user's currently selected webcam
- Displays graphs and charts that provide insight into the user's pattern of bad posture
- Capture.js captures and sends the webcam frames to sandbox.js for processing and receives the results of processed frames back
- Using the results of processed frames sent by sandbox.js, capture.js also tracks and records statistics such as bad posture percentage per each 3-hour time window (12am - 3am, 3am - 6am, ..., 9pm - 12am) and bad posture percentage per each user activity (work, study, entertainment)

### sandbox.html, sandbox.js
- Given the raw webcam frames by capture.js, sandbox.js process these frames using OpenCV and Mediapipe to detect user's posture
- After processing each frame, sandbox.js sends the results to capture.js
