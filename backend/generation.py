"""Exam generation: aggregate a course's prior performance into a compact
summary, then ask the generation agent to draft a new exam targeting weak
areas the teacher describes (e.g. "focus on topics many students failed").

Mirrors stats.py's approach of fetching rows and aggregating in Python rather
than writing SQL joins, since a course's data is small enough for that to stay
simple. This structured summary is the data source for exam generation - not
RAG and not live LLM access to the database (see docs/adr/0001).
"""

from collections import defaultdict

from backend import db
from jamai import connector


def _course_performance(course_id: int) -> dict:
    """Per-topic and per-question average score % across all scored papers in
    every exam of this course.
    """
    by_topic: dict[str, list[float]] = defaultdict(list)
    by_question: list[dict] = []

    for exam in db.list_exams(course_id):
        questions = {q["question_id"]: q for q in db.list_questions(exam["exam_id"])}
        if not questions:
            continue

        per_question_scores: dict[int, list[float]] = defaultdict(list)
        for paper in db.list_papers(exam["exam_id"]):
            if paper["status"] != "scored":
                continue
            for a in db.list_answers(paper["paper_id"]):
                if not a["max_points"]:
                    continue
                effective = a["teacher_score"] if a["teacher_score"] is not None else a["agent_score"]
                if effective is None:
                    continue
                percent = effective / a["max_points"] * 100
                per_question_scores[a["question_id"]].append(percent)
                if a["topic"]:
                    by_topic[a["topic"]].append(percent)

        for question_id, percents in per_question_scores.items():
            q = questions[question_id]
            by_question.append(
                {
                    "exam_name": exam["name"],
                    "topic": q["topic"],
                    "question_text": q["text"],
                    "average_percent": round(sum(percents) / len(percents), 2),
                    "attempts": len(percents),
                }
            )

    topic_summary = [
        {"topic": t, "average_percent": round(sum(v) / len(v), 2), "attempts": len(v)}
        for t, v in by_topic.items()
    ]
    topic_summary.sort(key=lambda r: r["average_percent"])
    by_question.sort(key=lambda r: r["average_percent"])
    return {"by_topic": topic_summary, "weakest_questions": by_question[:15]}


def generate_exam(course_id: int, name: str, semester: str | None, prompt: str) -> int:
    """Generate a draft exam for a course from its prior performance + the
    teacher's characteristic prompt. Returns the new exam_id.
    """
    performance = _course_performance(course_id)
    context_payload = {"prompt": prompt, "performance": performance}

    raw_questions = connector.generate_exam(context_payload)
    questions = [
        {
            "question_no": q.get("question_no") or i,
            "text": q.get("text", ""),
            "topic": q.get("topic"),
            "max_points": q.get("suggested_max_points"),
            "solution": q.get("suggested_solution"),
        }
        for i, q in enumerate(raw_questions, start=1)
    ]

    exam_id = db.create_exam_draft(course_id, name, semester, None)
    db.add_questions(exam_id, questions)
    return exam_id
