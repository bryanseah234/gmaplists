import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { ExtractedData } from "../types";

/**
 * Orchestrates the extraction process.
 * Accepts raw text content pasted by the user.
 */
export const extractMapData = async (
  input: string
): Promise<ExtractedData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure it is set in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // RAW TEXT PATH: User pasted content directly
  const sourceLabel = "Source: User pasted text content";
  const contentToProcess = input;

  try {
    // Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { text: sourceLabel },
          { text: `DATA CONTEXT:\n${contentToProcess.substring(0, 900000)}` } 
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini.");

    const parsed = JSON.parse(text) as ExtractedData;
    return parsed;
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw new Error("Failed to parse the data. Ensure the list content is visible in the text you provided.");
  }
};