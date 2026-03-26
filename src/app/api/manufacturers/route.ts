import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Configuration error: Missing Supabase Admin credentials in .env.local" },
        { status: 500 }
      );
    }

    // Initialize Supabase with the Service Role Key to bypass RLS and access Auth admin API
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch all users to filter by "manufacturer" role stored in user_metadata
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const manufacturers = users
      .filter((u) => u.user_metadata?.role === "manufacturer")
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || u.email,
      }));

    return NextResponse.json({ manufacturers }, { status: 200 });
  } catch (error: any) {
    console.error("Internal Server Error:", error);
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
