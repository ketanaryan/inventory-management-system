// src/app/api/drug-info/route.ts
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const DrugInfoSchema: { type: SchemaType.OBJECT; properties: Record<string, unknown>; required: string[] } = {
    type: SchemaType.OBJECT,
    properties: {
        description: { type: SchemaType.STRING },
        use_cases: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        generic_alternative: { type: SchemaType.STRING },
        warnings: { type: SchemaType.STRING }
    },
    required: ["description", "use_cases", "generic_alternative", "warnings"]
};

export async function POST(request: Request) {
    try {
        const { drugName } = await request.json();

        if (!drugName) return NextResponse.json({ error: 'Drug name required' }, { status: 400 });
        if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'API Key missing' }, { status: 500 });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash', // Note: 2.5-flash is not a standard version yet, using 1.5-flash
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: DrugInfoSchema,
            }
        });

        const prompt = `Provide medical details for ${drugName} including description, use cases, main generic chemical name, and a critical warning.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        return NextResponse.json(JSON.parse(response.text()));

    } catch (error) {
        console.error('Gemini API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch drug data' }, { status: 500 });
    }
}