"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  addStudent,
  createBlankExam,
  createExam,
  deleteExam,
  getCourse,
  listExams,
  listRoster,
  removeStudent,
  type Course,
  type Exam,
  type Student,
} from "@/lib/api";
import {
  ArrowLeft,
  ClipboardList,
  Users,
  Plus,
  Trash2,
  Calendar,
  GraduationCap,
  Sparkles,
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  UserPlus,
  ArrowRight
} from "lucide-react";

const STATUS_BADGES: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-amber-50 border-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  ready: { bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
};

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const id = Number(courseId);

  const [course, setCourse] = useState<Course | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [roster, setRoster] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"exams" | "roster">("exams");

  const [studentForm, setStudentForm] = useState({ student_id: "", first_name: "", last_name: "", grade_year: "", age: "" });
  const [examForm, setExamForm] = useState({ name: "", semester: "" });
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [examMode, setExamMode] = useState<"ocr" | "manual">("ocr");
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const [c, e, r] = await Promise.all([getCourse(id), listExams(id), listRoster(id)]);
      setCourse(c);
      setExams(e);
      setRoster(r);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load course");
    }
  };

  useEffect(() => {
    Promise.resolve().then(load);
  }, [id]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.student_id.trim()) return;
    try {
      const updated = await addStudent(id, {
        student_id: studentForm.student_id.trim(),
        first_name: studentForm.first_name || null,
        last_name: studentForm.last_name || null,
        grade_year: studentForm.grade_year ? Number(studentForm.grade_year) : null,
        age: studentForm.age ? Number(studentForm.age) : null,
      });
      setRoster(updated);
      setStudentForm({ student_id: "", first_name: "", last_name: "", grade_year: "", age: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enroll student");
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm("Are you sure you want to remove this student from the course roster?")) return;
    try {
      setRoster(await removeStudent(id, studentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove student");
    }
  };

  const handleDeleteExam = async (examId: number) => {
    if (!confirm("Delete this exam and all its questions and student papers? This cannot be undone.")) return;
    try {
      setExams(await deleteExam(examId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete exam");
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.name.trim()) return;
    if (examMode === "ocr" && !questionPaper) return;
    setIsCreatingExam(true);
    setError(null);
    try {
      const exam =
        examMode === "manual"
          ? await createBlankExam(id, { name: examForm.name.trim(), semester: examForm.semester || null })
          : await createExam(id, examForm.name.trim(), examForm.semester || null, questionPaper!);
      router.push(`/courses/${id}/exams/${exam.exam_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create exam (question extraction failed?)");
    } finally {
      setIsCreatingExam(false);
    }
  };

  const getInitials = (s: Student) => {
    const first = s.first_name ? s.first_name[0] : "";
    const last = s.last_name ? s.last_name[0] : "";
    return (first + last).toUpperCase() || s.student_id.slice(0, 2).toUpperCase();
  };

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700 flex items-center gap-2 max-w-md">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            <p className="text-zinc-500 text-sm">Loading course details…</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header and navigation */}
      <div className="border-b border-zinc-200/50 pb-6 space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-indigo-600 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Courses</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950">{course.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-zinc-500 text-sm mt-1.5">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-zinc-400" />
                {course.academic_year ? `Academic Year ${course.academic_year}` : "No Academic Year"}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
              <span>ID: {course.course_id}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-zinc-200/80">
        <button
          onClick={() => setActiveTab("exams")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all -mb-px cursor-pointer ${
            activeTab === "exams"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <ClipboardList className="h-4.5 w-4.5" />
          <span>Exams</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "exams" ? "bg-indigo-100 text-indigo-700" : "bg-zinc-100 text-zinc-600"}`}>
            {exams.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("roster")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all -mb-px cursor-pointer ${
            activeTab === "roster"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Users className="h-4.5 w-4.5" />
          <span>Roster</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === "roster" ? "bg-indigo-100 text-indigo-700" : "bg-zinc-100 text-zinc-600"}`}>
            {roster.length}
          </span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 flex items-start gap-3 text-rose-700 animate-slide-up">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* Tab Panels */}
      <div>
        {activeTab === "exams" ? (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Create Exam Panel */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-100 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Plus className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="font-semibold text-zinc-950">Create Exam</h3>
                </div>

                <form onSubmit={handleCreateExam} className="space-y-4">
                  {/* Mode Toggles */}
                  <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-1 rounded-xl border border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setExamMode("ocr")}
                      className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        examMode === "ocr"
                          ? "bg-white text-zinc-900 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      OCR Paper
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamMode("manual")}
                      className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        examMode === "manual"
                          ? "bg-white text-zinc-900 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Manual
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                      Exam Name
                    </label>
                    <input
                      required
                      value={examForm.name}
                      onChange={(e) => setExamForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Midterm Examination"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                      Semester <span className="text-zinc-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      value={examForm.semester}
                      onChange={(e) => setExamForm((f) => ({ ...f, semester: e.target.value }))}
                      placeholder="e.g. Fall Semester"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                    />
                  </div>

                  {examMode === "ocr" && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Blank Question Paper
                      </label>
                      <div className="relative border border-dashed border-zinc-300 rounded-xl p-4 bg-zinc-50 hover:bg-zinc-100/50 transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => setQuestionPaper(e.target.files?.[0] ?? null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload className="h-6 w-6 text-zinc-400 mb-2" />
                        <span className="text-xs font-medium text-zinc-700">
                          {questionPaper ? questionPaper.name : "Select paper image"}
                        </span>
                        <span className="text-[10px] text-zinc-400 mt-1">
                          PNG, JPG, or WEBP up to 10MB
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isCreatingExam || !examForm.name.trim() || (examMode === "ocr" && !questionPaper)}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isCreatingExam ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{examMode === "ocr" ? "Extracting Questions…" : "Creating…"}</span>
                      </>
                    ) : (
                      <span>Create Exam</span>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Exams List */}
            <div className="lg:col-span-8 space-y-4">
              {exams.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center flex flex-col items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400 mb-4 border border-zinc-100">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-zinc-900 text-lg">No exams created yet</h3>
                  <p className="text-zinc-500 text-sm max-w-sm mt-1">
                    Exams can be created manually or by uploading a blank test paper for automated AI question extraction.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {exams.map((exam) => {
                    const badge = STATUS_BADGES[exam.status] || STATUS_BADGES.draft;
                    return (
                      <div
                        key={exam.exam_id}
                        className="group relative flex items-center justify-between p-5 rounded-2xl border border-zinc-200/80 bg-white hover:border-indigo-400 hover:shadow-md transition-all duration-300"
                      >
                        <Link href={`/courses/${id}/exams/${exam.exam_id}`} className="flex-1 min-w-0 pr-8">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors truncate">
                              {exam.name}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                              {exam.status}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            {exam.semester ?? "No semester set"} &bull; Created {new Date(exam.created_at).toLocaleDateString()}
                          </p>
                        </Link>
                        
                        <div className="flex items-center gap-4 shrink-0">
                          <Link
                            href={`/courses/${id}/exams/${exam.exam_id}`}
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 transition"
                          >
                            Manage
                          </Link>
                          <button
                            onClick={() => handleDeleteExam(exam.exam_id)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Exam"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-12 animate-fade-in">
            {/* Enroll Student Panel */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-100 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <UserPlus className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="font-semibold text-zinc-950">Enroll Student</h3>
                </div>

                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                      Student ID
                    </label>
                    <input
                      required
                      value={studentForm.student_id}
                      onChange={(e) => setStudentForm((f) => ({ ...f, student_id: e.target.value }))}
                      placeholder="e.g. CSTU-6701"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                        First Name
                      </label>
                      <input
                        value={studentForm.first_name}
                        onChange={(e) => setStudentForm((f) => ({ ...f, first_name: e.target.value }))}
                        placeholder="John"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Last Name
                      </label>
                      <input
                        value={studentForm.last_name}
                        onChange={(e) => setStudentForm((f) => ({ ...f, last_name: e.target.value }))}
                        placeholder="Doe"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Grade Year
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={studentForm.grade_year}
                        onChange={(e) => setStudentForm((f) => ({ ...f, grade_year: e.target.value }))}
                        placeholder="Grade (1-12)"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Age
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="100"
                        value={studentForm.age}
                        onChange={(e) => setStudentForm((f) => ({ ...f, age: e.target.value }))}
                        placeholder="Age"
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!studentForm.student_id.trim()}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Enroll Student</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Roster Listing */}
            <div className="lg:col-span-8">
              <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-5 py-3.5 text-left font-semibold text-zinc-500 text-xs uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-5 py-3.5 text-left font-semibold text-zinc-500 text-xs uppercase tracking-wider">
                          Student ID
                        </th>
                        <th className="px-5 py-3.5 text-left font-semibold text-zinc-500 text-xs uppercase tracking-wider">
                          Grade Year
                        </th>
                        <th className="px-5 py-3.5 text-left font-semibold text-zinc-500 text-xs uppercase tracking-wider">
                          Age
                        </th>
                        <th className="px-5 py-3.5 text-left font-semibold text-zinc-500 text-xs uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                      {roster.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center text-zinc-400">
                            <div className="flex flex-col items-center justify-center">
                              <Users className="h-6 w-6 mb-2 text-zinc-300" />
                              <span className="text-zinc-500 text-sm font-medium">No students enrolled</span>
                              <span className="text-zinc-400 text-xs mt-0.5">Use the enrollment form to register students.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        roster.map((s) => (
                          <tr key={s.student_id} className="hover:bg-zinc-50/50 transition">
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600 font-semibold text-xs border border-indigo-200/50">
                                  {getInitials(s)}
                                </div>
                                <div className="font-semibold text-zinc-900">
                                  {[s.first_name, s.last_name].filter(Boolean).join(" ") || "Unnamed Student"}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap text-zinc-600 font-mono text-xs">
                              {s.student_id}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap text-zinc-600">
                              {s.grade_year ? `Grade ${s.grade_year}` : "—"}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap text-zinc-600">
                              {s.age ? `${s.age} yrs` : "—"}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <button
                                onClick={() => handleRemoveStudent(s.student_id)}
                                className="text-zinc-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer"
                                title="Remove student"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

