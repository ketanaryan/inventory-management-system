'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // User is authenticated, redirect to the dashboard
        router.push('/dashboard');
      } else {
        // User is not authenticated, redirect to the login page
        router.push('/auth/login');
      }
    };

    checkUser();
  }, [router]);

  // Show a loading state while checking the user's session
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Loading...</p>
    </div>
  );
}