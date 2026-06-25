"""SQLite connection + schema management.

Hierarchy: course -> exam -> question, and course -> (via enrollment) student.
A student_paper belongs to one exam and one enrolled student; each of its
answer rows is scored against one question.
"""

import sqlite3
from contextlib import contextmanager

from backend import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS course (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    academic_year INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student (
    student_id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    grade_year INTEGER,
    age INTEGER
);

CREATE TABLE IF NOT EXISTS enrollment (
    course_id INTEGER NOT NULL REFERENCES course(course_id),
    student_id TEXT NOT NULL REFERENCES student(student_id),
    PRIMARY KEY (course_id, student_id)
);

CREATE TABLE IF NOT EXISTS exam (
    exam_id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES course(course_id),
    name TEXT NOT NULL,
    semester TEXT,
    question_paper_image TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS question (
    question_id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL REFERENCES exam(exam_id),
    question_no INTEGER NOT NULL,
    text TEXT NOT NULL,
    topic TEXT,
    max_points REAL,
    solution TEXT
);

CREATE TABLE IF NOT EXISTS student_paper (
    paper_id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL REFERENCES exam(exam_id),
    student_id TEXT NOT NULL REFERENCES student(student_id),
    image_name TEXT,
    image_path TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    error TEXT,
    raw_result TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS answer (
    answer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id INTEGER NOT NULL REFERENCES student_paper(paper_id),
    question_id INTEGER NOT NULL REFERENCES question(question_id),
    student_answer TEXT,
    agent_score REAL,
    agent_feedback TEXT,
    teacher_score REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(SCHEMA)


# --- courses & roster -------------------------------------------------------


def create_course(name: str, academic_year: int | None) -> int:
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO course (name, academic_year) VALUES (?, ?)",
            (name, academic_year),
        )
        return cur.lastrowid


def list_courses():
    with get_db() as conn:
        return conn.execute("SELECT * FROM course ORDER BY course_id DESC").fetchall()


def get_course(course_id: int):
    with get_db() as conn:
        return conn.execute(
            "SELECT * FROM course WHERE course_id = ?", (course_id,)
        ).fetchone()


def upsert_student(student_id: str, first_name, last_name, grade_year, age) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO student (student_id, first_name, last_name, grade_year, age)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(student_id) DO UPDATE SET
                first_name = COALESCE(excluded.first_name, first_name),
                last_name = COALESCE(excluded.last_name, last_name),
                grade_year = COALESCE(excluded.grade_year, grade_year),
                age = COALESCE(excluded.age, age)
            """,
            (student_id, first_name, last_name, grade_year, age),
        )


def enroll_student(
    course_id: int, student_id: str, first_name, last_name, grade_year, age
) -> None:
    """Upsert the student and add them to the course's roster."""
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO student (student_id, first_name, last_name, grade_year, age)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(student_id) DO UPDATE SET
                first_name = COALESCE(excluded.first_name, first_name),
                last_name = COALESCE(excluded.last_name, last_name),
                grade_year = COALESCE(excluded.grade_year, grade_year),
                age = COALESCE(excluded.age, age)
            """,
            (student_id, first_name, last_name, grade_year, age),
        )
        conn.execute(
            "INSERT OR IGNORE INTO enrollment (course_id, student_id) VALUES (?, ?)",
            (course_id, student_id),
        )


def remove_enrollment(course_id: int, student_id: str) -> None:
    with get_db() as conn:
        conn.execute(
            "DELETE FROM enrollment WHERE course_id = ? AND student_id = ?",
            (course_id, student_id),
        )


def list_roster(course_id: int):
    with get_db() as conn:
        return conn.execute(
            """
            SELECT s.* FROM student s
            JOIN enrollment e ON e.student_id = s.student_id
            WHERE e.course_id = ?
            ORDER BY s.student_id
            """,
            (course_id,),
        ).fetchall()


def is_enrolled(course_id: int, student_id: str) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT 1 FROM enrollment WHERE course_id = ? AND student_id = ?",
            (course_id, student_id),
        ).fetchone()
        return row is not None


def delete_course(course_id: int) -> list[str]:
    """Delete a course and everything under it: exams, questions, student papers,
    answers, and enrollments. Enrolled students are global records and are not
    deleted - only their enrollment in this course.

    Returns the on-disk file paths (question paper images + student paper images)
    that belonged to deleted rows, for the caller to unlink.
    """
    with get_db() as conn:
        paths = [
            r["question_paper_image"]
            for r in conn.execute(
                "SELECT question_paper_image FROM exam WHERE course_id = ?", (course_id,)
            ).fetchall()
            if r["question_paper_image"]
        ]
        paths += [
            r["image_path"]
            for r in conn.execute(
                """
                SELECT image_path FROM student_paper
                WHERE exam_id IN (SELECT exam_id FROM exam WHERE course_id = ?)
                """,
                (course_id,),
            ).fetchall()
            if r["image_path"]
        ]

        conn.execute(
            """
            DELETE FROM answer
            WHERE paper_id IN (
                SELECT paper_id FROM student_paper
                WHERE exam_id IN (SELECT exam_id FROM exam WHERE course_id = ?)
            )
            """,
            (course_id,),
        )
        conn.execute(
            "DELETE FROM student_paper WHERE exam_id IN (SELECT exam_id FROM exam WHERE course_id = ?)",
            (course_id,),
        )
        conn.execute(
            "DELETE FROM question WHERE exam_id IN (SELECT exam_id FROM exam WHERE course_id = ?)",
            (course_id,),
        )
        conn.execute("DELETE FROM exam WHERE course_id = ?", (course_id,))
        conn.execute("DELETE FROM enrollment WHERE course_id = ?", (course_id,))
        conn.execute("DELETE FROM course WHERE course_id = ?", (course_id,))
        return paths


# --- exams & questions -------------------------------------------------------


def create_exam_draft(
    course_id: int, name: str, semester: str | None, question_paper_image: str | None
) -> int:
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO exam (course_id, name, semester, question_paper_image, status)
            VALUES (?, ?, ?, ?, 'draft')
            """,
            (course_id, name, semester, question_paper_image),
        )
        return cur.lastrowid


def get_exam(exam_id: int):
    with get_db() as conn:
        return conn.execute("SELECT * FROM exam WHERE exam_id = ?", (exam_id,)).fetchone()


def list_exams(course_id: int):
    with get_db() as conn:
        return conn.execute(
            "SELECT * FROM exam WHERE course_id = ? ORDER BY exam_id DESC", (course_id,)
        ).fetchall()


def set_exam_status(exam_id: int, status: str) -> None:
    with get_db() as conn:
        conn.execute("UPDATE exam SET status = ? WHERE exam_id = ?", (status, exam_id))


def set_exam_question_paper_image(exam_id: int, image_path: str) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE exam SET question_paper_image = ? WHERE exam_id = ?", (image_path, exam_id)
        )


def add_questions(exam_id: int, questions: list[dict]) -> None:
    """Insert extracted/generated questions for an exam.

    Each dict may have: question_no, text, topic, max_points, solution.
    """
    with get_db() as conn:
        for q in questions:
            conn.execute(
                """
                INSERT INTO question (exam_id, question_no, text, topic, max_points, solution)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    exam_id,
                    q.get("question_no"),
                    q.get("text"),
                    q.get("topic"),
                    q.get("max_points"),
                    q.get("solution"),
                ),
            )


def add_question(exam_id: int, fields: dict) -> int:
    """Insert a single manually-authored question, auto-numbered after the last one.

    fields may have: text, topic, max_points, solution.
    """
    with get_db() as conn:
        next_no = conn.execute(
            "SELECT COALESCE(MAX(question_no), 0) + 1 FROM question WHERE exam_id = ?",
            (exam_id,),
        ).fetchone()[0]
        cur = conn.execute(
            """
            INSERT INTO question (exam_id, question_no, text, topic, max_points, solution)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                exam_id,
                next_no,
                fields.get("text"),
                fields.get("topic"),
                fields.get("max_points"),
                fields.get("solution"),
            ),
        )
        return cur.lastrowid


