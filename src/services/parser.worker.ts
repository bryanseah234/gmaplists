/// <reference lib="webworker" />

import { parseApiJson } from './apiParserService';
import { parseMapData } from './parserService';

self.onmessage = async (event: MessageEvent) => {
  const { action, payload } = event.data;
  
  if (action === 'PARSE') {
    try {
      const { rawData, sourceUrl, isJson, meta } = payload;
      let result = null;
      
      if (isJson) {
        result = parseApiJson(rawData, meta);
      } else {
        result = await parseMapData(rawData, sourceUrl);
      }
      
      if (result && result.places.length > 0) {
        self.postMessage({ action: 'PARSE_COMPLETE', data: result });
      } else {
        self.postMessage({ action: 'PARSE_ERROR', error: "Failed to parse list. It might be empty or the format has changed." });
      }
    } catch (e: any) {
      console.error("Worker parse error:", e);
      self.postMessage({ action: 'PARSE_ERROR', error: `Error parsing list: ${e.message}` });
    }
  }
};
