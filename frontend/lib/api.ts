import type {
  Questionnaire,
  QuestionnaireResults,
  ReferenceDocument,
  RunComparison,
  RunSummary,
  TokenResponse
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const FALLBACK_API_BASES = ["http://127.0.0.1:8010", "http://127.0.0.1:8000"];

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function withBase(url: string, base: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${base}${url}`;
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

async function fetchWithBaseFallback(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const bases = dedupe([API_BASE, ...FALLBACK_API_BASES]);
  let lastError: unknown = null;

  for (const base of bases) {
    const url = withBase(pathOrUrl, base);
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network request failed");
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }
  return (await res.json()) as T;
}

export async function signup(email: string, password: string) {
  const res = await fetchWithBaseFallback("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return handleResponse<TokenResponse>(res);
}

export async function login(email: string, password: string) {
  const res = await fetchWithBaseFallback("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return handleResponse<TokenResponse>(res);
}

export async function uploadReference(token: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetchWithBaseFallback("/reference-documents/upload", {
    method: "POST",
    headers: authHeader(token),
    body: form
  });
  return handleResponse<ReferenceDocument>(res);
}

export async function uploadQuestionnaire(token: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetchWithBaseFallback("/questionnaires/upload", {
    method: "POST",
    headers: authHeader(token),
    body: form
  });
  return handleResponse<Questionnaire>(res);
}

export async function listQuestionnaires(token: string) {
  const res = await fetchWithBaseFallback("/questionnaires", { headers: authHeader(token), cache: "no-store" });
  return handleResponse<Questionnaire[]>(res);
}

export async function listReferenceDocs(token: string) {
  const res = await fetchWithBaseFallback("/reference-documents", { headers: authHeader(token), cache: "no-store" });
  return handleResponse<ReferenceDocument[]>(res);
}

export async function generateAnswers(token: string, questionnaireId: number, questionIds: number[] = []) {
  const res = await fetchWithBaseFallback(`/questionnaires/${questionnaireId}/generate`, {
    method: "POST",
    headers: { ...authHeader(token), "Content-Type": "application/json" },
    body: JSON.stringify({ question_ids: questionIds, question_uids: [] })
  });
  return handleResponse<{ message: string; run_id: number; run_number: number; regenerated_questions: number; total_questions: number }>(res);
}

export async function getResults(token: string, questionnaireId: number, runId?: number) {
  const suffix = runId ? `?run_id=${runId}` : "";
  const res = await fetchWithBaseFallback(`/questionnaires/${questionnaireId}/results${suffix}`, {
    headers: authHeader(token),
    cache: "no-store"
  });
  return handleResponse<QuestionnaireResults>(res);
}

export async function listRuns(token: string, questionnaireId: number) {
  const res = await fetchWithBaseFallback(`/questionnaires/${questionnaireId}/runs`, {
    headers: authHeader(token),
    cache: "no-store"
  });
  return handleResponse<RunSummary[]>(res);
}

export async function compareRuns(token: string, questionnaireId: number, oldRunId: number, newRunId: number) {
  const res = await fetchWithBaseFallback(
    `/questionnaires/${questionnaireId}/runs/compare?old_run_id=${oldRunId}&new_run_id=${newRunId}`,
    {
      headers: authHeader(token),
      cache: "no-store"
    }
  );
  return handleResponse<RunComparison>(res);
}

export async function saveEdit(token: string, generatedAnswerId: number, editedText: string, editedCitations: string) {
  const res = await fetchWithBaseFallback(`/answers/${generatedAnswerId}/edit`, {
    method: "PUT",
    headers: { ...authHeader(token), "Content-Type": "application/json" },
    body: JSON.stringify({ edited_text: editedText, edited_citations: editedCitations })
  });
  return handleResponse<{ message: string }>(res);
}

export function exportUrl(questionnaireId: number, format: "pdf" | "docx") {
  return `${API_BASE}/questionnaires/${questionnaireId}/export?format=${format}`;
}

export async function downloadExport(token: string, questionnaireId: number, format: "pdf" | "docx") {
  const res = await fetchWithBaseFallback(`/questionnaires/${questionnaireId}/export?format=${format}`, {
    headers: authHeader(token)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Export failed");
  }
  return await res.blob();
}
