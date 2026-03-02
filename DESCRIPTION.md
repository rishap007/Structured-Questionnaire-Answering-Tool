# Detailed Project Description (Interview Deep Dive)

This document explains the system in detail so you can confidently discuss implementation decisions, tradeoffs, and runtime behavior in interviews.

## 1. Product Goal

The app solves a common enterprise/compliance pain point: answering structured questionnaires (security/vendor/compliance forms) using only approved internal documents.

Primary goals:
- Ground answers in uploaded references
- Show citations and evidence
- Reduce hallucination risk with deterministic safeguards
- Preserve source question integrity (immutable questions)
- Keep a history of answer-generation runs for auditability

## 2. High-Level Architecture

Client-server architecture with local persistence.

- Frontend: Next.js app for user workflows
- Backend: FastAPI API for ingestion, retrieval, generation, review, export
- Relational DB: SQLite for users, questionnaires, answers, runs
- Vector store: ChromaDB for semantic retrieval

Data movement:
1. Ingestion path stores parsed content in SQL + vector index
2. Generation path retrieves relevant chunks, computes confidence, produces answer+citation
3. Review path supports edits and regeneration
4. Versioning path stores each generation run snapshot

## 3. Backend Internals

## 3.1 Entry point and app startup

`backend/app/main.py` does:
- app initialization
- CORS middleware
- table creation and lightweight schema-update safeguard
- route registration
- helper utilities for parsing, confidence, snippets

Notable startup behavior:
- `ensure_schema_updates()` patches older DBs by adding missing `evidence_snippets` column when needed
- `Base.metadata.create_all()` ensures new tables exist (`generation_runs`, `run_answers`)

## 3.2 Auth system

`backend/app/auth.py`
- signup/login endpoints
- JWT token creation/verification
- password hashing/verification
- dependency `get_current_user` protects endpoints

Interview point:
- Auth is stateless JWT for MVP simplicity
- No refresh token rotation yet (reasonable extension)

## 3.3 File ingestion

Reference docs (`PDF/TXT`):
- file saved to upload dir
- text extracted
- text chunked
- each chunk stored in SQL and indexed in Chroma

Questionnaire files (`PDF/CSV/XLSX`):
- parser extracts candidate question lines
- stored as ordered immutable `questions`
- each question gets stable UID (`Q-001`, ...)

Robustness:
- CSV parser has fallback `engine="python"` + bad-line skipping for imperfect files

## 3.4 Retrieval and generation

Retrieval (`rag/retriever.py`):
- primary path: OpenAI embeddings + vector query
- fallback path: Chroma text query when OpenAI unavailable/quota-limited
- disables repeated failing OpenAI calls using runtime flag

Generation (`rag/generator.py`):
- primary path: OpenAI chat completion with strict system prompt
- fallback path: extractive sentence-selection from retrieved chunks
- requires citations format validation; otherwise fallback to `Not found in references.`

Guardrails:
- retrieval similarity gate in `main.py`
- citation presence enforcement
- deterministic fallback behavior

## 3.5 Confidence and evidence snippets

Per question generation computes:
- similarities of retrieved chunks
- `avg_similarity_score`
- `confidence_score = avg_similarity_score * 100`
- `confidence_level` mapping:
  - `High >= 75`
  - `Medium >= 50`
  - `Low < 50`

Evidence snippets are derived from top retrieved hits:
- citation label
- text snippet preview
- similarity

## 3.6 Partial regeneration

Endpoint:
- `POST /questionnaires/{id}/generate`

Supports optional payload:
- `question_ids`
- `question_uids`

Behavior:
- selected questions regenerate
- unselected questions carry forward previous values into new run snapshot
- current `generated_answers` table reflects latest state

Why this design:
- user can fix weak answers without recomputing the entire questionnaire
- still keeps full run snapshot for comparisons/audit

## 3.7 Version history and comparison

