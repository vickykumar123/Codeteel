"use client";

import { useState, Suspense } from "react";
import { createBrowserClient } from "@/lib/db/client";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const supabase = createBrowserClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = redirect;
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email first");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?redirect=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Check your email for the password reset link!");
    setLoading(false);
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("Please enter your email");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Check your email for the login link!");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0C0A09]">
      {/* Nav — same as landing */}
      <nav className="max-w-6xl mx-auto px-5 sm:px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="Codeteel" width={32} height={32} />
          <span className="text-lg font-semibold text-[#FAFAF9] tracking-tight">Codeteel</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/docs" className="text-sm text-[#A8A29E] hover:text-[#FAFAF9] transition-colors">Docs</Link>
          <Link
            href="/signup"
            className="text-sm px-4 sm:px-5 py-2 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex items-center justify-center px-4 pt-8 sm:pt-16 pb-16">
        {/* Background glow */}
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-[#E8A87C] opacity-[0.04] blur-[150px] rounded-full pointer-events-none" />

        <div className="relative w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#FAFAF9]">Welcome back</h1>
            <p className="mt-1.5 text-sm text-[#A8A29E]">Sign in to your account</p>
          </div>

          {/* Card */}
          <div className="bg-[#1C1917] border border-[#292524] rounded-2xl p-6 sm:p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {message && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl text-sm">
                  {message}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#A8A29E] mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0C0A09] border border-[#292524] rounded-xl text-[#FAFAF9] placeholder-[#44403C] text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A87C]/40 focus:border-[#E8A87C]/40 transition-all"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#A8A29E] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-11 bg-[#0C0A09] border border-[#292524] rounded-xl text-[#FAFAF9] placeholder-[#44403C] text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A87C]/40 focus:border-[#E8A87C]/40 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#44403C] hover:text-[#A8A29E] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOffIcon className="w-4.5 h-4.5" /> : <EyeIcon className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs text-[#E8A87C] hover:text-[#F5D5C3] transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#E8A87C] to-[#C9A96E] text-[#0C0A09] font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#E8A87C]/10"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#292524]" />
                <span className="text-xs text-[#44403C]">or</span>
                <div className="flex-1 h-px bg-[#292524]" />
              </div>

              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading || !email}
                className="w-full py-2.5 px-4 bg-[#0C0A09] border border-[#292524] text-[#FAFAF9] font-medium rounded-xl text-sm hover:bg-[#292524] hover:border-[#3F3F46] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Magic Link
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-[#A8A29E]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#E8A87C] hover:text-[#F5D5C3] font-medium transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
