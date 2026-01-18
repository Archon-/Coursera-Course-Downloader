// content.js - Version 6 (Infinite Persistence)

let searchInterval = null;

function attemptAutoGrab() {
    // Clear any existing interval just in case
    if (searchInterval) clearInterval(searchInterval);

    console.log("Scanner started. Waiting for video...");

    // Click Play if found (One time attempt)
    const playBtn = document.querySelector('button[data-testid="centerPlayButton"]');
    if (playBtn) playBtn.click();

    // Loop forever until we find the video source
    searchInterval = setInterval(() => {
        // 1. Keep trying to click play if it appears late
        const btn = document.querySelector('button[data-testid="centerPlayButton"]');
        if (btn) btn.click();

        // 2. Check for Video Source
        const videoElement = document.querySelector('video');
        if (videoElement && videoElement.src && videoElement.src.includes("cloudfront.net")) {
            
            console.log("FOUND SOURCE:", videoElement.src);
            clearInterval(searchInterval); // Stop looking

            // Send to background
            chrome.runtime.sendMessage({
                action: "foundVideoUrl",
                url: videoElement.src
            });
        }
    }, 2000); // Check every 2 seconds
}

// Start immediately
attemptAutoGrab();

// LISTENER FOR SCANNING (Unchanged)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanCourse") {
        // ... (Keep your existing scan logic here, it was working fine) ...
        // If you need me to paste the scan logic again, let me know, 
        // but copy-pasting Part 2 from Version 4 is fine.
        
        // PASTE SCAN LOGIC HERE
        const courseData = [];
        const moduleHeaders = document.querySelectorAll('[data-testid="module-number-heading"]');
        // ... (rest of scanner code)
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