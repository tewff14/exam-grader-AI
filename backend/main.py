"""FastAPI backend for the exam grading platform.

Owns HTTP routing, validation, and DB access. JamAI integration lives in
jamai/connector.py; exam creation in exams.py; per-question scoring in
grading.py + worker.py; exam generation in generation.py; dashboard
aggregation in stats.py.
"""

import sys
from contextlib import asynccontextmanager
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

try:
    from . import db, exams, generation, grading, stats, worker
    from .models import (
        Answer,
        AnswerPatchRequest,
        Course,
        CourseCreateRequest,
        EnrollRequest,
        Exam,
        ExamCreateRequest,
        GenerateExamRequest,
        PaperDetail,
        Question,
        QuestionCreateRequest,
        QuestionPatchRequest,
        StatsResponse,
        Student,
        StudentPaper,
    )
except ImportError:
    from backend import db, exams, generation, grading, stats, worker
    from backend.models import (
        Answer,
        AnswerPatchRequest,
        Course,
        CourseCreateRequest,
        EnrollRequest,
        Exam,
        ExamCreateRequest,
        GenerateExamRequest,
        PaperDetail,
        Question,
        QuestionCreateRequest,
        QuestionPatchRequest,
        StatsResponse,
        Student,
        StudentPaper,
    )

from jamai import connector


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Exam Grading Platform", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _row_to_exam(row) -> Exam:
    return Exam(**dict(row))


def _row_to_paper(d: dict) -> StudentPaper:
    return StudentPaper(**d)


# --- courses & roster --------------------------------------------------------


@app.get("/api/courses", response_model=list[Course])
def list_courses():
    return [Course(**dict(c)) for c in db.list_courses()]


@app.post("/api/courses", response_model=Course)
def create_course(body: CourseCreateRequest):
    course_id = db.create_course(body.name, body.academic_year)
    return Course(**dict(db.get_course(course_id)))


@app.get("/api/courses/{course_id}", response_model=Course)
def get_course(course_id: int):
    course = db.get_course(course_id)
    if course is None:
        raise HTTPException(404, f"course {course_id} not found")
    return Course(**dict(course))


@app.get("/api/courses/{course_id}/students", response_model=list[Student])
def list_roster(course_id: int):
    if db.get_course(course_id) is None:
        raise HTTPException(404, f"course {course_id} not found")
    return [Student(**dict(s)) for s in db.list_roster(course_id)]


@app.post("/api/courses/{course_id}/students", response_model=list[Student])
def add_student(course_id: int, body: EnrollRequest):
    if db.get_course(course_id) is None:
        raise HTTPException(404, f"course {course_id} not found")
    db.enroll_student(
        course_id, body.student_id, body.first_name, body.last_name, body.grade_year, body.age
    )
    return [Student(**dict(s)) for s in db.list_roster(course_id)]


@app.delete("/api/courses/{course_id}/students/{student_id}", response_model=list[Student])
def remove_student(course_id: int, student_id: str):
    db.remove_enrollment(course_id, student_id)
    return [Student(**dict(s)) for s in db.list_roster(course_id)]


@app.delete("/api/courses/{course_id}", response_model=list[Course])
def delete_course(course_id: int):
    if db.get_course(course_id) is None:
        raise HTTPException(404, f"course {course_id} not found")
    for path in db.delete_course(course_id):
        Path(path).unlink(missing_ok=True)
    return [Course(**dict(c)) for c in db.list_courses()]


# --- exams & questions --------------------------------------------------------


@app.get("/api/courses/{course_id}/exams", response_model=list[Exam])
def list_exams(course_id: int):
    if db.get_course(course_id) is None:
        raise HTTPException(404, f"course {course_id} not found")
    return [_row_to_exam(e) for e in db.list_exams(course_id)]


@app.post("/api/courses/{course_id}/exams", response_model=Exam)
async def create_exam(
    course_id: int,
    name: str = Form(...),
    semester: str | None = Form(None),
    question_paper: UploadFile = File(...),
):
    if db.get_course(course_id) is None:
        raise HTTPException(404, f"course {course_id} not found")
    content = await question_paper.read()
    if not content:
        raise HTTPException(400, "question_paper is empty")
    try:
        exam_id = exams.create_exam(course_id, name, semester, content, question_paper.filename)
    except Exception as exc:  # noqa: BLE001 - surface JamAI/extraction failures to the teacher
        raise HTTPException(502, f"Question extraction failed: {exc}") from exc
    return _row_to_exam(db.get_exam(exam_id))


@app.post("/api/courses/{course_id}/exams/blank", response_model=Exam)
def create_blank_exam(course_id: int, body: ExamCreateRequest):
    if db.get_course(course_id) is None:
        raise HTTPException(404, f"course {course_id} not found")
    exam_id = exams.create_blank_exam(course_id, body.name, body.semester)
    return _row_to_exam(db.get_exam(exam_id))


@app.get("/api/exams/{exam_id}", response_model=Exam)
def get_exam(exam_id: int):
    exam = db.get_exam(exam_id)
    if exam is None:
        raise HTTPException(404, f"exam {exam_id} not found")
    return _row_to_exam(exam)


@app.get("/api/exams/{exam_id}/questions", response_model=list[Question])
def list_questions(exam_id: int):
    if db.get_exam(exam_id) is None:
        raise HTTPException(404, f"exam {exam_id} not found")
    return [Question(**dict(q)) for q in db.list_questions(exam_id)]


