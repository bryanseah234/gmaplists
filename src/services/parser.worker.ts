/// <reference lib="webworker" />

import { parseApiJson } from './apiParserService';

self.onmessage = async (event: MessageEvent) => {
  const { action, payload } = event.data;
  
  if (action === 'PARSE') {
    try {
      const { rawData, isJson, meta } = payload;
      if (!isJson) throw new Error("Only captured getlist JSON is supported.");
      const result = parseApiJson(rawData, meta);
      
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
