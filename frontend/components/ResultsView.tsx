"use client";

import { useEffect, useMemo, useState } from "react";
import { compareRuns, downloadExport, generateAnswers, getResults, listRuns, saveEdit } from "@/lib/api";
import type { AnswerRow, QuestionnaireResults, RunComparison, RunSummary } from "@/lib/types";

type Props = {
  token: string;
  questionnaireId: number;
};

export default function ResultsView({ token, questionnaireId }: Props) {
  const [data, setData] = useState<QuestionnaireResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [compareData, setCompareData] = useState<RunComparison | null>(null);
  const [activeRunId, setActiveRunId] = useState<number | undefined>(undefined);
  const [compareOldRunId, setCompareOldRunId] = useState<number | undefined>(undefined);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function refresh(runId?: number) {
    setLoading(true);
    const res = await getResults(token, questionnaireId, runId);
    let runList: RunSummary[] = [];
    try {
      runList = await listRuns(token, questionnaireId);
    } catch {
      // Keep results functional even if run-history endpoint is unavailable.
      runList = res.run ? [res.run] : [];
    }
    setData(res);
    setRuns(runList);
    setLoading(false);
  }

  useEffect(() => {
    refresh(activeRunId).catch((e) => {
      setMessage(e instanceof Error ? e.message : "Failed to load results");
      setLoading(false);
    });
  }, [questionnaireId, token, activeRunId]);

  const latestRunId = runs[0]?.id;
  const isHistoricalView = Boolean(data?.run?.id && latestRunId && data.run.id !== latestRunId);

  async function onSave(row: AnswerRow, editedText: string, editedCitations: string) {
    if (!row.generated_answer_id || isHistoricalView) return;
    setSavingId(row.generated_answer_id);
    setMessage(null);
    try {
      await saveEdit(token, row.generated_answer_id, editedText, editedCitations);
      await refresh(activeRunId);
      setMessage(`Saved edit for ${row.question_uid}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function onGenerateSelected() {
    if (!data) return;
    if (selectedQuestionIds.size === 0) {
      setMessage("Select at least one question to regenerate.");
      return;
    }
    setRegenerating(true);
    setMessage(null);
    try {
      const res = await generateAnswers(token, questionnaireId, Array.from(selectedQuestionIds));
      setSelectedQuestionIds(new Set());
      setActiveRunId(undefined);
      setCompareData(null);
      await refresh();
      setMessage(`Regenerated ${res.regenerated_questions}/${res.total_questions} questions as Run #${res.run_number}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function onGenerateAll() {
    setRegenerating(true);
    setMessage(null);
    try {
      const res = await generateAnswers(token, questionnaireId);
      setSelectedQuestionIds(new Set());
      setActiveRunId(undefined);
      setCompareData(null);
      await refresh();
      setMessage(`Generated full questionnaire as Run #${res.run_number}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function onCompare() {
    if (!data?.run?.id || !compareOldRunId) return;
    try {
      const cmp = await compareRuns(token, questionnaireId, compareOldRunId, data.run.id);
      setCompareData(cmp);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Compare failed");
    }
  }

  async function onExport(format: "pdf" | "docx") {
    if (!data) return;
    try {
      const blob = await downloadExport(token, questionnaireId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.questionnaire.name}_answered.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed");
    }
  }

  const changedPreview = useMemo(() => compareData?.items.filter((i) => i.changed).slice(0, 5) ?? [], [compareData]);

  if (loading) return <p className="p-8">Loading results...</p>;

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {message || "Could not load results."}
        </p>
        <button
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => refresh(activeRunId).catch((e) => setMessage(e instanceof Error ? e.message : "Retry failed"))}
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.questionnaire.name}</h1>
          <p className="text-sm text-slate-600">Review answers, edit, regenerate specific questions, and compare runs.</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl bg-primary px-3 py-2 font-medium text-white hover:bg-blue-700" onClick={() => onExport("docx")}>
            Export DOCX
          </button>
          <button className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium hover:bg-slate-50" onClick={() => onExport("pdf")}>
            Export PDF
          </button>
        </div>
      </div>

      <section className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Total Questions</p>
          <p className="text-2xl font-semibold">{data.summary.total_questions}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Answered with Citations</p>
          <p className="text-2xl font-semibold">{data.summary.answered_with_citations}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Not Found</p>
          <p className="text-2xl font-semibold">{data.summary.not_found_count}</p>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium">Version History:</label>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={activeRunId ?? ""}
            onChange={(e) => setActiveRunId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Latest</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                Run #{r.run_number} - {new Date(r.created_at).toLocaleString()}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-teal-800" disabled={regenerating} onClick={onGenerateAll}>
            {regenerating ? "Working..." : "Regenerate All"}
          </button>
          <button className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50" disabled={regenerating} onClick={onGenerateSelected}>
            Regenerate Selected ({selectedQuestionIds.size})
          </button>
        </div>
        {data.run ? <p className="mt-2 text-xs text-slate-500">Viewing Run #{data.run.run_number}</p> : null}
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium">Compare current run against:</label>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={compareOldRunId ?? ""}
            onChange={(e) => setCompareOldRunId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Select older run</option>
            {runs
              .filter((r) => !data.run || r.id !== data.run.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  Run #{r.run_number}
                </option>
              ))}
          </select>
          <button className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50" disabled={!compareOldRunId || !data.run} onClick={onCompare}>
            Compare Versions
          </button>
        </div>
        {compareData ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-medium">
              Changed answers: {compareData.changed_answers}/{compareData.total_questions}
            </p>
            {changedPreview.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {changedPreview.map((item) => (
                  <li key={item.question_id} className="rounded bg-white p-2 text-xs">
                    <p className="font-medium">{item.question_uid}: {item.question_text}</p>
                    <p className="text-slate-600">Old confidence {item.old_confidence_score.toFixed(2)}% {"->"} New {item.new_confidence_score.toFixed(2)}%</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-600">No changed answers between these runs.</p>
            )}
          </div>
        ) : null}
      </section>

      {message ? <p className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">{message}</p> : null}

      {isHistoricalView ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Historical run selected. Editing is disabled for older versions.
        </p>
      ) : null}

      <div className="space-y-4">
        {data.answers.map((row) => (
          <AnswerCard
            key={`${row.question_id}-${row.generated_answer_id}-${row.position}`}
            row={row}
            saving={savingId === row.generated_answer_id}
            isSelected={selectedQuestionIds.has(row.question_id)}
            disableEditing={isHistoricalView || !row.generated_answer_id}
            onToggleSelect={(questionId) =>
              setSelectedQuestionIds((prev) => {
                const next = new Set(prev);
                if (next.has(questionId)) next.delete(questionId);
                else next.add(questionId);
                return next;
              })
            }
            onSave={onSave}
          />
        ))}
      </div>
    </main>
  );
}

type CardProps = {
  row: AnswerRow;
  saving: boolean;
  isSelected: boolean;
  disableEditing: boolean;
  onToggleSelect: (questionId: number) => void;
  onSave: (row: AnswerRow, editedText: string, editedCitations: string) => Promise<void>;
};

function AnswerCard({ row, saving, isSelected, disableEditing, onToggleSelect, onSave }: CardProps) {
  const [editedText, setEditedText] = useState(row.edited_answer_text ?? row.generated_answer_text);
  const [editedCitations, setEditedCitations] = useState(row.edited_citations ?? row.generated_citations);
  const lowConfidence = row.confidence_score < 50;

  useEffect(() => {
    setEditedText(row.edited_answer_text ?? row.generated_answer_text);
    setEditedCitations(row.edited_citations ?? row.generated_citations);
  }, [row.edited_answer_text, row.edited_citations, row.generated_answer_text, row.generated_citations]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">
          {row.position}. {row.question_text}
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(row.question_id)} />
            Select for regeneration
          </label>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${lowConfidence ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
            {row.confidence_level} confidence ({row.confidence_score.toFixed(2)}%)
          </span>
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-500">Average similarity: {(row.avg_similarity_score * 100).toFixed(2)}%</p>

      <label className="mb-1 block text-sm font-medium">Answer</label>
      <textarea
        className="mb-3 w-full rounded-xl border border-slate-300 p-3"
        rows={4}
        value={editedText}
        disabled={disableEditing}
        onChange={(e) => setEditedText(e.target.value)}
      />

      <label className="mb-1 block text-sm font-medium">Citations</label>
      <textarea
        className="mb-4 w-full rounded-xl border border-slate-300 p-3"
        rows={2}
        value={editedCitations}
        disabled={disableEditing}
        onChange={(e) => setEditedCitations(e.target.value)}
      />

      <div className="mb-4 rounded-xl bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-600">Evidence Snippets</p>
        {row.evidence_snippets.length > 0 ? (
          <ul className="space-y-2">
            {row.evidence_snippets.map((snip, idx) => (
              <li key={`${row.question_id}-snippet-${idx}`} className="rounded bg-white p-2 text-xs">
                <p className="font-medium text-slate-700">{snip.citation}</p>
                <p className="text-slate-600">{snip.snippet_text}</p>
                <p className="text-slate-500">Similarity: {(snip.similarity * 100).toFixed(2)}%</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-600">No evidence snippets available for this answer.</p>
        )}
      </div>

      <button
        className="rounded-xl bg-accent px-4 py-2 font-medium text-white hover:bg-teal-800"
        disabled={saving || disableEditing}
        onClick={() => onSave(row, editedText, editedCitations)}
      >
        {saving ? "Saving..." : "Save Edited Answer"}
      </button>
    </section>
  );
}
