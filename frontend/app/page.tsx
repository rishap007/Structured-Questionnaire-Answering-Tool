"use client";

import { useEffect, useState } from "react";
import AuthPanel from "@/components/AuthPanel";
import Dashboard from "@/components/Dashboard";

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const existing = localStorage.getItem("token");
    if (existing) setToken(existing);
  }, []);

  function onAuthenticated(nextToken: string) {
    localStorage.setItem("token", nextToken);
    setToken(nextToken);
  }

  function onLogout() {
    localStorage.removeItem("token");
    setToken(null);
  }

  return (
    <div className="min-h-screen p-6">
      {token ? (
        <Dashboard token={token} onLogout={onLogout} />
      ) : (
        <div className="flex min-h-[85vh] items-center justify-center">
          <AuthPanel onAuthenticated={onAuthenticated} />
        </div>
      )}
    </div>
  );
}
