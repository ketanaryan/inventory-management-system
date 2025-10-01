// src/app/api/drug-info/route.ts
import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

// Initialize Gemini (key is safely read from server environment)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
        const { drugName } = await request.json();

        if (!drugName) {
            return NextResponse.json({ error: 'Drug name is required' }, { status: 400 });
        }

        const prompt = `Analyze the drug '${drugName}'. Provide its description, primary uses, and its main generic alternative. Ensure the output strictly follows the provided JSON schema.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: DrugInfoSchema,
            }
        });

        // The response text will be a JSON string adhering to DrugInfoSchema
        if (!response.text) {
            throw new Error('No response text received from Gemini API.');
        }
        const jsonText = response.text.trim();
        const drugInfo = JSON.parse(jsonText);

        return NextResponse.json(drugInfo);

    } catch (error) {
        console.error('Gemini API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch drug data from AI service.' }, { status: 500 });
    }
}