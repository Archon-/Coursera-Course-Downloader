// popup.js

// 1. INITIALIZE: Restore state from storage
function init() {
    chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning'], (data) => {
        const statusDiv = document.getElementById('status');
        const scanBtn = document.getElementById('scanBtn');
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');

        // Check if we have a queue
        if (data.videoQueue && data.videoQueue.length > 0) {
            const current = (data.currentIndex || 0) + 1;
            const total = data.videoQueue.length;
            
            if (data.isJobRunning) {
                // RUNNING STATE
                statusDiv.innerText = `RUNNING: Processing video ${current} of ${total}`;
                scanBtn.classList.add('hidden');
                startBtn.classList.add('hidden');
                stopBtn.classList.remove('hidden');
                stopBtn.style.display = "block";
            } else {
                // PAUSED/READY STATE
                statusDiv.innerText = `READY: ${total} videos found.\nNext up: Video #${current}`;
                scanBtn.innerText = "Rescan Course";
                scanBtn.classList.remove('hidden');
                startBtn.classList.remove('hidden');
                stopBtn.classList.add('hidden');
            }
        } else {
            // EMPTY STATE
            statusDiv.innerText = "No course data found. Please scan.";
            scanBtn.classList.remove('hidden');
            startBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
        }
    });
}

// Run on load
init();

// 2. BUTTON HANDLERS

// SCAN
document.getElementById('scanBtn').addEventListener('click', () => {
    document.getElementById('status').innerText = "Scanning... (Expand all modules first!)";
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action: "scanCourse"}, (response) => {
            if (chrome.runtime.lastError || !response) {
                document.getElementById('status').innerText = "Error: Refresh page & try again.";
            } else {
                // Reload UI to show new count
                init();
            }
        });
    });
});

// START
document.getElementById('startBtn').addEventListener('click', () => {
    chrome.storage.local.set({ isJobRunning: true }, () => {
        // Trigger the first move manually
        chrome.storage.local.get(['videoQueue', 'currentIndex'], (data) => {
             if (data.videoQueue && data.videoQueue[data.currentIndex]) {
                 chrome.tabs.update({ url: data.videoQueue[data.currentIndex].url });
                 window.close(); // Close popup so user sees the page load
             }
        });
        init();
    });
});

// STOP
document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.storage.local.set({ isJobRunning: false }, () => {
        document.getElementById('status').innerText = "STOPPING... (Current download will finish)";
        init();
    });
});

// HARD RESET
document.getElementById('resetBtn').addEventListener('click', () => {
    chrome.storage.local.clear(() => {
        document.getElementById('status').innerText = "Memory Cleared.";
        init();
    });
});