# Exam Grader AI

An exam-grading platform for teachers. Organize subjective exams by **Course**, extract
questions from a blank question paper via OCR + LLM, score student answer papers
**per-question** against a teacher-authored solution, and generate new exams from a course's
past performance.

The grading and extraction work is done by [JamAI Base](https://www.jamaibase.com/) action
tables (OCR + LLM); this app orchestrates them, stores results in SQLite, and gives teachers a
review/override UI.

## Domain model

The data flows through a four-level hierarchy. See [`CONTEXT.md`](CONTEXT.md) for the full
glossary.

```
Course ──< Exam ──< Question        (the answer key)
   │          │
   │          └──< Student Paper ──< Answer   (one student's scored response per question)
   └──< Student (roster / enrollment)
```

- **Course** — a named collection of Exams for an academic year, with a roster of students.
- **Exam** — a single test; stays in `draft` until finalized to `ready`, then accepts papers.
- **Question** — text, topic, max points, and a teacher-authored **solution** (the answer key).
- **Student Paper** — one student's answer sheet, scored per-question.
- **Answer** — the OCR'd response, the agent's score + feedback, and an optional teacher
  override. The **effective score** is the override if set, otherwise the agent's score —
  overrides never overwrite the agent's value.

## Features

- **Question extraction** — upload a blank question paper; the OCR/LLM agent extracts each
  question's text and topic into an editable draft exam.
- **Per-question scoring** — upload a student's answer paper; each answer is scored against the
  teacher's solution, with feedback. Re-scoring is a manual action that preserves overrides.
- **Teacher overrides** — adjust any score; the original agent score is kept alongside.
- **Exam generation** — generate a new draft exam from a course's aggregated past performance.
- **Dashboard** — score aggregation scoped by course and exam.
- **Hard deletes** — deleting a Course / Exam / Question / Student Paper cascades; stats
  recompute live so totals self-correct (see [`docs/adr/0002-*`](docs/adr/)).

## Architecture

- **`backend/`** — FastAPI (Python), SQLite. `db.py` owns the schema and all raw SQL;
  `exams.py`, `grading.py`, `generation.py`, `stats.py` hold the domain logic; `worker.py` runs
  background scoring; `main.py` wires up the routes.
- **`frontend/`** — Next.js (App Router, client components throughout). Courses is home (`/`) →
  `/courses/[id]` → `/courses/[id]/exams/[id]` → grading at
  `/courses/[id]/exams/[id]/papers/[id]`. Dashboard at `/dashboard`, generator at `/generate`.
- **`jamai/connector.py`** — the only module that talks to JamAI Base.

`CLAUDE.md` and `frontend/AGENTS.md` document the deeper conventions; ADRs live in `docs/adr/`.

## Prerequisites

- [Docker](https://www.docker.com/) with Docker Compose.
- A [JamAI Base](https://www.jamaibase.com/) project with three **action tables** provisioned
  in the console (the app cannot create them):

  | Table (default ID) | Input | Output |
  | --- | --- | --- |
  | `Question_extraction` | 1 image column (blank paper) | `[{question_no, text, topic}]` |
  | `Subjective_test_scoring` | 1 image column (answer paper) + 1 text column (questions JSON) | `[{question_no, student_answer, score, max_score, feedback}]` |
  | `Exam_generation` | 1 text column (performance + prompt JSON) | `[{question_no, text, topic, suggested_solution, suggested_max_points}]` |

  See `CLAUDE.md` for the exact column contracts and prompt-engineering notes.

## Setup

1. Copy the environment template and fill in your JamAI credentials:

   ```bash
   cp .env.example .env
   # edit .env — set JAMAI_TOKEN (and JAMAI_PROJECT_ID if different)
   ```

   `.env` holds your real token and is **git-ignored** — never commit it. Only
   `.env.example` (placeholders) is tracked.

2. Build and run:

   ```bash
   docker compose build && docker compose up -d
   ```

   - Frontend: http://localhost:3000
   - Backend: http://localhost:8002
   - Health check: http://localhost:8002/api/health — reports which JamAI table and column
     each agent resolved to. **Check this first when something isn't working.**

   Override `FRONTEND_PORT` / `BACKEND_PORT` in `.env` if those ports are taken (if you change
   `BACKEND_PORT`, update `NEXT_PUBLIC_API_BASE` to match — it's baked into the frontend at
   build time).

The SQLite DB (`backend/data/`) and uploaded papers (`backend/uploads/`) are mounted as volumes
and persist across restarts. Both are git-ignored.

## Configuration

All configuration is via environment variables in `.env` (consumed by `docker compose`):

| Variable | Default | Notes |
| --- | --- | --- |
| `JAMAI_TOKEN` | _(required)_ | Your JamAI personal access token. |
| `JAMAI_PROJECT_ID` | `proj_9f386b9e35a4f019119bfc11` | JamAI project containing the tables. |
| `JAMAI_API_BASE` | JamAI cloud | Override for self-hosted JamAI. |
| `JAMAI_EXTRACTION_TABLE_ID` | `Question_extraction` | Action table ID. |
| `JAMAI_SCORING_TABLE_ID` | `Subjective_test_scoring` | Action table ID. |
| `JAMAI_GENERATION_TABLE_ID` | `Exam_generation` | Action table ID. |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8002` | Backend URL the **browser** must reach. |
| `FRONTEND_PORT` / `BACKEND_PORT` | `3000` / `8002` | Host port overrides. |

If column auto-detection picks the wrong column, force it with `JAMAI_EXTRACTION_IMAGE_COL` /
`JAMAI_SCORING_IMAGE_COL` / `JAMAI_SCORING_TEXT_COL` / `JAMAI_GENERATION_TEXT_COL`.

## API

The backend exposes a REST API under `/api` (courses, students, exams, questions, papers,
answers, stats, exam generation, and `/api/health`). With the backend running, interactive docs
are at http://localhost:8002/docs.

## Security note

Never commit secrets. The repo's `.gitignore` excludes `.env`/`.env.*` (except `.env.example`),
the SQLite database, and uploaded student papers. Verify with `git status` before committing.
