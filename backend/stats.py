"""Aggregation queries powering the visualization dashboard.

Scoped by course_id and/or exam_id. Like generation.py, rows are fetched via
db.py helpers and aggregated in Python rather than SQL joins - course-sized
data, and `evaluation_result`-equivalent fields don't need the JSON1
extension this way.
"""

from collections import defaultdict
from typing import Any

from backend import db


def _scoped_exams(course_id: int | None, exam_id: int | None):
    if exam_id is not None:
        exam = db.get_exam(exam_id)
        return [exam] if exam else []
    if course_id is not None:
        return db.list_exams(course_id)
    exams = []
    for course in db.list_courses():
        exams.extend(db.list_exams(course["course_id"]))
    return exams


def _effective_scores(answer_rows) -> list[float]:
    scores = [
        a["teacher_score"] if a["teacher_score"] is not None else a["agent_score"]
        for a in answer_rows
    ]
    return [s for s in scores if s is not None]


def _percent(total_score: float | None, max_score: float | None) -> float | None:
    if total_score is None or not max_score:
        return None
    return round(total_score / max_score * 100, 2)


def get_stats(course_id: int | None = None, exam_id: int | None = None) -> dict[str, Any]:
    papers: list[dict] = []
    by_topic: dict[str, list[float]] = defaultdict(list)
    by_question: dict[tuple, list[float]] = defaultdict(list)

    for exam in _scoped_exams(course_id, exam_id):
        questions = db.list_questions(exam["exam_id"])
        max_score = sum(q["max_points"] for q in questions if q["max_points"] is not None) or None

        for paper in db.list_papers(exam["exam_id"]):
            answer_rows = db.list_answers(paper["paper_id"]) if paper["status"] == "scored" else []
            scores = _effective_scores(answer_rows)
            total_score = sum(scores) if scores else None
            papers.append({**dict(paper), "percent": _percent(total_score, max_score)})

            for a in answer_rows:
                if not a["max_points"]:
                    continue
                effective = a["teacher_score"] if a["teacher_score"] is not None else a["agent_score"]
                if effective is None:
                    continue
                q_percent = effective / a["max_points"] * 100
                if a["topic"]:
                    by_topic[a["topic"]].append(q_percent)
                by_question[(exam["name"], a["question_no"], a["question_text"])].append(q_percent)

    total_papers = len(papers)
    scored_papers = sum(1 for p in papers if p["status"] == "scored")

    percents = [p["percent"] for p in papers if p["percent"] is not None]
    average_percent = round(sum(percents) / len(percents), 2) if percents else None
    pass_rate = (
        round(sum(1 for p in percents if p >= 50) / len(percents) * 100, 2) if percents else None
    )

    buckets = [0] * 10  # 0-9, 10-19, ..., 90-100
    for p in percents:
        buckets[min(int(p // 10), 9)] += 1
    score_distribution = [{"range": f"{i * 10}-{i * 10 + 9}", "count": buckets[i]} for i in range(10)]

    by_grade_year: dict[Any, list[float]] = defaultdict(list)
    for p in papers:
        if p["percent"] is not None:
            by_grade_year[p["grade_year"] if p["grade_year"] is not None else "Unknown"].append(
                p["percent"]
            )
    average_by_grade_year = [
        {"grade_year": y, "average_percent": round(sum(v) / len(v), 2), "count": len(v)}
        for y, v in sorted(by_grade_year.items(), key=lambda kv: str(kv[0]))
    ]

    status_counts: dict[str, int] = defaultdict(int)
    for p in papers:
        status_counts[p["status"]] += 1
    status_breakdown = [{"status": s, "count": c} for s, c in status_counts.items()]

    scored = [p for p in papers if p["percent"] is not None]
    lowest_scoring = [
        {
            "paper_id": p["paper_id"],
            "student_id": p["student_id"],
            "first_name": p["first_name"],
            "last_name": p["last_name"],
            "percent": p["percent"],
        }
        for p in sorted(scored, key=lambda p: p["percent"])[:5]
    ]

    by_topic_list = [
        {"topic": t, "average_percent": round(sum(v) / len(v), 2), "count": len(v)}
        for t, v in by_topic.items()
    ]
    by_topic_list.sort(key=lambda r: r["average_percent"])

    by_question_list = [
        {
            "exam_name": k[0],
            "question_no": k[1],
            "question_text": k[2],
            "average_percent": round(sum(v) / len(v), 2),
            "count": len(v),
        }
        for k, v in by_question.items()
    ]
    by_question_list.sort(key=lambda r: r["average_percent"])

    return {
        "total_papers": total_papers,
        "scored_papers": scored_papers,
        "average_percent": average_percent,
        "pass_rate": pass_rate,
        "score_distribution": score_distribution,
        "average_by_grade_year": average_by_grade_year,
        "status_breakdown": status_breakdown,
        "lowest_scoring": lowest_scoring,
        "by_topic": by_topic_list,
        "by_question": by_question_list,
    }
