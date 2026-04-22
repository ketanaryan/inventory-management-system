import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Allowed actions — strict whitelist to prevent injection via `action` field
const ALLOWED_ACTIONS = new Set(['getAlternatives', 'getDrugInfo']);

// Max drug name length to prevent prompt injection attempts
const MAX_DRUG_NAME_LENGTH = 100;

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  // 1. Rate limiting — 15 requests per minute per IP
  const ip = getClientIp(request);
  const { ok, remaining } = rateLimit(ip, 15, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429, headers: { ...corsHeaders, 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const body = await request.json();
    const { drugName, action } = body;

    // 2. Input validation
    if (!drugName || typeof drugName !== 'string') {
      return NextResponse.json({ error: 'Drug name is required' }, { status: 400, headers: corsHeaders });
    }

    // Sanitize: strip control characters and limit length
    const cleanDrugName = drugName.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, MAX_DRUG_NAME_LENGTH);
    if (!cleanDrugName) {
      return NextResponse.json({ error: 'Invalid drug name' }, { status: 400, headers: corsHeaders });
    }

    // 3. Whitelist action values to prevent injection
    if (action && !ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured.' }, { status: 500, headers: corsHeaders });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    if (action === 'getAlternatives') {
      // Use a fixed template — drug name is inserted as a value, not as instructions
      const prompt = `You are a pharmaceutical expert system.
Given the medicine: "${cleanDrugName}", provide its generic alternatives, purpose, and precautions.
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

      let response;
      for (let i = 0; i < 3; i++) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-04-17',
            contents: prompt,
          });
          break;
        } catch (e) {
          if (i === 2) throw e;
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      const text = response?.text || '';
      const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch {
        return NextResponse.json({ error: 'AI returned invalid format. Please try again.' }, { status: 502, headers: corsHeaders });
      }

      return NextResponse.json(parsed, {
        headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(remaining) }
      });
    }

    // Default: getDrugInfo
    const prompt = `Analyze the drug "${cleanDrugName}". Provide its description, primary uses, and its main generic alternative. Output valid JSON only matching: { "description": "...", "use_cases": ["..."], "generic_alternative": "...", "warnings": "..." }`;

    let response;
    for (let i = 0; i < 3; i++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-04-17',
          contents: prompt,
        });
        break;
      } catch (e) {
        if (i === 2) throw e;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!response?.text) throw new Error('No response text received.');

    let drugInfo;
    try {
      const cleanText = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      drugInfo = JSON.parse(cleanText);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid format. Please try again.' }, { status: 502, headers: corsHeaders });
    }

    return NextResponse.json(drugInfo, {
      headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(remaining) }
    });

  } catch (error: any) {
    console.error('Drug-info API Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch AI data. Please try again.' }, { status: 500, headers: corsHeaders });
  }
}