"""Exam creation & editing.

An exam is created either by extracting questions from an uploaded blank
question paper, or blank with questions added manually one at a time. Either
way the teacher reviews/edits questions (text, topic, max points, solution),
then finalizes so the exam can receive student papers.
"""

from backend import db, settings
from jamai import connector


def create_exam(course_id: int, name: str, semester: str | None, image_bytes: bytes, filename: str) -> int:
    """Create a draft exam from an uploaded question-paper image.

    Extraction is a single JamAI call, unlike the bulk multi-paper scoring
    worker.py exists for - FastAPI already runs this sync route in a thread,
    so no separate background queue is needed here.
    """
    exam_id = db.create_exam_draft(course_id, name, semester, None)

    image_path = settings.UPLOAD_DIR / f"exam{exam_id}_{filename}"
    image_path.write_bytes(image_bytes)
    db.set_exam_question_paper_image(exam_id, str(image_path))

    raw_questions = connector.extract_questions(str(image_path))
    db.add_questions(exam_id, _normalize_questions(raw_questions))
    return exam_id


def _normalize_questions(raw: list[dict]) -> list[dict]:
    """Number questions sequentially if the agent omitted/duplicated question_no.

    max_points and solution are always teacher-entered (never extracted), so
    they start blank regardless of what the table returned.
    """
    return [
        {
            "question_no": q.get("question_no") or i,
            "text": q.get("text", ""),
            "topic": q.get("topic"),
            "max_points": None,
            "solution": None,
        }
        for i, q in enumerate(raw, start=1)
    ]


def create_blank_exam(course_id: int, name: str, semester: str | None) -> int:
    """Create a draft exam with no question paper, for manual question authoring."""
    return db.create_exam_draft(course_id, name, semester, None)


def add_question(exam_id: int, fields: dict) -> int:
    """Manually add one question to a draft exam.

    Only allowed while the exam is still draft - adding a question to a
    ready exam would land it ungraded on already-scored student papers.
    """
    exam = db.get_exam(exam_id)
    if exam is None:
        raise KeyError(f"exam {exam_id} not found")
    if exam["status"] != "draft":
        raise ValueError("Cannot add a question to an exam that is not draft")
    return db.add_question(exam_id, fields)


def patch_question(question_id: int, patch: dict) -> None:
    if db.get_question(question_id) is None:
        raise KeyError(f"question {question_id} not found")
    db.patch_question(question_id, patch)


def finalize_exam(exam_id: int) -> None:
    """Move an exam from draft to ready.

    Requires every question to have max_points and a solution, since those
    are what the scoring agent grades student papers against.
    """
    exam = db.get_exam(exam_id)
    if exam is None:
        raise KeyError(f"exam {exam_id} not found")

    questions = db.list_questions(exam_id)
    if not questions:
        raise ValueError("Exam has no questions")

    missing = [q["question_no"] for q in questions if q["max_points"] is None or not q["solution"]]
    if missing:
        raise ValueError(f"Questions missing max points or solution: {missing}")

    db.set_exam_status(exam_id, "ready")
