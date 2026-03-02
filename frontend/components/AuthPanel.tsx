"use client";

import { FormEvent, useState } from "react";
import { login, signup } from "@/lib/api";

type Props = {
  onAuthenticated: (token: string) => void;
};

export default function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = mode === "login" ? await login(email, password) : await signup(email, password);
      onAuthenticated(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur">
      <p className="mb-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">AluminaTech Workspace</p>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-ink">Structured Questionnaire Answering Tool</h1>
      <p className="mb-6 text-sm text-slate-600">Grounded answers with citations for security and compliance workflows.</p>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          className="w-full rounded-xl border border-slate-300 p-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          className="w-full rounded-xl border border-slate-300 p-3"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          minLength={8}
          required
        />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="w-full rounded-xl bg-primary py-3 font-medium text-white shadow-[0_10px_25px_rgba(29,78,216,0.25)] hover:bg-blue-700" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Sign up"}
        </button>
      </form>

      <button
        className="mt-4 text-sm font-medium text-teal-700 underline"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login" ? "Need an account? Sign up" : "Already registered? Login"}
      </button>
    </div>
  );
}