Two-table approach:
- `generation_runs` = run metadata (`run_number`, timestamp)
- `run_answers` = per-question answer snapshot for that run

Endpoints:
- `GET /questionnaires/{id}/runs`
- `GET /questionnaires/{id}/results?run_id=...`
- `GET /questionnaires/{id}/runs/compare?old_run_id=...&new_run_id=...`

Comparison output includes:
- per-question old/new answer text
- old/new confidence
- `changed` flag
- aggregate changed count

Interview point:
- this is a practical auditability pattern without complex event sourcing

## 3.8 Editing and exports

Editing:
- `PUT /answers/{generated_answer_id}/edit`
- writes to `edited_answers` table
- latest edit is applied in current/latest run view
- historical run view remains read-only

Exports:
- `DOCX` and `PDF`
- preserves question order and displays effective answer

## 4. Frontend Internals

## 4.1 App pages

- `/` dashboard + auth
- `/questionnaire/[id]` detailed results/review view

## 4.2 API client strategy

`frontend/lib/api.ts`
- typed API wrappers
- standardized response handling
- network fallback across possible local backend bases (`env base`, `8010`, `8000`)

Why important:
- avoids report failures due to common local port mismatch

## 4.3 Results UI capabilities

`frontend/components/ResultsView.tsx` supports:
- coverage summary
- confidence badge + avg similarity
- evidence snippets display
- edit controls
- checkbox selection for partial regeneration
- run selector for historical views
- run compare panel
- historical run read-only mode
- explicit loading/error/retry states

Resilience improvements:
- results view still renders if run-list endpoint fails
- no silent infinite loading state

## 5. End-to-End Request Flow

Example: full generation
1. User clicks `Generate`.
2. Frontend calls `POST /questionnaires/{id}/generate`.
3. Backend creates new run row.
4. For each question:
- retrieve chunks
- compute confidence
- generate answer or fallback
- store latest in `generated_answers`
- snapshot in `run_answers`
5. Frontend refreshes results and runs list.

Example: partial regeneration
1. User checks selected questions.
2. Frontend sends selected IDs.
3. Backend regenerates only selected subset.
4. Unselected questions copied from prior state into new run snapshot.
5. UI shows new run number.

## 6. Known Tradeoffs

- SQLite is easy locally but not ideal for high concurrency production.
- Heuristic confidence based on retrieval similarity, not calibrated model confidence.
- Citation format validation is structural, not semantic proof verification.
- Chunking is approximate token-based windowing.

These are acceptable MVP tradeoffs and easy to discuss in interviews.

## 7. Reliability Decisions Worth Mentioning

- Hard fallback for weak retrieval (`Not found in references.`)
- OpenAI failure fallback to local deterministic retrieval/generation path
- Multi-port frontend API fallback
- Defensive CSV parsing
- Historical versions for auditability and debugging

## 8. Typical Interview Questions and Suggested Angles

Q: How do you prevent hallucinations?
- Retrieval gating + strict grounding prompt + citation enforcement + deterministic fallback.

Q: How do you explain answer quality?
- Confidence score/level + evidence snippets + run comparison across iterations.

Q: Why keep both `generated_answers` and run tables?
- Fast latest-state reads + complete historical snapshots for audit trail.

Q: How would you scale this?
- Move SQLite to Postgres, queue long jobs, async worker for generation, better indexing, pagination, and tenant scoping.

Q: What if OpenAI is down or quota exceeded?
- Existing runtime fallback paths keep app functional.

## 9. Local Runbook (Quick)

Backend:
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Frontend:
```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
cd frontend
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open:
- `http://127.0.0.1:3000`

## 10. What to Emphasize in Your Interview Demo

- Show upload -> generate -> evidence/citations -> edit -> export
- Demonstrate partial regeneration on selected questions
- Show version history and compare two runs
- Highlight confidence + coverage summary
- Mention fault-tolerant behavior when LLM API fails

This gives a strong narrative of practical product thinking + robust engineering under real constraints.
