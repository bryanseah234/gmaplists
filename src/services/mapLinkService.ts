
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
    // If it is already a clean URL, return null (no need to optimize)
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

    // 2. Short links (goo.gl etc.) require expansion which cannot be done purely client-side
    // without a CORS proxy. For security and privacy, we no longer use a public proxy.
    // We rely solely on the regex matches above. If they fail, we return null.


    return null;
  } catch (e) {
    console.error("Error extracting List ID:", e);
    return null;
  }
};
