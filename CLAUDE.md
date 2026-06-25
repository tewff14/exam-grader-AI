# CLAUDE.md

## What this is

An exam-grading platform for teachers: organize exams by Course, extract questions from a
blank question paper via JamAI Base OCR+LLM, score student answer papers per-question against
a teacher-authored solution, and generate new exams from a course's past performance. See
`CONTEXT.md` for the domain glossary (Course / Exam / Question / Student Paper / Answer).

This replaced an earlier flat "upload paper → single overall score" flow; that flow and its
single action table (`Subjective_test_checking`) are retired.

## Architecture

- `backend/` — FastAPI.
  - `db.py` — SQLite schema (course, student, enrollment, exam, question, student_paper,
    answer) + all row-level helpers. The only module that writes raw SQL. Deletes (course,
    exam, question, student_paper) are hard, cascading, and done explicitly in Python — the
    schema has no `ON DELETE CASCADE` — see `docs/adr/0002-*.md`.
  - `exams.py` — exam creation (extract questions from an uploaded paper), question
    review/edit, finalize (draft → ready).
  - `grading.py` — per-question scoring pipeline + teacher overrides. A teacher override is
    stored *alongside* the agent's score (never overwrites it); `effective_score` =
    override if set, else agent score. Re-scoring never auto-runs — it's a manual action that
    preserves existing overrides.
  - `generation.py` — aggregates a course's prior per-question/topic performance into a
    compact summary (SQL+Python, not RAG — see `docs/adr/0001-*.md`) and turns the agent's
    suggestions into a new draft exam.
  - `worker.py` — thread-pool background scoring (JamAI's sync SDK blocks on I/O).
  - `stats.py` — dashboard aggregation, scoped by `course_id`/`exam_id`.
  - `main.py` — all routes.
- `frontend/` — Next.js App Router, client components throughout (`useEffect` + fetch, no
  server components). Courses is home (`/`) → `/courses/[id]` → `/courses/[id]/exams/[id]` →
  grading view at `/courses/[id]/exams/[id]/papers/[id]`. Dashboard at `/dashboard`, exam
  generator at `/generate`. **Read `frontend/AGENTS.md` before touching routing/pages** — this
  Next.js build has changes that diverge from training-data assumptions.
- `jamai/connector.py` — the only module that talks to JamAI Base. Three action tables, see
  below.

## JamAI Base action tables

These are provisioned manually by the teacher/admin in the JamAI Base console (project id in
`backend/settings.py`) — neither the app nor Claude can create them. Table IDs come from
`JAMAI_EXTRACTION_TABLE_ID` / `JAMAI_SCORING_TABLE_ID` / `JAMAI_GENERATION_TABLE_ID` env vars
(defaults: `Question_extraction`, `Subjective_test_scoring`, `Exam_generation`).

Column auto-detection (`connector._detect_columns`) skips known system columns (`ID`,
`Updated at`) and picks the first remaining input column matching image/text dtype, plus the
last `gen_config` column as the output. If it still picks the wrong column, force it with
`JAMAI_EXTRACTION_IMAGE_COL` / `JAMAI_SCORING_IMAGE_COL` / `JAMAI_SCORING_TEXT_COL` /
`JAMAI_GENERATION_TEXT_COL`. `GET /api/health` reports what each table resolved to — check
this first when something's not working.

**`Question_extraction`** — input: one image column (the blank question paper). Output: JSON
array `[{question_no, text, topic}, ...]`.

**`Subjective_test_scoring`** — input: one image column (student's answer paper) + one text
column (JSON list of `{question_no, text, solution, max_points}` for the exam, sent by
`grading.run_scoring`). Output: JSON array
`[{question_no, student_answer, score, max_score, feedback}, ...]`. Note: the agent's
`max_score` is never read by the app — `score` is always compared against the app's own
`question.max_points`. It still matters that `score` itself is scaled to the real max, or
paper totals get corrupted.

**`Exam_generation`** — input: one text column (JSON: aggregated per-question/topic
performance + the teacher's prompt, built by `generation._course_performance`). Output: JSON
array `[{question_no, text, topic, suggested_solution, suggested_max_points}, ...]`.

## Prompt-engineering gotchas (hard-won)

The vision/LLM models behind these tables reliably make the same mistakes. Bake these into
every table's prompt up front:

- **Markdown fences** — models wrap JSON in ` ```json ... ``` ` despite being told not to.
  `connector._strip_code_fence` defends against this in code regardless.
- **Bare object instead of array** — for a single-item input, models often return one object
  instead of a 1-element array. State explicitly that the output must always be an array, even
  for one item, with an example showing a single-element array.
- **Parallel arrays** — models sometimes return `{"question_no": [1,2], "text": [...]}`
  instead of an array of per-question objects. A concrete worked example of the array-of-
  objects shape fixes this; abstract field descriptions alone don't stick.
- **Anchoring on example numbers** — if a prompt's example always uses the same number (e.g.
  `max_score: 5`), the model copies that number instead of reading the real value from the
  input. Use *different* numbers per item in every example.
- **Trusting the image over the JSON** — for the scoring table, the model will read point
  values printed on the photographed paper (e.g. "(5 points)") instead of `max_points` in the
  JSON payload, especially once they diverge (JSON is the live, teacher-edited value; the
  photo is fixed at print time). State explicitly that the JSON is the sole source of truth
  and printed marks on the image should be ignored.
- Editing a column's prompt does **not** retroactively regenerate already-computed rows — only
  rows generated after the edit reflect it. When debugging a prompt change, confirm a fresh
  row was actually generated, not a stale cached one.

## Running locally

`docker compose build && docker compose up -d` — builds `backend/Dockerfile` (build context is
the repo root, since it needs the sibling `jamai/` package) and `frontend/Dockerfile`. Backend
on `:8002`, frontend on `:3000`.

## Status as of this session

- Backend and frontend fully rewritten for the Course → Exam → Student Paper model.
- `Question_extraction` and `Subjective_test_scoring` tables exist in JamAI Base and are being
  iterated on (prompt tuning per the gotchas above) — extraction works; scoring is correct on
  values but `max_score`/per-question point scaling was still being debugged.
- `Exam_generation` table not yet created.
- Added teacher-initiated delete for Course / Exam / Question / Student Paper: hard delete,
  always cascades (no "block if children exist" guard), confirmed in the UI via native
  `window.confirm()`. Deleting a Question cascades its Answer rows across every paper even on
  a finalized exam — `stats.py`/`generation.py` recompute live so totals self-correct. See
  `docs/adr/0002-hard-delete-no-soft-delete.md`.
