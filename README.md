# MapList

MapList is a modern, privacy-focused web application designed to help you extract, visualize, and organize your saved Google Maps lists. It overcomes the limitations of the Google Maps "View" interface by turning your saved places into a sortable, filterable database.

## 🚀 Features

### 1. Smart Extraction (No API Key Required)
Google Maps does not provide an API to read your saved lists. MapList solves this using a clever **"Bookmarklet"** approach:
- **Client-Side Automation:** A small JavaScript tool runs safely in your browser to auto-scroll your Google Maps list (handling the "lazy loading" problem).
- **Clipboard Integration:** It automatically selects and copies the loaded data.
- **AI Parsing:** The application uses advanced AI (Gemini 2.5 Flash) to parse the unstructured raw text from your clipboard into clean JSON data.

### 2. Powerful Organization
Once extracted, your places are presented in a clean, Apple-style grid interface with features Google Maps lacks:
- **Filtering:** Filter by Category (Cafe, Restaurant, Park) or Accessibility (Wheelchair friendly).
- **Sorting:** Sort by Rating, Review Count (Popularity), or Price.
- **Search:** (Implicit via filters) Quickly narrow down 1000+ places to find exactly what you want.

### 3. Modern UI/UX
- **Dark Mode:** Fully supported system, light, and dark themes.
- **Responsive:** Works beautifully on desktop and tablet sizes.
- **Privacy:** All data processing happens via the API request; no personal data is stored on our servers.

## 🛠 Tech Stack

- **Frontend:** React 19, TypeScript
- **Styling:** Tailwind CSS (with `dark:class` support)
- **Icons:** Lucide React
- **AI/Backend Logic:** Google GenAI SDK (`@google/genai`) running Gemini 2.5 Flash
- **Build Tool:** Vite (implied environment)

## 📖 How to Use

1.  **Open the App:** Navigate to the MapList homepage.
2.  **Install the Scroller:** Drag the "MapList Scroller" button to your browser's bookmarks bar.
3.  **Go to Google Maps:** Open the shared/saved list you want to analyze in a new tab.
4.  **Run the Scroller:** Click the bookmark. It will automatically scroll to the bottom of the list to load all items and copy the text to your clipboard.
5.  **Paste & Visualize:** Come back to MapList, paste the text into the box, and click "Process List".

## 🎨 Theme Support

Toggle between Light, Dark, and System modes using the controls in the top-right corner. The app automatically respects your operating system's preference by default.
