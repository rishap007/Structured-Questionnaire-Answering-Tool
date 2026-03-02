# Structured Questionnaire Answering Tool

Grounded questionnaire answering web app for compliance/security workflows.

This project lets a user upload internal reference documents and a questionnaire, generate citation-grounded answers, manually edit answers, export reports, and track answer-generation versions over time.

## 1. What This App Does

- Authenticates users with JWT (`signup` / `login`)
- Uploads and indexes reference documents (`.pdf`, `.txt`)
- Uploads questionnaire files (`.pdf`, `.csv`, `.xlsx`) and stores immutable questions
- Generates grounded answers with citations using RAG
- Computes confidence score and confidence level per answer
- Stores evidence snippets used during generation
- Supports partial regeneration for selected questions
- Stores generation runs (version history)
- Compares two generation runs
- Supports manual answer edits
- Exports questionnaire + answers to `DOCX` and `PDF`
- Shows coverage summary (total / cited / not found)

## 2. Tech Stack

### Backend
- FastAPI
- SQLAlchemy ORM
- SQLite
- ChromaDB (local persistent vector store)
- OpenAI API (primary embedding/generation path) with fallback behavior
- Pydantic

### Frontend
- Next.js 14 (App Router)
- React
- TypeScript
- Tailwind CSS

## 3. Repository Structure

```text
backend/
  app/
    main.py                 # API routes and core orchestration
    auth.py                 # JWT auth + password hashing
    models.py               # SQLAlchemy models
    schemas.py              # Pydantic API schemas
    database.py             # DB engine/session setup
    config.py               # env-based settings
    seed_loader.py          # optional seed import
    rag/
      chunker.py            # text chunking
      retriever.py          # Chroma + embeddings retrieval
      generator.py          # grounded answer generation
  requirements.txt
  .env.example

frontend/
  app/
    layout.tsx
    page.tsx
    questionnaire/[id]/page.tsx
    globals.css
  components/
    AuthPanel.tsx
    Dashboard.tsx
    ResultsView.tsx
  lib/
    api.ts                  # typed API client
    types.ts                # frontend types
  package.json

seed_data/
  questionnaires/
  reference_docs/

README.md
DESCRIPTION.md
```

## 4. Data Model (Backend)

Core tables:
- `users`
- `reference_documents`
- `reference_chunks`
- `questionnaires`
- `questions`
- `generated_answers`
- `edited_answers`
- `generation_runs`
- `run_answers`

Important model behavior:
- `questions` are immutable after questionnaire upload
- `generated_answers` stores latest/current answer state per question
- `edited_answers` stores manual edits separately
- `generation_runs` and `run_answers` store historical generation snapshots for versioning/comparison

## 5. RAG Flow

1. User uploads reference docs.
2. Text is extracted and chunked.
3. Chunks are stored in DB + vector store.
4. For each questionnaire question:
- retrieve top chunks
- compute similarity
- apply retrieval quality gate
- generate grounded answer with citations
- compute confidence
- store evidence snippets

Safety rules:
- If retrieval quality is below threshold, return `Not found in references.`
- If a generated answer has no valid citations, force fallback to `Not found in references.`

## 6. Feature Coverage

### Confidence Score
Implemented.
- `confidence_score` (percentage)
- `avg_similarity_score`
- `confidence_level` (`High` / `Medium` / `Low`)

### Evidence Snippets
Implemented.
Each answer includes snippet objects:
- citation
- snippet_text
- similarity

### Partial Regeneration
Implemented.
Generate endpoint accepts selected question IDs and regenerates only those while preserving others in a new run snapshot.

### Version History
Implemented.
- each generation creates a new run
- runs can be listed
- run-to-run comparison endpoint available
- historical run view available in results

### Coverage Summary
Implemented in API + UI:
- total questions
- answered with citations
- not found count

## 7. API Reference

### Auth
- `POST /auth/signup`
- `POST /auth/login`

### Reference Documents
- `POST /reference-documents/upload`
- `GET /reference-documents`

### Questionnaires
- `POST /questionnaires/upload`
- `GET /questionnaires`
- `GET /questionnaires/{questionnaire_id}`

### Generation
- `POST /questionnaires/{questionnaire_id}/generate`
  - optional payload:
    - `question_ids: number[]`
    - `question_uids: string[]`

### Results / Versions
- `GET /questionnaires/{questionnaire_id}/results`
  - optional query: `run_id`
- `GET /questionnaires/{questionnaire_id}/runs`
- `GET /questionnaires/{questionnaire_id}/runs/compare?old_run_id=...&new_run_id=...`

### Editing
- `PUT /answers/{generated_answer_id}/edit`

### Export
- `GET /questionnaires/{questionnaire_id}/export?format=docx|pdf`

### Health
- `GET /health`

## 8. Local Setup (No Docker)

## Prerequisites
- Python 3.9+
- Node.js 20+
- npm

If Node is installed via Homebrew `node@20`, ensure PATH:

```bash
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Backend startup

```bash
cd /Users/rishapsharma/Documents/Almabase_assignment_KumarRIshap/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

### Frontend startup

```bash
cd /Users/rishapsharma/Documents/Almabase_assignment_KumarRIshap/frontend
npm install
cp .env.local.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open:
- Frontend: `http://127.0.0.1:3000`
- Backend health: `http://127.0.0.1:8010/health`

## 9. Seed Files

Reference docs:
- `seed_data/reference_docs/*.txt`

Questionnaire:
- `seed_data/questionnaires/aluminatech_vendor_security_questionnaire.csv`

## 10. Typical User Flow

1. Signup or login.
2. Upload one or more reference docs.
3. Upload questionnaire.
4. Click `Generate`.
5. Review answers:
- confidence
- evidence snippets
- citations
6. Optionally edit answers.
7. Optionally select some questions and click `Regenerate Selected`.
8. Use run selector and compare runs.
9. Export to DOCX/PDF.

## 11. Failure Handling

- OpenAI quota/network issues: retrieval/generation falls back to deterministic local behavior.
- CSV parser issues: fallback parser path enabled.
- Report loading in frontend:
  - explicit error state + retry
  - multi-port API fallback (`8010` and `8000`)
  - run-history endpoint failure does not block core report rendering

## 12. Security Notes

- JWT auth for protected endpoints
- Passwords hashed with passlib context
- CORS is currently permissive (`*`) for local MVP
- Use strong `SECRET_KEY` and production CORS restrictions before deployment

## 13. Interview-Oriented Highlights

- Clear separation of concerns (auth, ingestion, retrieval, generation, review, export)
- Explainability via citations and evidence snippets
- Versioning support for auditability
- Partial regeneration to reduce unnecessary recompute
- Deterministic fallback behavior for reliability under API quota failures

For a deep interview walkthrough, see [DESCRIPTION.md](./DESCRIPTION.md).
# Structured-Questionnaire-Answering-Tool
