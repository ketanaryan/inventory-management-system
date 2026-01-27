'use client';

import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { supabase } from '@/utils/supabase';

type Inputs = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
  setError(null);

  const { data: authData, error } =
    await supabase.auth.signInWithPassword(data);

  if (error) {
    setError(error.message);
    return;
  }

  const role = authData.user?.user_metadata?.role;

  if (role === "manufacturer") router.push("/dashboard/manufacturer");
  else if (role === "hospital") router.push("/dashboard/hospital");
  else if (role === "consumer") router.push("/dashboard/consumer");
  else router.push("/dashboard");
};



  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-sky-250 via-blue-300 to-indigo-300">

     <div className="
  bg-white/95
  backdrop-blur-xl
  p-10
  rounded-2xl
  shadow-[0_25px_60px_rgba(0,0,0,0.22)]
  border border-white/50
  transform
  transition-all
  duration-300
  hover:-translate-y-1
  hover:shadow-[0_40px_90px_rgba(0,0,0,0.30)]
  animate-[fadeInUp_0.6s_ease-out]
 ">


        <h2 className="text-3xl font-extrabold text-center mb-6 text-blue-600">
  Login
</h2>



        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="email"
              type="email"
              placeholder="Email"
              {...register("email", { required: true })}
            />
            {errors.email && <span className="text-red-500 text-sm mt-1">Email is required</span>}
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              id="password"
              type="password"
              placeholder="Password"
              {...register("password", { required: true })}
            />
            {errors.password && <span className="text-red-500 text-sm mt-1">Password is required</span>}
          </div>
          <div className="flex items-center justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transform transition-all duration-200"
              type="submit"
            >
              Sign In
            </button>
            <a className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800" href="/auth/signup">
              Sign Up
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}