# MapList

MapList is a powerful, privacy-focused web application designed to transform your saved map lists into a structured, sortable, and filterable database. It overcomes the interface limitations of standard map views by turning your scattered pins into a clean, spreadsheet-like grid.

## ✨ Features

### 1. Smart Extraction
MapList utilizes a custom **JavaScript Bookmarklet** to bridge the gap between the map interface and your data.
- **Auto-Scroll & Capture:** The bookmarklet intelligently scrolls through lazy-loaded lists to capture every single place.
- **Metadata Extraction:** Extracts ratings, review counts, price tiers (`$`, `$$`), and category tags.
- **Clean Links:** Automatically resolves and preserves deep links to specific locations.

### 2. Instant Parsing (Client-Side)
Unlike other tools that rely on heavy server-side scraping or expensive APIs, MapList uses a robust **Regex-based Parsing Engine** running entirely in your browser.
- **Zero Latency:** Processing 1,000+ places happens in milliseconds.
- **Privacy First:** Your data never leaves your device. No API keys required.
- **Smart Categorization:** Automatically buckets places into **Food**, **Drink**, **See**, and **Shop** based on intelligent keyword matching.

### 3. Powerful Organization
- **Filtering:** Instantly toggle between categories (e.g., "Show only Drink spots").
- **Sorting:** Rank places by Popularity (Review Count), Quality (Rating), or Price.
- **Export:** Download your curated list as a **CSV** file or copy it formatted for **Spreadsheets** with one click.

### 4. Premium UI/UX
- **Apple-Style Aesthetic:** Designed with a focus on clarity, typography, and glassmorphism effects.
- **Dark Mode:** Fully responsive theme support (System, Light, Dark).
- **Responsive:** Works seamlessly across desktops and tablets.

## 🛠️ Tech Stack

*   **Framework:** React 18+
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **Icons:** Lucide React
*   **Build Tool:** Vite
*   **Deployment:** Ready for Vercel / Netlify / Static Hosting

## 📖 How to Use

1.  **Launch MapList:** Open the application in your browser.
2.  **Install the Extractor:** Drag the "Extractor" button from the dashboard to your browser's bookmarks bar.
3.  **Open Your List:** Navigate to the shared/saved map list you want to organize in a new tab.
4.  **Run Extraction:** Click the bookmarklet. It will auto-scroll the list and present a "Copy" panel when finished.
5.  **Process:** Paste the copied text into MapList and watch your data transform instantly.

## 🚀 Deployment

This project is configured as a standard Vite application.

### Local Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
# The output will be in the /dist folder, ready to be served statically.
```
