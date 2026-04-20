"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SitePasswordPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/site-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.href = next;
    } else {
      setError("Wrong password. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#fefcfa] px-5 dark:bg-[#0f1115]">
      <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#141920]">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-white">H</span>
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-[#1a2634] dark:text-[#eef2f5]">
            Dev site access
          </h1>
          <p className="mt-2 text-sm text-[#5d6876] dark:text-[#aab3bf]">
            This environment is password-protected.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-black/10 bg-[#faf8f5] px-4 py-2.5 text-sm text-foreground placeholder:text-[#9ba5b0] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-white/10 dark:bg-[#101318] dark:placeholder:text-[#666]"
            />
          </div>

          {error && (
            <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Checking..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
