import { supabase } from "@/utils/supabase";

export async function requireRole(expectedRole: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { redirect: "/auth/login" };

  const role = user.user_metadata?.role;

  if (role !== expectedRole) {
    return { redirect: "/dashboard" };
  }

  return { user };
}