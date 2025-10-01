'use client';

import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'; // Assumes you have @heroicons/react installed

type Inputs = {
  email: string;
  password: string;
};

export default function SignupPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setError(null);
    const { error } = await supabase.auth.signUp(data);
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
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-sm">
        <h2 className="text-3xl font-semibold text-gray-800 text-center mb-8">
          Sign Up
        </h2>
        {error && (
          <div className="bg-red-100 text-red-700 text-sm py-3 px-4 rounded-md mb-6 border border-red-200">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-5">
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="email">
              Email Address
            </label>
            <input
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00A389] focus:border-transparent transition-all duration-200"
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register("email", { required: true })}
            />
            {errors.email && <span className="text-red-500 text-xs mt-1 block">Email is required</span>}
          </div>
          <div className="mb-6 relative">
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="password">
              Password
            </label>
            <input
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00A389] focus:border-transparent transition-all duration-200 pr-10"
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              {...register("password", { required: true })}
            />
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
          <button
            className="w-full bg-[#00A389] hover:bg-[#008F7A] text-white font-semibold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00A389] focus:ring-offset-2 transition-colors duration-200"
            type="submit"
          >
            Sign Up
          </button>
          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <a className="font-medium text-[#00A389] hover:text-[#008F7A] transition-colors duration-200" href="/auth/login">
              Log In
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}