"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await signIn("credentials", {
      email: email.trim(),
      name: name.trim() || undefined,
      callbackUrl,
    });
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "hsl(var(--izam-primary))" }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: "hsl(var(--izam-accent))" }}
        />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="glass-card p-8 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative w-20 h-20">
              <Image
                src="/izam.webp"
                alt="izam logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground mb-1">
            izam TM
          </h1>
          <p className="text-foreground-secondary text-sm mb-8">
            Traceability Matrix Management System
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                {error === "AccessDenied"
                  ? "Access denied. Only @izam.co emails are allowed."
                  : error === "CredentialsSignin"
                  ? "Invalid credentials. Please try again."
                  : "An error occurred. Please try again."}
              </p>
            </div>
          )}

          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-3 mb-6">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="input w-full text-center"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="input w-full text-center"
              required
            />
            <button
              type="submit"
              disabled={!email.trim() || loading}
              className="btn btn-primary w-full py-3 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background-secondary px-3 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="btn w-full py-3 bg-background-secondary border border-border hover:bg-muted transition-all duration-200 group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="text-foreground font-medium">
              Sign in with Google
            </span>
          </button>

          <p className="text-xs text-muted-foreground mt-6">
            Only <span className="font-medium">@izam.co</span> emails are
            allowed
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          © {new Date().getFullYear()} izam. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
