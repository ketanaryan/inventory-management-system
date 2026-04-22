const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match[1].trim();

const ai = new GoogleGenAI({ apiKey });

const prompt = `You are a pharmaceutical expert system.
Given the medicine: "dolo", provide its generic alternatives, purpose, and precautions.
Return strictly as JSON with this exact structure:
{
  "name": "Original Medicine Name",
  "genericName": "Generic Name(s)",
  "purpose": "Brief description of what it is used for",
  "alternatives": [
    { "name": "Alternative Name 1", "manufacturer": "Manufacturer 1" }
  ],
  "precautions": ["Precaution 1", "Precaution 2"]
}
Limit alternatives to 5 items. Valid JSON only. No markdown.`;

ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
}).then(res => {
  console.log(res.text);
}).catch(err => {
  console.error("SDK ERROR:", err);
});
