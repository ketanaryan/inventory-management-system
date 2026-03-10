"use client";

import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { useState } from "react";
import { supabase } from "@/utils/supabase";
import { Activity, Mail, Lock, LogIn, ArrowRight } from "lucide-react";

type Inputs = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setError(null);
    setIsLoading(true);

    const { data: authData, error } = await supabase.auth.signInWithPassword(data);

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    const role = authData.user?.user_metadata?.role;

    if (role === "manufacturer") router.push("/dashboard/manufacturer");
    else if (role === "hospital") router.push("/dashboard/hospital");
    else if (role === "consumer") router.push("/dashboard/consumer");
    else router.push("/dashboard");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in p-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-primary rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">PharmaDash</h2>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-2">Node Authentication</p>
        </div>

        <div className="glass-panel p-8 rounded-3xl border border-border shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[60px] pointer-events-none" />
          
          <h3 className="text-xl font-bold mb-6 relative z-10">Access Terminal</h3>

          {error && (
            <div className="mb-6 p-4 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 animate-slide-up">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative z-10">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2" htmlFor="email">
                Operator Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  placeholder="name@nexus.com"
                  className="w-full pl-11 pr-4 py-3.5 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground"
                  {...register("email", { required: true })}
                />
                <Mail className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
              {errors.email && <span className="text-red-400 text-xs mt-1 block">Email is required</span>}
            </div>

            <div className="pb-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2" htmlFor="password">
                Passphrase
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3.5 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground"
                  {...register("password", { required: true })}
                />
                <Lock className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
              {errors.password && <span className="text-red-400 text-xs mt-1 block">Password is required</span>}
            </div>

            <button
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-foreground font-medium py-3.5 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] tracking-wide disabled:opacity-50"
              type="submit"
            >
              {isLoading ? (
                <Activity className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" /> Initialize Session
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50 text-center relative z-10">
            <p className="text-sm text-muted-foreground">
              Unregistered Node?{" "}
              <a href="/auth/signup" className="text-primary hover:text-primary/80 font-semibold transition-colors inline-flex items-center gap-1 group">
                Request Access <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}