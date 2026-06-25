// Typed fetch helpers for the FastAPI backend.
// Mirrors the Pydantic models in backend/models.py.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8002";

// --- courses & roster --------------------------------------------------------

export type Course = {
  course_id: number;
  name: string;
  academic_year: number | null;
  created_at: string;
};

export type CourseCreateRequest = {
  name: string;
  academic_year?: number | null;
};

export type Student = {
  student_id: string;
  first_name: string | null;
  last_name: string | null;
  grade_year: number | null;
  age: number | null;
};

export type EnrollRequest = {
  student_id: string;
  first_name?: string | null;
  last_name?: string | null;
  grade_year?: number | null;
  age?: number | null;
};

// --- exams & questions --------------------------------------------------------

export type Exam = {
  exam_id: number;
  course_id: number;
  name: string;
  semester: string | null;
  question_paper_image: string | null;
  status: "draft" | "ready";
  created_at: string;
};

export type ExamCreateRequest = {
  name: string;
  semester?: string | null;
};

export type Question = {
  question_id: number;
  exam_id: number;
  question_no: number;
  text: string;
  topic: string | null;
  max_points: number | null;
  solution: string | null;
};

export type QuestionCreateRequest = {
  text: string;
  topic?: string | null;
  max_points?: number | null;
  solution?: string | null;
};

export type QuestionPatchRequest = Partial<{
  text: string;
  topic: string;
  max_points: number;
  solution: string;
}>;

// --- student papers & answers --------------------------------------------------

export type Answer = {
  answer_id: number;
  question_id: number;
  question_no: number;
  question_text: string;
  topic: string | null;
  max_points: number | null;
  student_answer: string | null;
  agent_score: number | null;
  agent_feedback: string | null;
  teacher_score: number | null;
  effective_score: number | null;
};

export type StudentPaper = {
  paper_id: number;
  exam_id: number;
  student_id: string;
  first_name: string | null;
  last_name: string | null;
  grade_year: number | null;
  age: number | null;
  image_name: string | null;
  status: "queued" | "processing" | "scored" | "error";
  error: string | null;
  created_at: string;
  total_score: number | null;
  max_score: number | null;
};

export type PaperDetail = StudentPaper & {
  answers: Answer[];
};

export type AnswerPatchRequest = {
  teacher_score: number | null;
};

// --- exam generation ------------------------------------------------------------

export type GenerateExamRequest = {
  name: string;
  semester?: string | null;
  prompt: string;
};

// --- stats -----------------------------------------------------------------------