@app.post("/api/exams/{exam_id}/questions", response_model=list[Question])
def add_question(exam_id: int, body: QuestionCreateRequest):
    try:
        exams.add_question(exam_id, body.model_dump())
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return [Question(**dict(q)) for q in db.list_questions(exam_id)]


@app.patch("/api/questions/{question_id}", response_model=Question)
def patch_question(question_id: int, patch: QuestionPatchRequest):
    try:
        exams.patch_question(question_id, patch.model_dump(exclude_unset=True))
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    return Question(**dict(db.get_question(question_id)))


@app.delete("/api/questions/{question_id}", response_model=list[Question])
def delete_question(question_id: int):
    question = db.get_question(question_id)
    if question is None:
        raise HTTPException(404, f"question {question_id} not found")
    exam_id = question["exam_id"]
    db.delete_question(question_id)
    return [Question(**dict(q)) for q in db.list_questions(exam_id)]


@app.post("/api/exams/{exam_id}/finalize", response_model=Exam)
def finalize_exam(exam_id: int):
    try:
        exams.finalize_exam(exam_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _row_to_exam(db.get_exam(exam_id))


@app.delete("/api/exams/{exam_id}", response_model=list[Exam])
def delete_exam(exam_id: int):
    exam = db.get_exam(exam_id)
    if exam is None:
        raise HTTPException(404, f"exam {exam_id} not found")
    course_id = exam["course_id"]
    for path in db.delete_exam(exam_id):
        Path(path).unlink(missing_ok=True)
    return [_row_to_exam(e) for e in db.list_exams(course_id)]


# --- student papers & answers --------------------------------------------------


@app.get("/api/exams/{exam_id}/papers", response_model=list[StudentPaper])
def list_papers(exam_id: int):
    if db.get_exam(exam_id) is None:
        raise HTTPException(404, f"exam {exam_id} not found")
    return [_row_to_paper(p) for p in grading.list_paper_summaries(exam_id)]


@app.post("/api/exams/{exam_id}/papers", response_model=StudentPaper)
async def upload_paper(exam_id: int, student_id: str = Form(...), file: UploadFile = File(...)):
    exam = db.get_exam(exam_id)
    if exam is None:
        raise HTTPException(404, f"exam {exam_id} not found")
    if exam["status"] != "ready":
        raise HTTPException(400, "Exam must be finalized before it can receive student papers")
    if not db.is_enrolled(exam["course_id"], student_id):
        raise HTTPException(400, f"student {student_id} is not enrolled in this course")

    content = await file.read()
    if not content:
        raise HTTPException(400, f"'{file.filename}' is empty")

    paper_id = worker.enqueue_paper_upload(exam_id, student_id, content, file.filename)
    return _row_to_paper(grading.get_paper_detail(paper_id))


@app.get("/api/papers/{paper_id}", response_model=PaperDetail)
def get_paper(paper_id: int):
    try:
        detail = grading.get_paper_detail(paper_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    return PaperDetail(**detail)


@app.get("/api/papers/{paper_id}/image")
def get_paper_image(paper_id: int):
    paper = db.get_paper(paper_id)
    if paper is None or not paper["image_path"]:
        raise HTTPException(404, f"paper {paper_id} image not found")
    return FileResponse(paper["image_path"])


@app.patch("/api/answers/{answer_id}", response_model=Answer)
def patch_answer(answer_id: int, patch: AnswerPatchRequest):
    try:
        grading.apply_override(answer_id, patch.teacher_score)
        return Answer(**grading.answer_detail(answer_id))
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/api/papers/{paper_id}/rescore", response_model=StudentPaper)
def rescore_paper(paper_id: int):
    if db.get_paper(paper_id) is None:
        raise HTTPException(404, f"paper {paper_id} not found")
    db.set_paper_status(paper_id, "processing")
    worker.enqueue_rescore(paper_id)
    return _row_to_paper(grading.get_paper_detail(paper_id))


@app.delete("/api/papers/{paper_id}", response_model=list[StudentPaper])
def delete_paper(paper_id: int):
    paper = db.get_paper(paper_id)
    if paper is None:
        raise HTTPException(404, f"paper {paper_id} not found")
    exam_id = paper["exam_id"]
    for path in db.delete_paper(paper_id):
        Path(path).unlink(missing_ok=True)
    return [_row_to_paper(p) for p in grading.list_paper_summaries(exam_id)]


# --- stats & generation --------------------------------------------------------


@app.get("/api/stats", response_model=StatsResponse)
def get_stats(course_id: int | None = None, exam_id: int | None = None):
    return stats.get_stats(course_id=course_id, exam_id=exam_id)


@app.post("/api/courses/{course_id}/generate-exam", response_model=Exam)
def generate_exam(course_id: int, body: GenerateExamRequest):
    if db.get_course(course_id) is None:
        raise HTTPException(404, f"course {course_id} not found")
    try:
        exam_id = generation.generate_exam(course_id, body.name, body.semester, body.prompt)
    except Exception as exc:  # noqa: BLE001 - surface JamAI/generation failures to the teacher
        raise HTTPException(502, f"Exam generation failed: {exc}") from exc
    return _row_to_exam(db.get_exam(exam_id))


@app.get("/api/health")
def health():
    return {"status": "ok", "jamai": connector.health_check()}


if __name__ == "__main__":
    import uvicorn

    # Ports 8000 and 8001 are already used by unrelated long-running services
    # on this machine; default to 8002 instead.
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8002, reload=True)
