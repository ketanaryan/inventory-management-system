import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { createClient } from '@supabase/supabase-js';

// --- CORS: Restrict to your own origin in production ---
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  // 1. Rate limiting — 10 AI calls per minute per IP
  const ip = getClientIp(req);
  const { ok, remaining } = rateLimit(ip, 10, 60_000);
  if (!ok) {
    return NextResponse.json(
      { insights: ["Rate limit exceeded. Please wait before generating more insights."] },
      { status: 429, headers: { ...corsHeaders, 'X-RateLimit-Remaining': '0' } }
    );
  }

  // 2. Auth check — only logged-in users can call this endpoint
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { insights: ["System Notice: GEMINI_API_KEY not configured. AI capabilities are offline."] },
        { status: 200, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const { inventoryData } = body;

    // 3. Input size sanity check — reject suspiciously large payloads
    const dataStr = JSON.stringify(inventoryData || []);
    if (dataStr.length > 20_000) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: corsHeaders });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are an expert pharmaceutical supply chain AI assistant named PharmaDash AI.
    Analyze the following inventory data and provide exactly 3 actionable insights (e.g., expiry risks, production trends, recall patterns).
    Keep each insight extremely concise, professional, and maximum 1 sentence long.
    Format your response as a valid JSON array of strings. Do not add any markdown formatting.
    
    Data snippet:
    ${dataStr.substring(0, 3000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text;
    if (!text) throw new Error("No response text from Gemini");

    const match = text.match(/\[[\s\S]*\]/);
    let insights = [];
    if (match) {
      insights = JSON.parse(match[0]);
    } else {
      insights = ["AI generated a response but format was invalid. Please try again."];
    }

    return NextResponse.json(
      { insights },
      { status: 200, headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (error: any) {
    console.error("AI Insights Error:", error.message);
    return NextResponse.json(
      { insights: ["AI Service temporarily unavailable. Please try again later."] },
      { status: 200, headers: corsHeaders }
    );
  }
}
