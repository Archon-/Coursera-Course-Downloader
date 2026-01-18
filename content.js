// content.js - Version 23 (Isolation + Alignment Fix)

let searchInterval = null;

function attemptAutoGrab() {
    if (searchInterval) clearInterval(searchInterval);

    const playBtn = document.querySelector('button[data-testid="centerPlayButton"]');
    if (playBtn) playBtn.click();

    searchInterval = setInterval(async () => {
        const btn = document.querySelector('button[data-testid="centerPlayButton"]');
        if (btn) btn.click();

        const videoElement = document.querySelector('video');
        if (videoElement && videoElement.src && videoElement.src.includes("cloudfront.net")) {
            console.log("FOUND VIDEO SOURCE:", videoElement.src);
            clearInterval(searchInterval);
            videoElement.pause();

            let pageTitle = "Unknown Video";
            const h1 = document.querySelector('h1');
            if (h1) pageTitle = h1.innerText;

            chrome.runtime.sendMessage({
                action: "foundVideoUrl",
                url: videoElement.src,
                pageTitle: pageTitle,
                type: 'video'
            });
            return;
        }

        const readingContainer = document.querySelector('.rc-ReadingItem');
        if (readingContainer) {
            console.log("FOUND READING CONTAINER - Initial Check");
            clearInterval(searchInterval);
        }
    }, 2000);

    // REVEAL LOGIC (Applied to the Clone in Isolation)
    function aggressiveReveal(element) {
        if (!element) return;

        // 1. Walk tree (for the clone, the tree is short, but we check children too)
        const allElements = element.querySelectorAll('*');
        allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || el.style.display === 'none') {
                el.style.setProperty('display', 'block', 'important');
                el.style.setProperty('visibility', 'visible', 'important');
                el.style.setProperty('opacity', '1', 'important');
            }
        });

        // 2. Specific Targeting (User Request)
        const buggedContainer = element.querySelector('.css-jgflq0');
        if (buggedContainer) {
            const innerDiv = buggedContainer.querySelector('div');
            if (innerDiv) innerDiv.style.setProperty('display', 'block', 'important');
            buggedContainer.style.setProperty('display', 'block', 'important');
        }
    }

    let readingAttempts = 0;
    const MAX_ATTEMPTS = 15;

    const readingInterval = setInterval(() => {
        const readingContainer = document.querySelector('.rc-ReadingItem');

        if (readingContainer) {
            const contentBody = document.querySelector('.rc-CML');
            const hasContent = contentBody && (contentBody.innerText.trim().length > 50 || contentBody.children.length > 0);

            if (hasContent) {
                console.log("Content detected. Waiting 3s for stability...");
                clearInterval(readingInterval);
                if (searchInterval) clearInterval(searchInterval);

                setTimeout(() => {
                    console.log("Preparing Independent Isolation Container...");

                    let pageTitle = "Unknown Reading";
                    const h1 = document.querySelector('h1');
                    if (h1) pageTitle = h1.innerText;

                    // --- ISOLATION STRATEGY ---
                    // 1. Create a temporary 'clean slate' container
                    const overlay = document.createElement('div');
                    overlay.id = 'pdf-gen-overlay';
                    overlay.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 800px; /* Force Tablet Width */
                        height: auto;
                        min-height: 100vh;
                        padding: 20px;
                        background: white;
                        z-index: 999999;
                        overflow: visible;
                        box-sizing: border-box;
                    `;
                    document.body.appendChild(overlay);

                    // 2. Clone the content
                    const clone = readingContainer.cloneNode(true);

                    // 3. Clean the Clone Logic
                    // Remove negative margins or weird positioning that causes cutoff
                    clone.style.cssText = `
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        position: static !important;
                        display: block !important;
                    `;

                    // 4. Append to Overlay
                    overlay.appendChild(clone);

                    // 5. Run Reveal Logic on the *Isolated Clone*
                    aggressiveReveal(clone);

                    // 6. Calculate Height from the OVERLAY (which now holds the content)
                    const dynamicHeight = Math.max(overlay.scrollHeight + 200, 5000);
                    console.log(`Isolation Layout Height: ${dynamicHeight}px`);

                    const opt = {
                        margin: [10, 10, 10, 10],
                        filename: 'reading.pdf',
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: {
                            scale: 2,
                            useCORS: true,
                            logging: true,
                            width: 800,        // Match Overlay Width
                            height: dynamicHeight,
                            windowWidth: 800,
                            windowHeight: dynamicHeight,
                            scrollX: 0,
                            scrollY: 0,
                            x: 0,
                            y: 0
                        },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };

                    html2pdf().set(opt).from(overlay).outputPdf().then((pdfString) => {
                        // Cleanup Overlay
                        document.body.removeChild(overlay);

                        const base64PDF = btoa(pdfString);
                        const dataUrl = 'data:application/pdf;base64,' + base64PDF;

                        chrome.runtime.sendMessage({
                            action: "foundReadingPdf",
                            dataUrl: dataUrl,
                            pageTitle: pageTitle,
                            type: 'reading'
                        });

                    }).catch(err => {
                        if (document.body.contains(overlay)) document.body.removeChild(overlay);
                        console.error("PDF Generation Failed:", err);
                        alert("Coursera Downloader: PDF Generation Failed! Check console.");
                    });

                }, 3000);

            } else {
                console.log("Waiting for content...");
                readingAttempts++;
            }
        } else {
            if (document.querySelector('.rc-ReadingItem')) readingAttempts++;
        }

        if (readingAttempts >= MAX_ATTEMPTS) {
            clearInterval(readingInterval);
            console.error("Timeout waiting for Reading content.");
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
                    if (typeLabel) {
                        const typeText = typeLabel.innerText;
                        let itemType = null;

                        // Treat Reading as Reading if possible, or fallback
                        if (typeText.includes("Video")) itemType = 'video';
                        else if (typeText.includes("Reading")) itemType = 'reading';

                        if (itemType) {
                            if (itemType === 'video') videoCount++;
                            else if (itemType === 'reading') videoCount++;

                            const titleEl = item.querySelector('.css-u7fh1q');
                            const rawTitle = titleEl ? titleEl.innerText : "Unknown";
                            const linkEl = item.querySelector('a');
                            const href = linkEl ? linkEl.getAttribute('href') : "";

                            if (href) {
                                const modNum = moduleName.match(/\d+/)[0].padStart(2, '0');
                                const vidNum = videoCount.toString().padStart(2, '0');
                                let cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "_").trim();

                                const extension = itemType === 'video' ? '.mp4' : '.pdf';

                                courseData.push({
                                    url: "https://www.coursera.org" + href,
                                    filename: `M${modNum}_${vidNum} - ${cleanTitle}${extension}`,
                                    type: itemType
                                });
                            }
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