import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client. It will automatically use the GEMINI_API_KEY environment variable.
// We initialize it inside the handler to prevent Next.js build-time errors if the key is missing.

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { insights: ["System Notice: GEMINI_API_KEY not configured. AI capabilities are offline.", "Please add your API key to environment variables to enable Smart Insights."] },
        { status: 200 }
      );
    }

    const ai = new GoogleGenAI({});
    const { inventoryData } = await req.json();

    const prompt = `You are an expert pharmaceutical supply chain AI assistant named PharmaDash AI.
    Analyze the following inventory data and provide exactly 3 actionable insights (e.g., expiry risks, production trends, recall patterns).
    Keep each insight extremely concise, professional, and maximum 1 sentence long. 
    Format your response as a valid JSON array of strings. Do not add any markdown formatting.
    
    Data snippet:
    ${JSON.stringify(inventoryData).substring(0, 1500)} // truncate to prevent huge requests
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text from Gemini");
    }

    // Extract JSON array robustly
    const match = text.match(/\[[\s\S]*\]/);
    let insights = [];
    if (match) {
      insights = JSON.parse(match[0]);
    } else {
      // Fallback if parsing fails
      insights = ["AI generated a response but format was invalid.", "Please review the raw data logs.", "Try regenerating insights."];
    }

    return NextResponse.json({ insights });
  } catch (error: any) {
    console.error("AI Insights Error:", error);
    return NextResponse.json(
      { insights: ["AI Service Error: " + error.message, "Failed to connect to secure AI node.", "Retrying later..."] },
      { status: 200 } 
    );
  }
}
