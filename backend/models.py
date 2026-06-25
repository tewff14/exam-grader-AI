"""Pydantic request/response models for the API."""

from pydantic import BaseModel


# --- courses & roster --------------------------------------------------------


class CourseCreateRequest(BaseModel):
    name: str
    academic_year: int | None = None


class Course(BaseModel):
    course_id: int
    name: str
    academic_year: int | None
    created_at: str


class Student(BaseModel):
    student_id: str
    first_name: str | None
    last_name: str | None
    grade_year: int | None
    age: int | None


class EnrollRequest(BaseModel):
    student_id: str
    first_name: str | None = None
    last_name: str | None = None
    grade_year: int | None = None
    age: int | None = None


# --- exams & questions --------------------------------------------------------


class ExamCreateRequest(BaseModel):
    name: str
    semester: str | None = None


class Exam(BaseModel):
    exam_id: int
    course_id: int
    name: str
    semester: str | None
    question_paper_image: str | None
    status: str  # 'draft' | 'ready'
    created_at: str


class Question(BaseModel):
    question_id: int
    exam_id: int
    question_no: int
    text: str
    topic: str | None
    max_points: float | None
    solution: str | None


class QuestionCreateRequest(BaseModel):
    text: str
    topic: str | None = None
    max_points: float | None = None
    solution: str | None = None


class QuestionPatchRequest(BaseModel):
    text: str | None = None
    topic: str | None = None
    max_points: float | None = None
    solution: str | None = None


# --- student papers & answers --------------------------------------------------


class Answer(BaseModel):
    answer_id: int
    question_id: int
    question_no: int
    question_text: str
    topic: str | None
    max_points: float | None
    student_answer: str | None
    agent_score: float | None
    agent_feedback: str | None
    teacher_score: float | None
    effective_score: float | None  # teacher_score if set, else agent_score


class StudentPaper(BaseModel):
    paper_id: int
    exam_id: int
    student_id: str
    first_name: str | None
    last_name: str | None
    grade_year: int | None
    age: int | None
    image_name: str | None
    status: str  # 'queued' | 'processing' | 'scored' | 'error'
    error: str | None
    created_at: str
    total_score: float | None  # sum of effective_score, once scored
    max_score: float | None  # sum of question.max_points


class PaperDetail(StudentPaper):
    answers: list[Answer]


class AnswerPatchRequest(BaseModel):
    teacher_score: float | None = None


# --- exam generation ------------------------------------------------------------


class GenerateExamRequest(BaseModel):
    name: str
    semester: str | None = None
    prompt: str


# --- stats -----------------------------------------------------------------------


class StatsResponse(BaseModel):
    total_papers: int
    scored_papers: int
    average_percent: float | None
    pass_rate: float | None
    score_distribution: list[dict]
    average_by_grade_year: list[dict]
    status_breakdown: list[dict]
    lowest_scoring: list[dict]
    by_topic: list[dict]
    by_question: list[dict]
