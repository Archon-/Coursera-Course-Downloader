// background.js - Version 12 (Reverted to Standard PDF)

// Helper: Get real active downloads count from Chrome
function getActiveCount() {
    return new Promise((resolve) => {
        chrome.downloads.search({ state: 'in_progress' }, (items) => {
            const myDownloads = items.filter(item => item.byExtensionId === chrome.runtime.id);
            resolve(myDownloads.length);
        });
    });
}

// 1. RECEIVE URL
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "foundVideoUrl") {
        attemptDownload(request.url, request.pageTitle, 'video');
    }
    else if (request.action === "foundReadingPdf") {
        attemptDownload(request.dataUrl, request.pageTitle, 'reading');
    }
});

async function attemptDownload(url, scrapedTitle, type = 'video') {
    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning', 'concurrencyLimit']);

    if (!data.isJobRunning) return;

    if (!url || (!url.startsWith("http:") && !url.startsWith("https:") && !url.startsWith("data:"))) {
        console.error("Skipping unsafe/invalid URL");
        await chrome.storage.local.set({ isNavigating: false });
        processQueue();
        return;
    }

    const currentVideo = data.videoQueue[data.currentIndex];
    let finalFilename = currentVideo.filename;

    // Fix Unknown Titles
    if (finalFilename.includes("Unknown") && scrapedTitle) {
        const prefix = finalFilename.split('-')[0];
        let cleanScraped = scrapedTitle.replace(/[\\/:*?"<>|]/g, "_").trim();
        if (cleanScraped.length > 200) cleanScraped = cleanScraped.substring(0, 200);

        const ext = type === 'reading' ? '.pdf' : '.mp4';

        if (!cleanScraped.endsWith(ext) && !cleanScraped.endsWith('.html')) {
            finalFilename = `${prefix}- ${cleanScraped}${ext}`;
        } else {
            finalFilename = `${prefix}- ${cleanScraped}`;
        }
    }

    console.log(`Starting Download: ${finalFilename}`);

    chrome.downloads.download({
        url: url,
        filename: `Coursera_Course/${finalFilename}`,
        conflictAction: "overwrite"
    }, async (downloadId) => {
        if (chrome.runtime.lastError) console.log("DL Error:", chrome.runtime.lastError);

        // JOB DONE
        await chrome.storage.local.set({ isNavigating: false });
        processQueue();
    });
}

chrome.downloads.onChanged.addListener(async (delta) => {
    if (delta.state && delta.state.current === 'complete') {
        processQueue();
    }
});

async function processQueue() {
    const data = await chrome.storage.local.get(['isJobRunning', 'concurrencyLimit', 'isNavigating']);
    if (!data.isJobRunning || data.isNavigating) return;

    const activeCount = await getActiveCount();
    const limit = data.concurrencyLimit || 1;

    if (activeCount < limit) {
        navigateNext();
    }
}

async function navigateNext() {
    await chrome.storage.local.set({ isNavigating: true });

    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex']);
    const nextIndex = data.currentIndex + 1;

    if (nextIndex >= data.videoQueue.length) {
        console.log("Queue finished.");
        await chrome.storage.local.set({ isNavigating: false });
        return;
    }

    await chrome.storage.local.set({ currentIndex: nextIndex });
    const nextUrl = data.videoQueue[nextIndex].url;
    console.log(`Navigating to #${nextIndex + 1}: ${nextUrl}`);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, { url: nextUrl });
        } else {
            // Fallback
            chrome.tabs.query({ active: true }, function (allTabs) {
                if (allTabs[0]) {
                    chrome.tabs.update(allTabs[0].id, { url: nextUrl });
                } else {
                    chrome.storage.local.set({ isNavigating: false });
                }
            });
        }
    });
}