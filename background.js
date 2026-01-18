// background.js - Version 7 (Simplified Sequential)

// 1. RECEIVE URL
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "foundVideoUrl") {
        console.log("SOURCE FOUND:", request.url);
        attemptDownload(request.url);
    }
});

async function attemptDownload(url) {
    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning', 'activeDownloadId']);
    
    // Safety Checks
    if (!data.isJobRunning) return;
    
    // CRITICAL FIX: If we already have an active download ID, IGNORE this request.
    // This prevents double downloading if the content script sends the URL multiple times.
    if (data.activeDownloadId) {
        console.log("Ignored: A download is already in progress.");
        return;
    }

    const currentVideo = data.videoQueue[data.currentIndex];
    
    // Start Download
    chrome.downloads.download({
        url: url,
        filename: `Coursera_Course/${currentVideo.filename}`,
        conflictAction: "overwrite"
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
             console.log("Download Failed:", chrome.runtime.lastError);
             // If failed, force move to next to avoid stuck loop
             processNext(); 
        } else {
             console.log(`Started ID: ${downloadId}. Locking...`);
             chrome.storage.local.set({ activeDownloadId: downloadId });
        }
    });
}

// 2. WATCH FOR COMPLETION
chrome.downloads.onChanged.addListener(async (delta) => {
    // We only care if it finished
    if (!delta.state || delta.state.current !== 'complete') return;

    const data = await chrome.storage.local.get(['activeDownloadId']);
    
    // Check if the finished ID matches our locked ID
    if (data.activeDownloadId && delta.id === data.activeDownloadId) {
        console.log("Download Finished. Unlocking...");
        await chrome.storage.local.set({ activeDownloadId: null });
        processNext();
    }
});

async function processNext() {
    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning']);
    
    if (!data.isJobRunning) return;

    const nextIndex = data.currentIndex + 1;
    
    if (nextIndex >= data.videoQueue.length) {
        console.log("JOB DONE.");
        chrome.storage.local.set({ isJobRunning: false, activeDownloadId: null });
        return;
    }

    // Save new index
    await chrome.storage.local.set({ currentIndex: nextIndex, activeDownloadId: null });

    const nextUrl = data.videoQueue[nextIndex].url;
    console.log(`Navigating to ${nextIndex}: ${nextUrl}`);
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
             chrome.tabs.update(tabs[0].id, { url: nextUrl });
        }
    });
}