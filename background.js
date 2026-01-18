// background.js - Version 9 (Robust Concurrent)

// Helper: Get real active downloads count from Chrome
function getActiveCount() {
    return new Promise((resolve) => {
        chrome.downloads.search({ state: 'in_progress' }, (items) => {
            // Filter by our extension ID to be safe
            const myDownloads = items.filter(item => item.byExtensionId === chrome.runtime.id);
            resolve(myDownloads.length);
        });
    });
}

// 1. RECEIVE URL
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "foundVideoUrl") {
        attemptDownload(request.url, request.pageTitle);
    }
});

async function attemptDownload(url, scrapedTitle) {
    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex', 'isJobRunning', 'concurrencyLimit']);

    if (!data.isJobRunning) return;

    // --- SECURITY CHECK: URL SCHEME ---
    if (!url || (!url.startsWith("http:") && !url.startsWith("https:"))) {
        console.error("Skipping unsafe or invalid URL:", url);
        // Unlock and move next
        await chrome.storage.local.set({ isNavigating: false });
        processQueue();
        return;
    }

    const currentVideo = data.videoQueue[data.currentIndex];

    // --- FIX UNKNOWN TITLE ---
    let finalFilename = currentVideo.filename;
    if (finalFilename.includes("Unknown") && scrapedTitle) {
        const prefix = finalFilename.split('-')[0]; // "M01_01 "
        let cleanScraped = scrapedTitle.replace(/[\\/:*?"<>|]/g, "_").trim();
        if (cleanScraped.length > 200) cleanScraped = cleanScraped.substring(0, 200);
        finalFilename = `${prefix}- ${cleanScraped}.mp4`;
        console.log(`Fixed Unknown Title: ${finalFilename}`);
    }

    console.log(`Starting Download: ${finalFilename}`);

    chrome.downloads.download({
        url: url,
        filename: `Coursera_Course/${finalFilename}`,
        conflictAction: "overwrite"
    }, async (downloadId) => {
        if (chrome.runtime.lastError) {
            console.log("Download Error:", chrome.runtime.lastError);
        }

        // CRITICAL: We finished processing this page.
        // Release lock and check if we can fetch more.
        await chrome.storage.local.set({ isNavigating: false });
        processQueue();
    });
}

// 2. WATCH FOR COMPLETION
chrome.downloads.onChanged.addListener(async (delta) => {
    if (!delta.state || delta.state.current !== 'complete') return;

    // A download finished. A slot might be open.
    // We don't need to check IDs manually, just check the count.
    processQueue();
});

// Central Engine
async function processQueue() {
    const data = await chrome.storage.local.get(['isJobRunning', 'concurrencyLimit', 'isNavigating']);

    if (!data.isJobRunning) return;
    if (data.isNavigating) return; // Busy fetching a URL

    // Get REAL count
    const activeCount = await getActiveCount();
    const limit = data.concurrencyLimit || 1;

    // ALSO update the storage 'activeDownloads' just for visual debugging if needed, 
    // but the logic relies on getActiveCount().
    // We can skip saving it or save a dummy array if popup needs something. 
    // Popup doesn't seem to use activeDownloads for anything critical.

    if (activeCount < limit) {
        navigateNext();
    } else {
        console.log(`Max concurrency reached (${activeCount}/${limit}). Waiting...`);
    }
}

async function navigateNext() {
    // Acquire Lock
    await chrome.storage.local.set({ isNavigating: true });

    const data = await chrome.storage.local.get(['videoQueue', 'currentIndex']);
    const nextIndex = data.currentIndex + 1;

    if (nextIndex >= data.videoQueue.length) {
        console.log("Reached end of queue. Pending downloads finishing...");
        // Don't release lock? Or release it?
        // If we release, processQueue might call navigateNext again?
        // Check bounds.
        await chrome.storage.local.set({ isNavigating: false });
        // Logic to stop?
        return;
    }

    // Update Index
    await chrome.storage.local.set({ currentIndex: nextIndex });

    const nextUrl = data.videoQueue[nextIndex].url;
    console.log(`Navigating to #${nextIndex + 1}: ${nextUrl}`);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, { url: nextUrl });
        } else {
            // Fallback: try querying just active
            chrome.tabs.query({ active: true }, function (allTabs) {
                if (allTabs[0]) {
                    chrome.tabs.update(allTabs[0].id, { url: nextUrl });
                } else {
                    console.error("No active tab found to navigate!");
                    chrome.storage.local.set({ isNavigating: false }); // Release so we retry later?
                }
            });
        }
    });
}