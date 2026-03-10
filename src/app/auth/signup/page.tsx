"use client";

import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { useState } from "react";
import { supabase } from "@/utils/supabase";

type Inputs = {
  email: string;
  password: string;
  role: "manufacturer" | "hospital" | "consumer";
};

export default function SignupPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setError(null);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          role: data.role,
        },
      },
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative">
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none z-0" />
      <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none z-0" />

      <div className="glass-panel p-10 rounded-3xl shadow-2xl border border-border relative z-10 w-full max-w-md mx-4 animate-fade-in overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center text-white font-bold mb-4 shadow-lg shadow-primary/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-activity"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.48 12H2"/></svg>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Register Account
          </h2>
          <p className="text-sm text-muted-foreground mt-2">Join the secure medicine verification network</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-3 bg-red-500/10 text-red-400 border border-red-500/20 relative z-10 animate-slide-up">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 relative z-10">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider" htmlFor="email">
              Email Address
            </label>
            <input
              className="w-full px-5 py-4 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground placeholder:text-muted-foreground"
              id="email"
              type="email"
              placeholder="user@example.com"
              {...register("email", { required: true })}
            />
            {errors.email && <span className="text-red-400 text-xs mt-2 block font-medium">Email is required</span>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider" htmlFor="password">
              Password
            </label>
            <input
              className="w-full px-5 py-4 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground placeholder:text-muted-foreground"
              id="password"
              type="password"
              placeholder="••••••••"
              {...register("password", { required: true })}
            />
            {errors.password && <span className="text-red-400 text-xs mt-2 block font-medium">Password is required</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Account Type (Role)
            </label>
            <div className="relative">
              <select
                className="w-full px-5 py-4 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground appearance-none"
                {...register("role", { required: true })}
                defaultValue=""
              >
                <option value="" disabled className="text-muted-foreground">Select your role</option>
                <option value="manufacturer">Medicine Manufacturer</option>
                <option value="hospital">Hospital / Healthcare Provider</option>
                <option value="consumer">End Consumer / Patient</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-muted-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
            {errors.role && <span className="text-red-400 text-xs mt-2 block font-medium">Role selection is required</span>}
          </div>

          <button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-4 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] tracking-wide mt-4 relative overflow-hidden group"
            type="submit"
          >
            <span className="relative z-10">Create Account</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>
          
          <div className="text-center mt-6">
            <span className="text-sm text-muted-foreground">Already have an account? </span>
            <a className="font-semibold text-primary hover:text-primary/80 transition-colors" href="/auth/login">
              Sign In
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}