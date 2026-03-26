import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

// CORS configuration for local network and PWA access
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

// Define the schema for structured JSON output
const DrugInfoSchema = {
    type: "object",
    properties: {
        description: {
            type: "string",
            description: "A brief, 3-sentence description of the drug."
        },
        use_cases: {
            type: "array",
            items: { type: "string" },
            description: "List the primary conditions this drug treats."
        },
        generic_alternative: {
            type: "string",
            description: "The main generic (chemical) alternative name for the drug, e.g., 'Paracetamol'."
        },
        warnings: {
            type: "string",
            description: "One short, critical warning about the drug."
        }
    },
    required: ["description", "use_cases", "generic_alternative", "warnings"]
};

export async function POST(request: Request) {
    try {
        const { drugName, action } = await request.json();

        if (!drugName) {
            return NextResponse.json({ error: 'Drug name is required' }, { status: 400, headers: corsHeaders });
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY not configured.' }, { status: 500, headers: corsHeaders });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        if (action === "getAlternatives") {
            const prompt = `
You are a pharmaceutical expert system.
Given the following medicine name: "${drugName}", provide its generic alternatives, purpose, and precautions.
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
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });

            const text = response.text || "";
            // Clean potential markdown from response
            const cleanJson = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            
            return NextResponse.json(JSON.parse(cleanJson), { headers: corsHeaders });
        }

        // Default DrugInfo logic
        const prompt = `Analyze the drug '${drugName}'. Provide its description, primary uses, and its main generic alternative. Ensure the output strictly follows the provided JSON schema.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: DrugInfoSchema,
            }
        });

        if (!response.text) {
            throw new Error('No response text received from Gemini API.');
        }
        const jsonText = response.text.trim();
        const drugInfo = JSON.parse(jsonText);

        return NextResponse.json(drugInfo, { headers: corsHeaders });

    } catch (error) {
        console.error('Gemini API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch AI data.' }, { status: 500, headers: corsHeaders });
    }
}