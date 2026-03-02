"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  generateAnswers,
  listQuestionnaires,
  listReferenceDocs,
  uploadQuestionnaire,
  uploadReference
} from "@/lib/api";
import type { Questionnaire, ReferenceDocument } from "@/lib/types";

type Props = {
  token: string;
  onLogout: () => void;
};

export default function Dashboard({ token, onLogout }: Props) {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [docs, setDocs] = useState<ReferenceDocument[]>([]);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [questionnaireFile, setQuestionnaireFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const [q, d] = await Promise.all([listQuestionnaires(token), listReferenceDocs(token)]);
    setQuestionnaires(q);
    setDocs(d);
  }

  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);

  async function handleReferenceUpload() {
    if (!referenceFile) return;
    setLoading(true);
    setMessage(null);
    try {
      await uploadReference(token, referenceFile);
      setReferenceFile(null);
      await refresh();
      setMessage("Reference document uploaded and indexed.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuestionnaireUpload() {
    if (!questionnaireFile) return;
    setLoading(true);
    setMessage(null);
    try {
      await uploadQuestionnaire(token, questionnaireFile);
      setQuestionnaireFile(null);
      await refresh();
      setMessage("Questionnaire uploaded successfully.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(questionnaireId: number) {
    setLoading(true);
    setMessage(null);
    try {
      await generateAnswers(token, questionnaireId);
      setMessage("Answers generated.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">AluminaTech Questionnaire Workspace</h1>
        <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium shadow-sm hover:bg-slate-50" onClick={onLogout}>
          Logout
        </button>
      </div>

      {message ? <p className="mb-6 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">{message}</p> : null}

      <section className="mb-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">Upload Reference Document (PDF/TXT)</h2>
          <p className="mb-4 text-sm text-slate-600">Add internal policy or process documents for answer grounding.</p>
          <input className="block w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-sm" type="file" accept=".pdf,.txt" onChange={(e) => setReferenceFile(e.target.files?.[0] || null)} />
          <button className="mt-4 rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-blue-700" disabled={loading} onClick={handleReferenceUpload}>
            Upload Reference
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">Upload Questionnaire (PDF/CSV/XLSX)</h2>
          <p className="mb-4 text-sm text-slate-600">Questions remain immutable to preserve source integrity.</p>
          <input className="block w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-sm" type="file" accept=".pdf,.csv,.xlsx" onChange={(e) => setQuestionnaireFile(e.target.files?.[0] || null)} />
          <button className="mt-4 rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-blue-700" disabled={loading} onClick={handleQuestionnaireUpload}>
            Upload Questionnaire
          </button>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Reference Documents</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          {docs.map((d) => (
            <li key={d.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              {d.name} ({d.source_filename})
            </li>
          ))}
          {docs.length === 0 ? <li>No reference documents yet.</li> : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Questionnaires</h2>
        <ul className="space-y-3">
          {questionnaires.map((q) => (
            <li key={q.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-ink">{q.name}</p>
                <p className="text-sm text-slate-600">{q.source_filename}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl bg-accent px-3 py-2 font-medium text-white hover:bg-teal-800" onClick={() => handleGenerate(q.id)} disabled={loading}>
                  Generate Answers
                </button>
                <Link className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium hover:bg-slate-50" href={`/questionnaire/${q.id}`}>
                  Review & Export
                </Link>
              </div>
            </li>
          ))}
          {questionnaires.length === 0 ? <li>No questionnaires uploaded yet.</li> : null}
        </ul>
      </section>
    </main>
  );
}
