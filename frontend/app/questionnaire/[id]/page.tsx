"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ResultsView from "@/components/ResultsView";

export default function QuestionnairePage() {
  const params = useParams<{ id: string }>();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const existing = localStorage.getItem("token");
    if (existing) setToken(existing);
  }, []);

  const questionnaireId = Number(params.id);

  if (!token) {
    return (
      <main className="p-8">
        <p className="mb-3">Please log in first.</p>
        <Link href="/" className="underline">
          Go to Home
        </Link>
      </main>
    );
  }

  if (!Number.isFinite(questionnaireId)) {
    return <p className="p-8">Invalid questionnaire id.</p>;
  }

  return <ResultsView token={token} questionnaireId={questionnaireId} />;
}
