"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { Wordmark } from "../../components/Wordmark";
import { Button } from "../../components/Button";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const params = useSearchParams();
  const confirmError = params.get("error") === "confirm";

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();

    if (usePassword) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setState("error");
        setMessage(error.message);
      } else {
        window.location.href = "/";
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 overflow-hidden px-6">
      {/* Volt aurora — pure CSS hero glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 animate-[pulse-glow_6s_ease-in-out_infinite] rounded-full bg-accent/20 blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-56 -right-24 h-80 w-80 rounded-full bg-accent/10 blur-[100px]"
      />

      <header className="relative flex flex-col gap-3">
        <Wordmark size="lg" />
        <p className="text-sm text-muted">Progressive overload, planned.</p>
      </header>

      {state === "sent" ? (
        <div className="relative rounded-card border border-line bg-surface-1/80 p-6 backdrop-blur">
          <p className="text-lg font-semibold">Check your email 📬</p>
          <p className="mt-1 text-sm text-muted">
            Tap the link in the email on this device to sign in.
          </p>
        </div>
      ) : (
        <form
          onSubmit={sendLink}
          className="relative flex flex-col gap-3 rounded-card border border-line bg-surface-1/80 p-5 backdrop-blur"
        >
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-13 rounded-xl bg-surface-2 px-4 py-3.5 outline-none placeholder:text-faint"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {usePassword && (
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              className="h-13 rounded-xl bg-surface-2 px-4 py-3.5 outline-none placeholder:text-faint"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={state === "sending"}
          >
            {state === "sending"
              ? "Signing in…"
              : usePassword
                ? "Sign in"
                : "Send magic link"}
          </Button>
          <button
            type="button"
            className="py-1 text-xs text-faint underline underline-offset-2"
            onClick={() => setUsePassword((v) => !v)}
          >
            {usePassword ? "Use magic link instead" : "Use password instead"}
          </button>
          {confirmError && (
            <p className="text-sm text-danger">
              That link expired or was already used — send a new one.
            </p>
          )}
          {state === "error" && (
            <p className="text-sm text-danger">{message}</p>
          )}
        </form>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
