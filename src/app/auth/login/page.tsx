'use client';

import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { supabase } from '@/utils/supabase';
// Assuming @heroicons/react is installed for clean, professional icons
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'; 

type Inputs = {
  email: string;
  password: string;
};

// Define the primary medical brand color for easy reuse
const PRIMARY_COLOR = '#00A389'; // Muted Blue-Green / Teal

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const router = useRouter();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword(data);
    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    // Clean, light background for a professional look
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="p-8 bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-sm">
        <h2 className="text-3xl font-semibold text-gray-800 text-center mb-8">
          Welcome Back
        </h2>
        {/* Styled error message with soft border */}
        {error && (
          <div className="bg-red-100 text-red-700 text-sm py-3 px-4 rounded-lg mb-6 border border-red-200">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-5">
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="email">
              Email Address
            </label>
            <input
              // Professional input styling with focus ring matching brand color
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[${PRIMARY_COLOR}] focus:border-transparent transition-all duration-200"
              id="email"
              type="email"
              placeholder="you@hospital.com"
              {...register("email", { required: true })}
            />
            {errors.email && <span className="text-red-500 text-xs mt-1 block">Email is required</span>}
          </div>
          <div className="mb-6 relative">
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="password">
              Password
            </label>
            <input
              // Input styling, with extra padding on the right for the toggle button
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[${PRIMARY_COLOR}] focus:border-transparent transition-all duration-200 pr-10"
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              {...register("password", { required: true })}
            />
            {/* Show/Hide Password Toggle Button */}
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
            {errors.password && <span className="text-red-500 text-xs mt-1 block">Password is required</span>}
          </div>
          
          <div className="flex flex-col items-center justify-between mt-4">
            <button
              // Solid, professional button using the brand color
              style={{ backgroundColor: PRIMARY_COLOR }}
              className="w-full hover:opacity-90 text-white font-semibold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[${PRIMARY_COLOR}] transition-colors duration-200"
              type="submit"
            >
              Sign In
            </button>
            
            <p className="text-center text-gray-500 text-sm mt-6">
              Need an account?{' '}
              <a 
                className="font-medium hover:opacity-80 transition-colors duration-200" 
                style={{ color: PRIMARY_COLOR }}
                href="/auth/signup"
              >
                Sign Up
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}