def list_questions(exam_id: int):
    with get_db() as conn:
        return conn.execute(
            "SELECT * FROM question WHERE exam_id = ? ORDER BY question_no", (exam_id,)
        ).fetchall()


def get_question(question_id: int):
    with get_db() as conn:
        return conn.execute(
            "SELECT * FROM question WHERE question_id = ?", (question_id,)
        ).fetchone()


def patch_question(question_id: int, fields: dict) -> None:
    """Update only the provided columns (text/topic/max_points/solution) of a question."""
    allowed = {"text", "topic", "max_points", "solution"}
    cols = [k for k in fields if k in allowed]
    if not cols:
        return
    set_clause = ", ".join(f"{c} = ?" for c in cols)
    with get_db() as conn:
        conn.execute(
            f"UPDATE question SET {set_clause} WHERE question_id = ?",
            (*(fields[c] for c in cols), question_id),
        )


def delete_question(question_id: int) -> None:
    """Delete a question and its answer rows across every paper. No files involved."""
    with get_db() as conn:
        conn.execute("DELETE FROM answer WHERE question_id = ?", (question_id,))
        conn.execute("DELETE FROM question WHERE question_id = ?", (question_id,))


def delete_exam(exam_id: int) -> list[str]:
    """Delete an exam and everything under it: questions, student papers, answers.

    Returns the on-disk file paths (the question paper image + each paper's image)
    that belonged to deleted rows, for the caller to unlink.
    """
    with get_db() as conn:
        exam = conn.execute(
            "SELECT question_paper_image FROM exam WHERE exam_id = ?", (exam_id,)
        ).fetchone()
        paths = [
            r["image_path"]
            for r in conn.execute(
                "SELECT image_path FROM student_paper WHERE exam_id = ?", (exam_id,)
            ).fetchall()
            if r["image_path"]
        ]
        if exam and exam["question_paper_image"]:
            paths.append(exam["question_paper_image"])

        conn.execute(
            """
            DELETE FROM answer
            WHERE paper_id IN (SELECT paper_id FROM student_paper WHERE exam_id = ?)
            """,
            (exam_id,),
        )
        conn.execute("DELETE FROM student_paper WHERE exam_id = ?", (exam_id,))
        conn.execute("DELETE FROM question WHERE exam_id = ?", (exam_id,))
        conn.execute("DELETE FROM exam WHERE exam_id = ?", (exam_id,))
        return paths


