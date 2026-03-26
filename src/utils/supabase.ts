import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Mute the specific AuthApiError for invalid refresh tokens that Next.js dev overlay catches
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (
      args[0] &&
      typeof args[0].message === 'string' &&
      args[0].message.includes('Invalid Refresh Token: Refresh Token Not Found')
    ) {
      return; // Suppress this specific error overlay in dev mode
    }
    if (typeof args[0] === 'string' && args[0].includes('Invalid Refresh Token: Refresh Token Not Found')) {
      return;
    }
    originalConsoleError(...args);
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);