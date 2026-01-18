// content.js - Version 8

let searchInterval = null;

function attemptAutoGrab() {
    if (searchInterval) clearInterval(searchInterval);

    // Try to click Play immediately
    const playBtn = document.querySelector('button[data-testid="centerPlayButton"]');
    if (playBtn) playBtn.click();

    searchInterval = setInterval(() => {
        // Retry clicking play
        const btn = document.querySelector('button[data-testid="centerPlayButton"]');
        if (btn) btn.click();

        // Check for Video Source
        const videoElement = document.querySelector('video');
        if (videoElement && videoElement.src && videoElement.src.includes("cloudfront.net")) {

            console.log("FOUND SOURCE:", videoElement.src);
            clearInterval(searchInterval);

            // --- NEW: PAUSE VIDEO ---
            videoElement.pause();

            // --- NEW: GET PAGE TITLE (Fallback) ---
            let pageTitle = "Unknown Video";
            const h1 = document.querySelector('h1');
            const h2 = document.querySelector('h2');
            if (h1) pageTitle = h1.innerText;
            else if (h2) pageTitle = h2.innerText;

            // Send both URL and Title to background
            chrome.runtime.sendMessage({
                action: "foundVideoUrl",
                url: videoElement.src,
                pageTitle: pageTitle
            });
        }
    }, 2000);
}

attemptAutoGrab();

// SCANNER (Unchanged)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanCourse") {
        const courseData = [];
        const moduleHeaders = document.querySelectorAll('[data-testid="module-number-heading"]');

        moduleHeaders.forEach((header) => {
            const moduleName = header.innerText.trim();
            const moduleContainer = header.closest('.cds-AccordionRoot-container');

            if (moduleContainer) {
                const items = moduleContainer.querySelectorAll('li');
                let videoCount = 0;
                items.forEach((item) => {
                    const typeLabel = item.querySelector('.css-1rhvk9j');
                    if (typeLabel && typeLabel.innerText.includes("Video")) {
                        videoCount++;
                        const titleEl = item.querySelector('.css-u7fh1q');
                        const rawTitle = titleEl ? titleEl.innerText : "Unknown";
                        const linkEl = item.querySelector('a');
                        const href = linkEl ? linkEl.getAttribute('href') : "";

                        if (href) {
                            const modNum = moduleName.match(/\d+/)[0].padStart(2, '0');
                            const vidNum = videoCount.toString().padStart(2, '0');
                            const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "_").trim();

                            courseData.push({
                                url: "https://www.coursera.org" + href,
                                filename: `M${modNum}_${vidNum} - ${cleanTitle}.mp4`
                            });
                        }
                    }
                });
            }
        });

        chrome.storage.local.set({ videoQueue: courseData, currentIndex: 0 }, () => {
            sendResponse({ count: courseData.length });
        });
        return true;
    }
});