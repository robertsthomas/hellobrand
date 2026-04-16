"use client";

import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminAuthScreenProps = {
  configured: boolean;
  username: string;
};

export function AdminAuthScreen({ configured, username }: AdminAuthScreenProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configured && password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: configured ? "login" : "setup",
          username,
          password,
          confirmPassword: configured ? undefined : confirmPassword,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Could not continue.");
        return;
      }

      toast.success(payload.message ?? (configured ? "Signed in." : "Admin password created."));
      router.replace("/admin");
      router.refresh();
    } catch {
      setErrorMessage("Could not continue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary px-4 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-md items-center">
        <div className="w-full rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Admin</p>
                <h1 className="text-xl font-semibold">HelloBrand Admin</h1>
              </div>
            </div>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              Back
            </Link>
          </div>

          <div className="mt-6 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {configured ? "Sign in" : "First-time setup"}
            </p>
            <p className="text-sm text-muted-foreground">
              {configured
                ? "Enter the admin password to open the board."
                : "Create the admin password for this environment."}
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">Username:</span>{" "}
            <span className="font-medium text-foreground">{username}</span>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <label htmlFor="admin-password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  autoComplete={configured ? "current-password" : "new-password"}
                  className="pl-9"
                  placeholder={configured ? "Enter password" : "Create password"}
                  required
                />
              </div>
            </div>

            {!configured ? (
              <div className="grid gap-2">
                <label
                  htmlFor="admin-password-confirm"
                  className="text-sm font-medium text-foreground"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="admin-password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                    autoComplete="new-password"
                    className="pl-9"
                    placeholder="Repeat password"
                    required
                  />
                </div>
              </div>
            ) : null}

            <Button type="submit" disabled={isSubmitting} className="mt-2">
              {isSubmitting
                ? configured
                  ? "Signing in..."
                  : "Creating password..."
                : configured
                  ? "Open admin board"
                  : "Create admin access"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
