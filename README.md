# Coursera Video Downloader

A Chrome Extension to download Coursera course videos in bulk/concurrently.

## Features

- **Automated Scanning**: Scans the current course page to identify video modules and names.
- **Concurrent Downloads**: Supports downloading multiple videos at once (configurable from 1 to 5).
- **Auto-Navigation**: Automatically moves to the next video page to grab the source URL if needed.
- **Filename Cleaning**: Renames files to `ModuleName_VideoName.mp4` format using the actual lesson titles.
- **Queue Management**: Pause, Stop, and Rescan capabilities.

## Installation

Since this extension is not on the Chrome Web Store, you must install it in **Developer Mode**.

1.  Clone or Download this repository to a folder on your computer.
2.  Open **Google Chrome** (or Edge/Brave).
3.  Navigate to `chrome://extensions`.
4.  Toggle **Developer Mode** (top right corner) to **ON**.
5.  Click **Load unpacked**.
6.  Select the folder where you saved these files.

## How to Use

1.  **Login** to Coursera and go to the "Course Content" page (the main week-by-week view where all modules are listed).
2.  **Open Extension**: Click the extension icon in your toolbar.
3.  **Expand Modules**:
    - **Important**: Manually click to expand the weeks/modules on the Coursera page so all video links are visible in the DOM.
4.  **Click "Scan Course"** (Button 1):
    - The extension will list how many videos it found.
5.  **Select Concurrency**: Enter how many downloads you want at once (default is 1).
6.  **Click "Start Download"** (Button 2):
    - The extension will begin downloading files.
    - **Note**: It may open tabs briefly to grab the secure video Source URL if it wasn't available on the main page. This is normal.
7.  **Status**: The popup will show progress (e.g., "Video 5 / 50").

## Troubleshooting

- **"Scanning..." stuck?**
    - Make sure you are on the actual course home page (e.g., `coursera.org/learn/course-name/home/week/1`).
    - Refresh the page and try again.
- **Titles are "Unknown"?**
    - The extension attempts to fix this by briefly visiting the video page to scrape the `<h1>` title.
- **Downloads blocked?**
    - Chrome may ask for permission to download multiple files. Click "Allow".

## Disclaimer

**Educational Purpose Only.**
This tool is intended for personal archiving of courses you have legally enrolled in, for offline viewing (e.g., traveling without internet). Do not distribute downloaded content. Use responsibly and in accordance with Coursera's Terms of Service.
