import { ExtractedData } from "../types";

/**
 * DEPRECATED: This service has been replaced by parserService.ts
 * Keeping file structure but removing logic to prevent build errors.
 */
export const extractMapData = async (
  input: string
): Promise<ExtractedData> => {
  throw new Error("AI Extraction is disabled. Please use the client-side parser.");
};