export type StatsResponse = {
  total_papers: number;
  scored_papers: number;
  average_percent: number | null;
  pass_rate: number | null;
  score_distribution: { range: string; count: number }[];
  average_by_grade_year: { grade_year: number | string; average_percent: number; count: number }[];
  status_breakdown: { status: string; count: number }[];
  lowest_scoring: {
    paper_id: number;
    student_id: string | null;
    first_name: string | null;
    last_name: string | null;
    percent: number;
  }[];
  by_topic: { topic: string; average_percent: number; count: number }[];
  by_question: {
    exam_name: string;
    question_no: number;
    question_text: string;
    average_percent: number;
    count: number;
  }[];
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

function jsonBody(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// --- courses & roster --------------------------------------------------------

export async function listCourses(): Promise<Course[]> {
  return handle(await fetch(`${API_BASE}/api/courses`));
}

export async function createCourse(body: CourseCreateRequest): Promise<Course> {
  return handle(await fetch(`${API_BASE}/api/courses`, jsonBody(body)));
}

export async function getCourse(courseId: number): Promise<Course> {
  return handle(await fetch(`${API_BASE}/api/courses/${courseId}`));
}

export async function listRoster(courseId: number): Promise<Student[]> {
  return handle(await fetch(`${API_BASE}/api/courses/${courseId}/students`));
}

export async function addStudent(courseId: number, body: EnrollRequest): Promise<Student[]> {
  return handle(await fetch(`${API_BASE}/api/courses/${courseId}/students`, jsonBody(body)));
}

export async function removeStudent(courseId: number, studentId: string): Promise<Student[]> {
  const res = await fetch(`${API_BASE}/api/courses/${courseId}/students/${studentId}`, {
    method: "DELETE",
  });
  return handle(res);
}

export async function deleteCourse(courseId: number): Promise<Course[]> {
  const res = await fetch(`${API_BASE}/api/courses/${courseId}`, { method: "DELETE" });
  return handle(res);
}

// --- exams & questions --------------------------------------------------------

export async function listExams(courseId: number): Promise<Exam[]> {
  return handle(await fetch(`${API_BASE}/api/courses/${courseId}/exams`));
}

export async function createExam(
  courseId: number,
  name: string,
  semester: string | null,
  questionPaper: File
): Promise<Exam> {
  const form = new FormData();
  form.append("name", name);
  if (semester) form.append("semester", semester);
  form.append("question_paper", questionPaper);
  const res = await fetch(`${API_BASE}/api/courses/${courseId}/exams`, { method: "POST", body: form });
  return handle(res);
}

export async function createBlankExam(courseId: number, body: ExamCreateRequest): Promise<Exam> {
  return handle(await fetch(`${API_BASE}/api/courses/${courseId}/exams/blank`, jsonBody(body)));
}

export async function getExam(examId: number): Promise<Exam> {
  return handle(await fetch(`${API_BASE}/api/exams/${examId}`));
}

export async function listQuestions(examId: number): Promise<Question[]> {
  return handle(await fetch(`${API_BASE}/api/exams/${examId}/questions`));
}

export async function createQuestion(
  examId: number,
  body: QuestionCreateRequest
): Promise<Question[]> {
  return handle(await fetch(`${API_BASE}/api/exams/${examId}/questions`, jsonBody(body)));
}

export async function patchQuestion(
  questionId: number,
  patch: QuestionPatchRequest
): Promise<Question> {
  const res = await fetch(`${API_BASE}/api/questions/${questionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handle(res);
}

export async function deleteQuestion(questionId: number): Promise<Question[]> {
  const res = await fetch(`${API_BASE}/api/questions/${questionId}`, { method: "DELETE" });
  return handle(res);
}

export async function finalizeExam(examId: number): Promise<Exam> {
  const res = await fetch(`${API_BASE}/api/exams/${examId}/finalize`, { method: "POST" });
  return handle(res);
}

export async function deleteExam(examId: number): Promise<Exam[]> {
  const res = await fetch(`${API_BASE}/api/exams/${examId}`, { method: "DELETE" });
  return handle(res);
}

// --- student papers & answers --------------------------------------------------

export async function listPapers(examId: number): Promise<StudentPaper[]> {
  return handle(await fetch(`${API_BASE}/api/exams/${examId}/papers`));
}

export async function uploadPaper(
  examId: number,
  studentId: string,
  file: File
): Promise<StudentPaper> {
  const form = new FormData();
  form.append("student_id", studentId);
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/exams/${examId}/papers`, { method: "POST", body: form });
  return handle(res);
}

export function paperImageUrl(paperId: number): string {
  return `${API_BASE}/api/papers/${paperId}/image`;
}

export async function getPaper(paperId: number): Promise<PaperDetail> {
  return handle(await fetch(`${API_BASE}/api/papers/${paperId}`));
}

export async function patchAnswer(answerId: number, patch: AnswerPatchRequest): Promise<Answer> {
  const res = await fetch(`${API_BASE}/api/answers/${answerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handle(res);
}

export async function rescorePaper(paperId: number): Promise<StudentPaper> {
  const res = await fetch(`${API_BASE}/api/papers/${paperId}/rescore`, { method: "POST" });
  return handle(res);
}

export async function deletePaper(paperId: number): Promise<StudentPaper[]> {
  const res = await fetch(`${API_BASE}/api/papers/${paperId}`, { method: "DELETE" });
  return handle(res);
}

// --- stats & generation --------------------------------------------------------

export async function getStats(courseId?: number, examId?: number): Promise<StatsResponse> {
  const params = new URLSearchParams();
  if (courseId !== undefined) params.set("course_id", String(courseId));
  if (examId !== undefined) params.set("exam_id", String(examId));
  const query = params.toString() ? `?${params.toString()}` : "";
  return handle(await fetch(`${API_BASE}/api/stats${query}`));
}

export async function generateExam(courseId: number, body: GenerateExamRequest): Promise<Exam> {
  return handle(await fetch(`${API_BASE}/api/courses/${courseId}/generate-exam`, jsonBody(body)));
}
