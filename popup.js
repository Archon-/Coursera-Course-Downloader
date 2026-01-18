// popup.js

function init() {
    chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning', 'concurrencyLimit'], (data) => {
        const statusDiv = document.getElementById('status');
        const scanBtn = document.getElementById('scanBtn');
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const concurrencyInput = document.getElementById('concurrencyInput');

        // Restore saved limit or default to 1
        if (data.concurrencyLimit) concurrencyInput.value = data.concurrencyLimit;

        if (data.videoQueue && data.videoQueue.length > 0) {
            const current = (data.currentIndex || 0) + 1;
            const total = data.videoQueue.length;
            
            if (data.isJobRunning) {
                statusDiv.innerText = `RUNNING: Video ${current} / ${total}`;
                scanBtn.classList.add('hidden');
                startBtn.classList.add('hidden');
                stopBtn.classList.remove('hidden');
                stopBtn.style.display = "block";
                concurrencyInput.disabled = true; // Lock settings while running
            } else {
                statusDiv.innerText = `READY: ${total} videos queued.\nNext: #${current}`;
                scanBtn.innerText = "Rescan Course";
                scanBtn.classList.remove('hidden');
                startBtn.classList.remove('hidden');
                stopBtn.classList.add('hidden');
                concurrencyInput.disabled = false;
            }
        } else {
            statusDiv.innerText = "No queue. Please scan.";
            scanBtn.classList.remove('hidden');
            startBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
        }
    });
}

init();

document.getElementById('scanBtn').addEventListener('click', () => {
    document.getElementById('status').innerText = "Scanning... (Expand modules first!)";
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action: "scanCourse"}, (response) => {
            init();
        });
    });
});

document.getElementById('startBtn').addEventListener('click', () => {
    const limit = parseInt(document.getElementById('concurrencyInput').value) || 1;
    
    // Save settings and Start
    chrome.storage.local.set({ isJobRunning: true, concurrencyLimit: limit, activeDownloads: [] }, () => {
        chrome.storage.local.get(['videoQueue', 'currentIndex'], (data) => {
             if (data.videoQueue && data.videoQueue[data.currentIndex]) {
                 chrome.tabs.update({ url: data.videoQueue[data.currentIndex].url });
                 window.close();
             }
        });
        init();
    });
});

document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.storage.local.set({ isJobRunning: false }, () => {
        document.getElementById('status').innerText = "STOPPING...";
        init();
    });
});

document.getElementById('resetBtn').addEventListener('click', () => {
    chrome.storage.local.clear(() => {
        document.getElementById('status').innerText = "Memory Cleared.";
        init();
    });
});