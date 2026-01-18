// background.js - Version 8 (Concurrent)

// 1. RECEIVE URL
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "foundVideoUrl") {
        // Pass the scraped title along
        attemptDownload(request.url, request.pageTitle);
    }
});

async function attemptDownload(url, scrapedTitle) {
    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning', 'activeDownloads', 'concurrencyLimit']);

    if (!data.isJobRunning) return;

    // --- SECURITY CHECK: URL SCHEME ---
    if (!url || (!url.startsWith("http:") && !url.startsWith("https:"))) {
        console.error("Skipping unsafe or invalid URL:", url);
        // Skip this download and move next
        checkAndNavigateNext();
        return;
    }

    // Ensure activeDownloads is an array
    const currentDownloads = data.activeDownloads || [];
    const limit = data.concurrencyLimit || 1;

    const currentVideo = data.videoQueue[data.currentIndex];

    // --- FIX UNKNOWN TITLE ---
    let finalFilename = currentVideo.filename;
    if (finalFilename.includes("Unknown") && scrapedTitle) {
        const prefix = finalFilename.split('-')[0]; // "M01_01 "
        let cleanScraped = scrapedTitle.replace(/[\\/:*?"<>|]/g, "_").trim();
        // Limit filename length (Windows max path is often 260, but individual components 255. play safe)
        if (cleanScraped.length > 200) cleanScraped = cleanScraped.substring(0, 200);
        finalFilename = `${prefix}- ${cleanScraped}.mp4`;
        console.log(`Fixed Unknown Title: ${finalFilename}`);
    }

    console.log(`Starting Download: ${finalFilename}`);

    chrome.downloads.download({
        url: url,
        filename: `Coursera_Course/${finalFilename}`,
        conflictAction: "overwrite"
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
            console.log("Download Error:", chrome.runtime.lastError);
            // If error, force next to keep queue moving
            checkAndNavigateNext();
        } else {
            // Add ID to active list
            currentDownloads.push(downloadId);
            chrome.storage.local.set({ activeDownloads: currentDownloads }, () => {
                if (currentDownloads.length < limit) {
                    navigateNext();
                } else {
                    console.log(`Max concurrency (${limit}) reached. Waiting for a finish...`);
                }
            });
        }
    });
}

// 2. WATCH FOR COMPLETION
chrome.downloads.onChanged.addListener(async (delta) => {
    if (!delta.state || delta.state.current !== 'complete') return;

    const data = await chrome.storage.local.get(['activeDownloads']);
    let currentDownloads = data.activeDownloads || [];

    if (currentDownloads.includes(delta.id)) {
        console.log(`Download ${delta.id} finished.`);

        // Remove from list
        currentDownloads = currentDownloads.filter(id => id !== delta.id);

        await chrome.storage.local.set({ activeDownloads: currentDownloads });

        // Slot opened up! Go next.
        checkAndNavigateNext();
    }
});

async function checkAndNavigateNext() {
    const data = await chrome.storage.local.get(['isJobRunning', 'activeDownloads', 'concurrencyLimit']);

    if (!data.isJobRunning) return;

    const limit = data.concurrencyLimit || 1;
    const currentDownloads = data.activeDownloads || [];

    if (currentDownloads.length < limit) {
        navigateNext();
    }
}

async function navigateNext() {
    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex']);
    const nextIndex = data.currentIndex + 1;

    if (nextIndex >= data.videoQueue.length) {
        console.log("Reached end of queue. Waiting for pending downloads to finish.");
        return;
    }

    // Update Index
    await chrome.storage.local.set({ currentIndex: nextIndex });

    const nextUrl = data.videoQueue[nextIndex].url;
    console.log(`Navigating to #${nextIndex + 1}: ${nextUrl}`);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, { url: nextUrl });
        }
    });
}