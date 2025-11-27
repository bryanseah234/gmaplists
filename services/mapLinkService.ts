

/**
 * Service to extract the Google Maps List ID to generate a "Clean View" URL.
 * This URL (google.com/local/userlists/list/<ID>) is much easier to scrape.
 */

// Regex patterns to find the List ID
const ID_PATTERNS = [
  /list\/([a-zA-Z0-9_-]+)/,       // direct URL path
  /!2s([a-zA-Z0-9_-]+)!/,         // data parameter in URL
  /\[null,"([a-zA-Z0-9_-]+)",3\]/ // JSON in HTML source (APP_INITIALIZATION_STATE)
];

export const getCleanListUrl = async (inputUrl: string): Promise<string | null> => {
  try {
    // If it is already a clean URL, return null (no need to optimize) or return it normalized?
    // We should return null if the input is ALREADY clean so the UI doesn't say "Optimized view found" when the user provided it.
    if (inputUrl.includes('/local/userlists/list/')) {
      return null; 
    }

    let contentToCheck = inputUrl;

    // 1. Check raw URL first (fastest)
    for (const pattern of ID_PATTERNS) {
      const match = inputUrl.match(pattern);
      if (match && match[1] && match[1].length > 10) { // basic sanity check on length
        return `https://www.google.com/local/userlists/list/${match[1]}`;
      }
    }

    // 2. If short link or no ID found, try to fetch via CORS proxy
    // This allows us to expand redirects or get the HTML source where the ID might be hidden
    if (inputUrl.includes('goo.gl') || inputUrl.includes('maps.app.goo.gl') || inputUrl.includes('google.com')) {
      try {
        // Using allorigins as a CORS proxy
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(inputUrl)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if (data && data.contents) {
          contentToCheck = data.contents;
          
          // Check the fetched content (HTML or expanded URL) for the ID
          for (const pattern of ID_PATTERNS) {
            const match = contentToCheck.match(pattern);
            if (match && match[1] && match[1].length > 10) {
              return `https://www.google.com/local/userlists/list/${match[1]}`;
            }
          }
        }
      } catch (proxyError) {
        console.warn("Proxy fetch failed, falling back to original URL", proxyError);
      }
    }

    return null;
  } catch (e) {
    console.error("Error extracting List ID:", e);
    return null;
  }
};
