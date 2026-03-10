"use server";

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export async function getMedicineAlternatives(medicineName: string) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are a pharmaceutical expert system.
Given the following medicine name: "${medicineName}", provide its generic alternatives, purpose, and precautions.
Return the response strictly as a JSON object with this exact structure:
{
  "name": "Original Medicine Name",
  "genericName": "Generic Name(s)",
  "purpose": "A brief description of what it is used for",
  "alternatives": [
    { "name": "Alternative Name 1", "manufacturer": "Manufacturer 1" },
    { "name": "Alternative Name 2", "manufacturer": "Manufacturer 2" }
  ],
  "precautions": ["Precaution 1", "Precaution 2"]
}
Limit alternatives to maximum 5 items.
Ensure the response is valid JSON and nothing else. No markdown formatting like \`\`\`json.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    // Clean potential markdown from response
    const cleanJson = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error fetching alternatives from Gemini:", error);
    throw new Error("Failed to fetch medicine alternatives: " + (error instanceof Error ? error.message : String(error)));
  }
}
