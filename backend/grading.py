"""Per-question scoring of student papers against an exam's questions/solutions.

A teacher override is stored alongside (never over) the agent's score, so
`effective_score` = teacher_score if set, else agent_score. Editing an exam's
questions/solutions never auto-rescores existing papers - `run_scoring` is
re-invoked on demand (by worker.py for the initial check, or the manual
Re-score action) and preserves any overrides already saved, since it only
overwrites the agent_* columns.
"""

import json

from backend import db
from jamai import connector


def run_scoring(paper_id: int) -> None:
    paper = db.get_paper(paper_id)
    if paper is None:
        raise KeyError(f"paper {paper_id} not found")

    questions = db.list_questions(paper["exam_id"])
    qa_payload = [
        {
            "question_no": q["question_no"],
            "text": q["text"],
            "solution": q["solution"],
            "max_points": q["max_points"],
        }
        for q in questions
    ]
    by_no = {q["question_no"]: q["question_id"] for q in questions}

    raw_results = connector.score_paper(paper["image_path"], qa_payload)
    db.set_paper_raw_result(paper_id, json.dumps(raw_results))

    answers = []
    for r in raw_results:
        question_id = by_no.get(r.get("question_no"))
        if question_id is None:
            continue  # agent referenced a question_no not in this exam; skip it
        answers.append(
            {
                "question_id": question_id,
                "student_answer": r.get("student_answer"),
                "agent_score": r.get("score"),
                "agent_feedback": r.get("feedback"),
            }
        )
    db.replace_agent_answers(paper_id, answers)


def apply_override(answer_id: int, teacher_score: float | None) -> None:
    answer = db.get_answer(answer_id)
    if answer is None:
        raise KeyError(f"answer {answer_id} not found")
    db.set_answer_teacher_score(answer_id, teacher_score)


def answer_detail(answer_id: int) -> dict:
    row = db.get_answer_with_question(answer_id)
    if row is None:
        raise KeyError(f"answer {answer_id} not found")
    return _answer_dict(row)


def _max_score(exam_id: int) -> float | None:
    questions = db.list_questions(exam_id)
    points = [q["max_points"] for q in questions if q["max_points"] is not None]
    return sum(points) if points else None


def _sum_effective(answer_rows) -> float | None:
    if not answer_rows:
        return None
    scores = [
        a["teacher_score"] if a["teacher_score"] is not None else a["agent_score"]
        for a in answer_rows
    ]
    scores = [s for s in scores if s is not None]
    return sum(scores) if scores else None


def _answer_dict(a) -> dict:
    effective = a["teacher_score"] if a["teacher_score"] is not None else a["agent_score"]
    return {
        "answer_id": a["answer_id"],
        "question_id": a["question_id"],
        "question_no": a["question_no"],
        "question_text": a["question_text"],
        "topic": a["topic"],
        "max_points": a["max_points"],
        "student_answer": a["student_answer"],
        "agent_score": a["agent_score"],
        "agent_feedback": a["agent_feedback"],
        "teacher_score": a["teacher_score"],
        "effective_score": effective,
    }


def get_paper_detail(paper_id: int) -> dict:
    paper = db.get_paper(paper_id)
    if paper is None:
        raise KeyError(f"paper {paper_id} not found")
    answer_rows = db.list_answers(paper_id)
    return {
        **dict(paper),
        "total_score": _sum_effective(answer_rows),
        "max_score": _max_score(paper["exam_id"]),
        "answers": [_answer_dict(a) for a in answer_rows],
    }


def list_paper_summaries(exam_id: int) -> list[dict]:
    max_score = _max_score(exam_id)
    out = []
    for p in db.list_papers(exam_id):
        answer_rows = db.list_answers(p["paper_id"])
        out.append({**dict(p), "total_score": _sum_effective(answer_rows), "max_score": max_score})
    return out
