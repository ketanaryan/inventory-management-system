import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  // 1. Rate limit — 30 requests per minute per IP
  const ip = getClientIp(req);
  const { ok } = rateLimit(ip, 30, 60_000);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: corsHeaders }
    );
  }

  // 2. Auth check — only authenticated users can list manufacturers
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    // 3. Verify the user's session token is valid before serving data
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // 4. Only dealers can request the manufacturer list
    const role = user.user_metadata?.role;
    if (role !== "dealer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }

    // 5. Use Admin client (service role) to list users — server-only, never exposed to client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error("Error fetching users:", error.message);
      return NextResponse.json({ error: "Failed to fetch manufacturers." }, { status: 400, headers: corsHeaders });
    }

    // 6. Return only the minimal needed fields — no passwords, tokens, or raw metadata
    const manufacturers = users
      .filter((u) => u.user_metadata?.role === "manufacturer")
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || u.email,
      }));

    return NextResponse.json({ manufacturers }, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error("Manufacturers API Error:", error.message);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500, headers: corsHeaders }
    );
  }
}