# --- student papers -----------------------------------------------------------


def create_queued_paper(exam_id: int, student_id: str, image_name: str) -> int:
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO student_paper (exam_id, student_id, image_name, status)
            VALUES (?, ?, ?, 'queued')
            """,
            (exam_id, student_id, image_name),
        )
        return cur.lastrowid


def set_paper_status(paper_id: int, status: str, error: str | None = None) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE student_paper SET status = ?, error = ? WHERE paper_id = ?",
            (status, error, paper_id),
        )


def set_paper_image_path(paper_id: int, image_path: str) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE student_paper SET image_path = ? WHERE paper_id = ?",
            (image_path, paper_id),
        )


def set_paper_raw_result(paper_id: int, raw_result: str) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE student_paper SET raw_result = ? WHERE paper_id = ?",
            (raw_result, paper_id),
        )


def get_paper(paper_id: int):
    with get_db() as conn:
        return conn.execute(
            """
            SELECT p.*, s.first_name, s.last_name, s.grade_year, s.age
            FROM student_paper p
            JOIN student s ON s.student_id = p.student_id
            WHERE p.paper_id = ?
            """,
            (paper_id,),
        ).fetchone()


def list_papers(exam_id: int):
    with get_db() as conn:
        return conn.execute(
            """
            SELECT p.*, s.first_name, s.last_name, s.grade_year, s.age
            FROM student_paper p
            JOIN student s ON s.student_id = p.student_id
            WHERE p.exam_id = ?
            ORDER BY p.paper_id DESC
            """,
            (exam_id,),
        ).fetchall()


def delete_paper(paper_id: int) -> list[str]:
    """Delete a student paper and its answers.

    Returns the on-disk image path that belonged to the deleted paper, if any, for
    the caller to unlink.
    """
    with get_db() as conn:
        paper = conn.execute(
            "SELECT image_path FROM student_paper WHERE paper_id = ?", (paper_id,)
        ).fetchone()
        conn.execute("DELETE FROM answer WHERE paper_id = ?", (paper_id,))
        conn.execute("DELETE FROM student_paper WHERE paper_id = ?", (paper_id,))
        return [paper["image_path"]] if paper and paper["image_path"] else []


# --- answers -------------------------------------------------------------------


def replace_agent_answers(paper_id: int, answers: list[dict]) -> None:
    """Overwrite agent-derived fields for a paper's answers, keyed by question_id.

    Each dict needs: question_id, student_answer, agent_score, agent_feedback.
    Existing teacher_score (if any) is preserved across re-scoring since rows are
    updated in place rather than replaced.
    """
    with get_db() as conn:
        for a in answers:
            existing = conn.execute(
                "SELECT answer_id FROM answer WHERE paper_id = ? AND question_id = ?",
                (paper_id, a["question_id"]),
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE answer SET student_answer = ?, agent_score = ?, agent_feedback = ?
                    WHERE answer_id = ?
                    """,
                    (a["student_answer"], a["agent_score"], a["agent_feedback"], existing["answer_id"]),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO answer (paper_id, question_id, student_answer, agent_score, agent_feedback)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (paper_id, a["question_id"], a["student_answer"], a["agent_score"], a["agent_feedback"]),
                )


def list_answers(paper_id: int):
    with get_db() as conn:
        return conn.execute(
            """
            SELECT a.*, q.question_no, q.text AS question_text, q.topic, q.max_points
            FROM answer a
            JOIN question q ON q.question_id = a.question_id
            WHERE a.paper_id = ?
            ORDER BY q.question_no
            """,
            (paper_id,),
        ).fetchall()


def get_answer(answer_id: int):
    with get_db() as conn:
        return conn.execute(
            "SELECT * FROM answer WHERE answer_id = ?", (answer_id,)
        ).fetchone()


def get_answer_with_question(answer_id: int):
    with get_db() as conn:
        return conn.execute(
            """
            SELECT a.*, q.question_no, q.text AS question_text, q.topic, q.max_points
            FROM answer a
            JOIN question q ON q.question_id = a.question_id
            WHERE a.answer_id = ?
            """,
            (answer_id,),
        ).fetchone()


def set_answer_teacher_score(answer_id: int, teacher_score: float | None) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE answer SET teacher_score = ? WHERE answer_id = ?",
            (teacher_score, answer_id),
        )
